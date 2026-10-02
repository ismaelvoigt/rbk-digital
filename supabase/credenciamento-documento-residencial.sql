-- Aplicar antes de publicar a versão com Documento Residencial.
-- Preserva os códigos e os documentos existentes. Não altera permissões.
begin;
alter table public.cre_files drop constraint cre_files_kind_check;
alter table public.cre_files add constraint cre_files_kind_check check(kind between 0 and 10);
alter table public.pfpb_versions drop constraint pfpb_versions_kind_check;
alter table public.pfpb_versions add constraint pfpb_versions_kind_check
 check(kind in ('cnpj','contrato_social','endereco','licenca_sanitaria','afe','cnd','crt','representante','residencial','rt','banco','rta'));
create or replace function pfpb_private.command(op text,pid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if total<>12 then raise exception 'Aprove as doze categorias na versão atual';end if;
  update public.pfpb_processes set formed_revision=revision,updated_at=now() where id=pid returning * into p;
  insert into public.pfpb_events(process_id,action,actor_id,detail) values(pid,'Processo formado após conferência humana',auth.uid(),jsonb_build_object('revision',p.revision));
 else raise exception 'Operação desconhecida';end if;
 return to_jsonb(p);
end $$;
commit;
