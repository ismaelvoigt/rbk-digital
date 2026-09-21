create table public.cre_processes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 ficha jsonb not null default '{}', filial boolean not null default false, partners int not null default 1 check(partners between 1 and 4),
 revision int not null default 1, token_hash text unique, expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 rate_minute timestamptz, rate_count int not null default 0
);
create table public.cre_files (
 id uuid primary key, process_id uuid not null references public.cre_processes(id), kind int not null check(kind between 0 and 9),
 filename text not null, mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),
 size bigint not null check(size between 1 and 26214400), fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 storage_path text unique not null, created_at timestamptz not null default now(), received_at timestamptz,
 scan text not null default 'pending' check(scan in ('pending','clean','error','rejected','infected')),
 scan_attempts int not null default 0, scanned_at timestamptz, next_scan_at timestamptz not null default now(),
 unique(process_id,kind,fingerprint)
);
create table public.cre_events(id bigint generated always as identity primary key,process_id uuid references public.cre_processes(id), action text not null,created_at timestamptz not null default now());
alter table public.cre_processes enable row level security;
alter table public.cre_files enable row level security;
alter table public.cre_events enable row level security;
revoke all on public.cre_processes,public.cre_files,public.cre_events from anon,authenticated;
grant all on public.cre_processes,public.cre_files,public.cre_events to service_role;
grant usage,select on sequence public.cre_events_id_seq to service_role;
create index on public.cre_processes(owner_id);
create index on public.cre_files(process_id);
create index on public.cre_events(process_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('credenciamento-private','credenciamento-private',false,26214400,array['application/pdf','image/png','image/jpeg']);
create function public.cre_command(op text, actor uuid default null, h text default null, pid uuid default null, payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.cre_processes; f public.cre_files; snap jsonb; total bigint; size_actual bigint;
begin
 if actor is not null then
  if not exists(select 1 from public.users u where u.id=actor and u.status='active' and (u.perfil='gestor_rbk' or exists(select 1 from public.rbk_admins a where a.user_id=actor and a.ativo))) then raise exception 'Acesso negado'; end if;
  if op='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'ficha',ficha,'updated_at',updated_at,'expires_at',expires_at) order by updated_at desc) from public.cre_processes where owner_id=actor),'[]');end if;
  if op='create' then
   insert into public.cre_processes(owner_id,ficha,filial,token_hash,expires_at) values(actor,payload->'ficha',(payload->>'filial')::boolean,payload->>'hash',now()+interval '40 days') returning * into p;
   insert into public.cre_events(process_id,action) values(p.id,'created');
   return jsonb_build_object('id',p.id);
  end if;
  select * into p from public.cre_processes where id=pid and owner_id=actor for update;
 else
  select * into p from public.cre_processes where token_hash=h and expires_at>now() for update;
 end if;
 if p.id is null then raise exception 'Acesso indisponível';end if;
 if actor is null then
  if p.rate_minute=date_trunc('minute',now()) and p.rate_count>=120 then raise exception 'Aguarde para tentar novamente';end if;
  update public.cre_processes set rate_minute=date_trunc('minute',now()),rate_count=case when rate_minute=date_trunc('minute',now()) then rate_count+1 else 1 end where id=p.id;
 end if;
 if op='renew' or op='revoke' then
  if actor is null then raise exception 'Acesso negado';end if;
  update public.cre_processes set token_hash=case when op='renew' then payload->>'hash' else null end,expires_at=case when op='renew' then now()+interval '40 days' else null end where id=p.id;
 elsif op='save' then
  if p.revision<>(payload->>'revision')::int then raise exception 'Ficha alterada. Atualize antes de salvar';end if;
  update public.cre_processes set ficha=payload->'ficha',filial=(payload->>'filial')::boolean,partners=(payload->>'partners')::int,revision=revision+1,updated_at=now() where id=p.id;
 elsif op='init' then
  select * into f from public.cre_files where process_id=p.id and kind=(payload->>'kind')::int and fingerprint=payload->>'fingerprint';
  if f.id is null then
   select coalesce(sum(size),0) into total from public.cre_files where process_id=p.id;
   if total+(payload->>'size')::bigint>209715200 or (select count(*) from public.cre_files where process_id=p.id)>=200 then raise exception 'Limite de armazenamento alcançado';end if;
   insert into public.cre_files(id,process_id,kind,filename,mime,size,fingerprint,storage_path) values((payload->>'id')::uuid,p.id,(payload->>'kind')::int,payload->>'name',payload->>'mime',(payload->>'size')::bigint,payload->>'fingerprint',p.id::text||'/'||(payload->>'id')) returning * into f;
  end if;
  return to_jsonb(f);
 elsif op='confirm' or op='file' then
  select * into f from public.cre_files where id=(payload->>'id')::uuid and process_id=p.id for update;
  if f.id is null then raise exception 'Arquivo indisponível';end if;
  if op='file' then
   if actor is null or f.received_at is null or f.scan in ('infected','rejected') then raise exception 'Arquivo indisponível ou bloqueado';end if;
   return to_jsonb(f);
  end if;
  select (metadata->>'size')::bigint into size_actual from storage.objects where bucket_id='credenciamento-private' and name=f.storage_path;
  if size_actual is distinct from f.size then raise exception 'Envio não confirmado. Repita o envio';end if;
  update public.cre_files set received_at=coalesce(received_at,now()) where id=f.id;
  update public.cre_processes set updated_at=now() where id=p.id;
 elsif op<>'get' then raise exception 'Operação inválida';end if;
 insert into public.cre_events(process_id,action) values(p.id,op);
 select jsonb_build_object('id',id,'ficha',ficha,'filial',filial,'partners',partners,'revision',revision,'expires_at',expires_at) into snap from public.cre_processes where id=p.id;
 return snap||jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'filename',filename,'size',size,'received_at',received_at,'scan',case when actor is null then null else scan end) order by created_at,id) from public.cre_files where process_id=p.id and received_at is not null),'[]'));
end $$;
revoke all on function public.cre_command(text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cre_command(text,uuid,text,uuid,jsonb) to service_role;
