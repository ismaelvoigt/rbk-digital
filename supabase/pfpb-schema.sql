-- Proposta aditiva. Aplicar somente ao staging validado. Não depende das migrations de monitoramento.
begin;
create schema if not exists pfpb_private;
revoke all on schema pfpb_private from public, anon;
grant usage on schema pfpb_private to authenticated;
create function pfpb_private.role() returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.rbk_admins a where a.user_id=auth.uid() and a.ativo) then 'superadmin_rbk'
 when u.perfil='gestor_rbk' then 'gestor_rbk' end from public.users u where u.id=auth.uid() and u.status='active'
$$;
create table public.pfpb_processes (
 id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id),
 ficha jsonb not null default '{}' check(jsonb_typeof(ficha)='object'), revision integer not null default 1,
 deleted_at timestamptz, deleted_by uuid references auth.users(id),
 formed_revision integer, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function pfpb_private.can_access(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(pfpb_private.role()='superadmin_rbk' or (pfpb_private.role()='gestor_rbk' and exists(select 1 from public.pfpb_processes p where p.id=pid and p.created_by=auth.uid())),false)
$$;
create table public.pfpb_versions (
 id uuid primary key, process_id uuid not null references public.pfpb_processes(id), kind text not null
 check(kind in ('cnpj','contrato_social','endereco','licenca_sanitaria','afe','cnd','crt','representante','rt','banco','rta')),
 storage_path text not null unique, filename text not null, size integer not null check(size between 1 and 20971520),
 uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create index on public.pfpb_versions(process_id,kind,created_at desc);
create table public.pfpb_reviews (
 id uuid primary key default gen_random_uuid(), process_id uuid not null references public.pfpb_processes(id),
 version_id uuid not null references public.pfpb_versions(id), decision text not null check(decision in ('Aprovado','Substituir','Em análise')),
 observation text not null default '', decided_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create index on public.pfpb_reviews(process_id,created_at desc);
create table public.pfpb_analyses (
 id uuid primary key default gen_random_uuid(), process_id uuid not null references public.pfpb_processes(id), revision integer not null,
 result jsonb not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create table public.pfpb_events (
 id uuid primary key default gen_random_uuid(), process_id uuid not null references public.pfpb_processes(id),
 action text not null, actor_id uuid not null references auth.users(id), detail jsonb not null default '{}', created_at timestamptz not null default clock_timestamp()
);
create function pfpb_private.command(op text,pid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.pfpb_processes; v public.pfpb_versions; outid uuid; total integer; key text; value jsonb;
begin
 if pfpb_private.role() is null then raise exception 'Acesso negado' using errcode='42501';end if;
 if op in ('create','ficha') then
  if jsonb_typeof(payload->'ficha') is distinct from 'object' then raise exception 'Ficha inválida';end if;
  for key,value in select * from jsonb_each(payload->'ficha') loop
   if key !~ '^B(19|2[0-9]|3[0-689]|4[0-35-9]|5[2-9]|6[0-7])$' or jsonb_typeof(value)<>'string' or length(value#>>'{}')>500 then raise exception 'Campo inválido';end if;
  end loop;
 end if;
 if op='create' then
  if coalesce(payload->'ficha'->>'B20','') !~ '^[0-9./ -]{14,18}$' or length(trim(coalesce(payload->'ficha'->>'B21','')))<2 then raise exception 'CNPJ e razão social necessários';end if;
  insert into public.pfpb_processes(created_by,ficha) values(auth.uid(),payload->'ficha') returning * into p;
  insert into public.pfpb_events(process_id,action,actor_id) values(p.id,'Processo criado',auth.uid());
  return to_jsonb(p);
 end if;
 if not pfpb_private.can_access(pid) then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into p from public.pfpb_processes where id=pid for update;
 if p.id is null then raise exception 'Processo inexistente';end if;
 if p.deleted_at is not null then raise exception 'Processo excluído';end if;
 if op='cancel' then
  if (payload->>'revision')::integer is distinct from p.revision or payload->>'confirmed' is distinct from 'true' then raise exception 'Confirme a exclusão na versão atual';end if;
  update public.pfpb_processes set deleted_at=now(),deleted_by=auth.uid(),revision=revision+1,formed_revision=null,updated_at=now() where id=pid returning * into p;
  insert into public.pfpb_events(process_id,action,actor_id) values(pid,'Processo excluído por desistência',auth.uid());
 elsif op='ficha' then
  if (payload->>'revision')::integer is distinct from p.revision then raise exception 'Processo alterado. Atualize a tela.';end if;
  update public.pfpb_processes set ficha=payload->'ficha', revision=revision+1, formed_revision=null,updated_at=now() where id=pid returning * into p;
  insert into public.pfpb_events(process_id,action,actor_id,detail) values(pid,'Ficha alterada',auth.uid(),jsonb_build_object('revision',p.revision));
 elsif op='upload' then
  outid=(payload->>'id')::uuid;
  if payload->>'path' is distinct from pid::text||'/'||outid::text||'.pdf' then raise exception 'Caminho inválido';end if;
  if not exists(select 1 from storage.objects where bucket_id='pfpb-private' and name=payload->>'path') then raise exception 'Upload não localizado';end if;
  insert into public.pfpb_versions(id,process_id,kind,storage_path,filename,size,uploaded_by) values(outid,pid,payload->>'kind',payload->>'path',left(payload->>'filename',180),(payload->>'size')::integer,auth.uid());
  update public.pfpb_processes set revision=revision+1, formed_revision=null,updated_at=now() where id=pid returning * into p;
  insert into public.pfpb_events(process_id,action,actor_id,detail) values(pid,'Documento enviado / nova versão',auth.uid(),jsonb_build_object('version_id',outid,'kind',payload->>'kind'));
 elsif op='review' then
  select * into v from public.pfpb_versions where id=(payload->>'version_id')::uuid and process_id=pid;
  if v.id is null or exists(select 1 from public.pfpb_versions where process_id=pid and kind=v.kind and created_at>v.created_at) then raise exception 'Versão substituída. Atualize a tela.';end if;
  if payload->>'decision'<>'Aprovado' and length(trim(coalesce(payload->>'observation','')))<3 then raise exception 'Informe a observação';end if;
  if length(coalesce(payload->>'observation',''))>2000 then raise exception 'Observação muito longa';end if;
  insert into public.pfpb_reviews(process_id,version_id,decision,observation,decided_by) values(pid,v.id,payload->>'decision',coalesce(payload->>'observation',''),auth.uid());
  update public.pfpb_processes set formed_revision=null,updated_at=now() where id=pid;
  insert into public.pfpb_events(process_id,action,actor_id,detail) values(pid,'Revisão do Gestor',auth.uid(),jsonb_build_object('version_id',v.id,'decision',payload->>'decision'));
 elsif op='analysis' then
  if (payload->>'revision')::integer is distinct from p.revision then raise exception 'Documentos ou ficha alterados durante análise';end if;
  if octet_length((payload->'result')::text)>500000 then raise exception 'Análise excede o limite';end if;
  insert into public.pfpb_analyses(process_id,revision,result,created_by) values(pid,p.revision,payload->'result',auth.uid());
  insert into public.pfpb_events(process_id,action,actor_id,detail) values(pid,'Pré-análise executada',auth.uid(),jsonb_build_object('revision',p.revision));
 elsif op='form' then
  if (payload->>'revision')::integer is distinct from p.revision or payload->>'confirmed' is distinct from 'true' then raise exception 'Conferência da ficha e versão necessárias';end if;
  select count(*) into total from (select distinct on(kind) id,kind from public.pfpb_versions where process_id=pid order by kind,created_at desc) latest
  where (select decision from public.pfpb_reviews where version_id=latest.id order by created_at desc limit 1)='Aprovado';
  if total<>11 then raise exception 'Aprove as onze categorias na versão atual';end if;
  update public.pfpb_processes set formed_revision=revision,updated_at=now() where id=pid returning * into p;
  insert into public.pfpb_events(process_id,action,actor_id,detail) values(pid,'Processo formado após conferência humana',auth.uid(),jsonb_build_object('revision',p.revision));
 else raise exception 'Operação desconhecida';end if;
 return to_jsonb(p);
end $$;
create function public.pfpb_command(op text,pid uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select pfpb_private.command(op,pid,payload)$$;
revoke all on all functions in schema pfpb_private from public,anon;
grant execute on all functions in schema pfpb_private to authenticated;
revoke all on function public.pfpb_command(text,uuid,jsonb) from public,anon;
grant execute on function public.pfpb_command(text,uuid,jsonb) to authenticated;
DO $$ declare t text;begin foreach t in array array['pfpb_processes','pfpb_versions','pfpb_reviews','pfpb_analyses','pfpb_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy pfpb_read on public.%I for select to authenticated using (pfpb_private.can_access(%I))',t,case when t='pfpb_processes' then 'id' else 'process_id' end);
end loop;end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('pfpb-private','pfpb-private',false,20971520,array['application/pdf']);
create policy pfpb_storage_read on storage.objects for select to authenticated using(bucket_id='pfpb-private' and exists(select 1 from public.pfpb_versions v where v.storage_path=name and pfpb_private.can_access(v.process_id)));
create policy pfpb_storage_insert on storage.objects for insert to authenticated with check(bucket_id='pfpb-private' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and pfpb_private.can_access(((storage.foldername(name))[1])::uuid) and exists(select 1 from public.pfpb_processes p where p.id=((storage.foldername(name))[1])::uuid and p.deleted_at is null));
-- Sem UPDATE/DELETE no bucket: versão nova, nunca sobrescrever/apagar.
commit;
