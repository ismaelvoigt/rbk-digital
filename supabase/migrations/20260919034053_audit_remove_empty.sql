-- Staging only: remove empty audits from the portfolio, retaining office/history.
-- No physical DELETE and no removal of the pharmacy's master record.
begin;
alter table public.aud_audits add column deleted_at timestamptz,add column deleted_by uuid references auth.users(id);
create or replace function aud_private.can_manage(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.uid() is not null and rbk_private.actor_role() in ('gestor_rbk','superadmin_rbk') and exists(
 select 1 from public.aud_audits a where a.id=aid and a.deleted_at is null and rbk_private.can_access_farm(a.farm_id)),false)
$$;
create or replace function aud_private.manager(op text,aid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.aud_audits;farm public.farms;fid uuid;result jsonb;days integer;v public.aud_files;doc jsonb;ext text;mime text;obj storage.objects;
begin
 if auth.uid() is null or coalesce(rbk_private.actor_role(),'') not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso negado' using errcode='42501';end if;
 if op='farms' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.razao_social,'cnpj',f.cnpj) order by f.razao_social),'[]') from public.farms f where rbk_private.can_access_farm(f.id));
 elsif op='list' then
  return (select coalesce(jsonb_agg(jsonb_build_object('audit',to_jsonb(x),'can_delete',not exists(select 1 from public.aud_batches b where b.audit_id=x.id) and not exists(select 1 from public.aud_files f where f.audit_id=x.id and f.source='pharmacy'),'total_files',(select count(*) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),'total_bytes',coalesce((select sum(size) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),0),'last_received',(select max(completed_at) from public.aud_batches where audit_id=x.id),'batches','[]'::jsonb) order by x.created_at desc),'[]') from (select * from public.aud_audits ax where aud_private.can_manage(ax.id) order by created_at desc,id limit 50 offset least(greatest(coalesce((payload->>'offset')::integer,0),0),100000)) x);
 elsif op='usage' then
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select ax.farm_id,ax.pharmacy,to_char(f.received_at at time zone 'America/Sao_Paulo','YYYY-MM') period,sum(f.size) bytes,count(*) files from public.aud_files f join public.aud_audits ax on ax.id=f.audit_id where f.received_at is not null and rbk_private.can_access_farm(ax.farm_id) group by ax.farm_id,ax.pharmacy,period order by period desc,ax.pharmacy limit 1000) x);
 elsif op='create' then
  fid=(payload->>'farm_id')::uuid;
  if not coalesce(rbk_private.can_access_farm(fid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
  select * into strict farm from public.farms where id=fid;
  insert into public.aud_audits(farm_id,pharmacy,cnpj,reference,requested,deadline,notes,created_by)
  values(fid,farm.razao_social,farm.cnpj,trim(payload->>'reference'),(payload->>'requested')::integer,(payload->>'deadline')::date,coalesce(payload->>'notes',''),auth.uid()) returning * into a;
  insert into public.aud_events(audit_id,event,actor_id) values(a.id,'audit_created',auth.uid());return to_jsonb(a);
 end if;
 if not aud_private.can_manage(aid) then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into strict a from public.aud_audits where id=aid for update;
 if a.deleted_at is not null then raise exception 'Auditoria excluída da carteira.' using errcode='42501';end if;
 if op='delete_empty' then
  if exists(select 1 from public.aud_batches where audit_id=aid) or exists(select 1 from public.aud_files where audit_id=aid and source='pharmacy') then
   raise exception 'Não é possível excluir: a farmácia já iniciou ou concluiu um envio.' using errcode='22023';
  end if;
  update public.aud_audits set deleted_at=clock_timestamp(),deleted_by=auth.uid(),collection='closed' where id=aid;
  update aud_private.links set revoked_at=clock_timestamp() where audit_id=aid and revoked_at is null;
  insert into public.aud_events(audit_id,event,actor_id) values(aid,'audit_removed_empty',auth.uid());
  return jsonb_build_object('removed',true);
 end if;
 if op='detail' then
  return aud_private.summary(aid,true)||jsonb_build_object('offices',(select coalesce(jsonb_agg(to_jsonb(af)-'fingerprint' order by af.created_at desc),'[]') from public.aud_files af where af.audit_id=aid and af.source='office'),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]') from public.aud_events e where e.audit_id=aid),
  'link',(select jsonb_build_object('expires_at',l.expires_at,'revoked_at',l.revoked_at) from aud_private.links l where l.audit_id=aid order by l.created_at desc limit 1));
 elsif op in ('close','reopen') then
  update public.aud_audits set collection=case when op='close' then 'closed' else 'open' end where id=aid;
 elsif op='link' then
  days=(payload->>'days')::integer;
  if days is null or days not between 1 and 90 or payload->>'hash' is null then raise exception 'Validade inválida';end if;
  update aud_private.links set revoked_at=clock_timestamp() where audit_id=aid and revoked_at is null;
  insert into aud_private.links(audit_id,token_hash,expires_at) values(aid,payload->>'hash',now()+make_interval(days=>days));
 elsif op='revoke' then
  update aud_private.links set revoked_at=clock_timestamp() where audit_id=aid and revoked_at is null;
 elsif op='office_begin' then
  doc=payload->'file';ext=lower(substring(doc->>'name' from '[.]([a-zA-Z0-9]+)$'));
  mime=case ext when 'html' then 'text/html' when 'htm' then 'text/html' when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'png' then 'image/png' when 'tif' then 'image/tiff' when 'tiff' then 'image/tiff' end;
  if doc is null or (doc->>'size')::bigint is null or (doc->>'size')::bigint not between 1 and 104857600 or mime is null or doc->>'mime' is distinct from mime or length(doc->>'name') not between 1 and 180 or doc->>'name' ~ '[[:cntrl:]/\\]' then raise exception 'Ofício inválido';end if;
  select * into v from public.aud_files where audit_id=aid and source='office' and fingerprint=doc->>'fingerprint';
  if v.id is null then
   if (select count(*) from public.aud_files where audit_id=aid and source='office')>=50 or (doc->>'size')::bigint+coalesce((select sum(size) from public.aud_files where audit_id=aid),0)>a.max_bytes then raise exception 'Limite de armazenamento atingido';end if;
   insert into public.aud_files(id,audit_id,batch_id,source,filename,size,mime,fingerprint,storage_path)
   values((doc->>'id')::uuid,aid,null,'office',doc->>'name',(doc->>'size')::bigint,mime,doc->>'fingerprint',aid::text||'/oficios/'||(doc->>'id')||'.'||ext) returning * into v;
  end if;
  result=jsonb_build_object('id',v.id,'path',v.storage_path,'mime',v.mime,'exists',exists(select 1 from storage.objects o where o.bucket_id='auditoria-private' and o.name=v.storage_path and (o.metadata->>'size')::bigint=v.size and o.metadata->>'mimetype'=v.mime));
 elsif op='office_complete' then
  select * into v from public.aud_files where audit_id=aid and source='office' and id=(payload->>'file_id')::uuid;
  if v.id is null then raise exception 'Ofício indisponível';end if;
  if v.received_at is not null then return to_jsonb(v);end if;
  select * into obj from storage.objects where bucket_id='auditoria-private' and name=v.storage_path;
  if obj.id is null or (obj.metadata->>'size')::bigint is distinct from v.size or obj.metadata->>'mimetype' is distinct from v.mime then raise exception 'Upload incompleto ou metadados divergentes';end if;
  update public.aud_files set received_at=clock_timestamp() where id=v.id returning * into v;
  result=to_jsonb(v)-'fingerprint';
 elsif op='download' then
  select jsonb_build_object('path',f.storage_path,'filename',f.filename) into result from public.aud_files f
  where f.audit_id=aid and f.id=(payload->>'file_id')::uuid and f.scan='clean' and f.received_at is not null;
  if result is null then raise exception 'Arquivo indisponível ou aguardando verificação de segurança';end if;
 else raise exception 'Operação inválida';end if;
 insert into public.aud_events(audit_id,event,actor_id,entity_id) values(aid,op,auth.uid(),(payload->>'file_id')::uuid);
 return coalesce(result,aud_private.summary(aid,true));
end $$;
commit;
