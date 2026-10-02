-- Additive change: master pharmacy stays unique; process IDs/history stay independent.
-- Production inspection found no CNPJ UNIQUE constraints on operational tables.
begin;
create or replace function public.cadastro_farmacia_cnpj(p_actor uuid, payload jsonb, p_create boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.farms; c text; created boolean:=false;
begin
 if not exists(select 1 from public.rbk_admins a join public.users u on u.id=a.user_id
   where a.user_id=p_actor and a.ativo and u.status='active') then
   raise exception 'Acesso negado' using errcode='42501';
 end if;
 c:=regexp_replace(upper(coalesce(payload->>'cnpj','')),'[./[:space:]-]','','g');
 if c !~ '^[A-Z0-9]{12}[0-9]{2}$' then raise exception 'CNPJ inválido' using errcode='22023';end if;
 -- Shared with audit registration to serialize creation of the same master.
 perform pg_advisory_xact_lock(hashtextextended('audit-farm:'||c,0));
 select * into f from public.farms where regexp_replace(upper(cnpj),'[./[:space:]-]','','g')=c order by id limit 1;
 if f.id is null and p_create then
   if length(trim(coalesce(payload->>'razao_social','')))<1 then raise exception 'Razão social obrigatória';end if;
   insert into public.farms(cnpj,razao_social,nome_fantasia,telefone,cidade,estado,status)
   values(c,trim(payload->>'razao_social'),nullif(trim(payload->>'nome_fantasia'),''),nullif(trim(payload->>'telefone'),''),
     nullif(trim(payload->>'cidade'),''),nullif(upper(trim(payload->>'estado')),''),'active') returning * into f;
   created:=true;
 end if;
 return jsonb_build_object('farm',case when f.id is null then null else to_jsonb(f) end,'created',created);
end $$;
revoke all on function public.cadastro_farmacia_cnpj(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.cadastro_farmacia_cnpj(uuid,jsonb,boolean) to service_role;

-- Nullable association preserves pre-registration invitations and their original ficha.
alter table public.cre_processes add column if not exists farm_id uuid references public.farms(id) on delete set null;
create index if not exists cre_processes_farm_id_idx on public.cre_processes(farm_id);
create or replace function public.cre_associate_farm() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 select case when count(*)=1 then (array_agg(f.id))[1] else null end into new.farm_id
 from public.farms f where regexp_replace(upper(f.cnpj),'[./[:space:]-]','','g')=
 regexp_replace(upper(coalesce(nullif(new.ficha->>'B20',''),new.ficha->>'B19','')),'[./[:space:]-]','','g');
 return new;
end $$;
revoke all on function public.cre_associate_farm() from public,anon,authenticated;
create trigger cre_associate_farm before insert or update of ficha on public.cre_processes
for each row execute function public.cre_associate_farm();
update public.cre_processes p set farm_id=(
 select case when count(*)=1 then (array_agg(f.id))[1] else null end from public.farms f
 where regexp_replace(upper(f.cnpj),'[./[:space:]-]','','g')=
 regexp_replace(upper(coalesce(nullif(p.ficha->>'B20',''),p.ficha->>'B19','')),'[./[:space:]-]','','g'))
where p.farm_id is null;

-- A credential can predate the pharmacy's first login registration.
create or replace function public.cre_associate_new_farm() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 update public.cre_processes p set farm_id=new.id
 where p.farm_id is null and
   regexp_replace(upper(coalesce(nullif(p.ficha->>'B20',''),p.ficha->>'B19','')),'[./[:space:]-]','','g')=
   regexp_replace(upper(new.cnpj),'[./[:space:]-]','','g');
 return new;
end $$;
revoke all on function public.cre_associate_new_farm() from public,anon,authenticated;
create trigger cre_associate_new_farm after insert on public.farms
for each row execute function public.cre_associate_new_farm();

create or replace function aud_private.manager(op text,aid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.aud_audits;farm public.farms;fid uuid;result jsonb;days integer;v public.aud_files;doc jsonb;ext text;mime text;obj storage.objects;
begin
 if auth.uid() is null or coalesce(rbk_private.actor_role(),'') not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso negado' using errcode='42501';end if;
 if op='farms' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.razao_social,'cnpj',f.cnpj) order by f.razao_social),'[]') from public.farms f where rbk_private.can_access_farm(f.id));
 elsif op='list' then
  payload:=jsonb_set(payload,'{cnpj}',to_jsonb(regexp_replace(upper(coalesce(payload->>'cnpj','')),'[./[:space:]-]','','g')));
  if payload->>'cnpj' !~ '^[A-Z0-9]{0,14}$' then raise exception 'Pesquisa de CNPJ inválida.' using errcode='22023';end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('audit',to_jsonb(x),'can_delete',not exists(select 1 from public.aud_batches b where b.audit_id=x.id) and not exists(select 1 from public.aud_files f where f.audit_id=x.id and f.source='pharmacy'),'total_files',(select count(*) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),'total_bytes',coalesce((select sum(size) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),0),'last_received',(select max(completed_at) from public.aud_batches where audit_id=x.id),'batches','[]'::jsonb) order by x.created_at desc),'[]') from (select * from public.aud_audits ax where aud_private.can_manage(ax.id) and (coalesce(payload->>'cnpj','')='' or regexp_replace(upper(ax.cnpj),'[./[:space:]-]','','g') like (payload->>'cnpj')||'%') order by created_at desc,id limit 50 offset least(greatest(coalesce((payload->>'offset')::integer,0),0),100000)) x);
 elsif op='usage' then
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select ax.farm_id,ax.pharmacy,to_char(f.received_at at time zone 'America/Sao_Paulo','YYYY-MM') period,sum(f.size) bytes,count(*) files from public.aud_files f join public.aud_audits ax on ax.id=f.audit_id where f.received_at is not null and rbk_private.can_access_farm(ax.farm_id) group by ax.farm_id,ax.pharmacy,period order by period desc,ax.pharmacy limit 1000) x);
 elsif op='create' then
  fid=(payload->>'farm_id')::uuid;
  if not coalesce(rbk_private.can_access_farm(fid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
  select * into strict farm from public.farms where id=fid;
  perform pg_advisory_xact_lock(hashtextextended('audit-process:'||fid::text,0));
  if payload->>'check_duplicate'='true' and coalesce(payload->>'confirm_duplicate','false')<>'true'
     and exists(select 1 from public.aud_audits where farm_id=fid and collection='open' and deleted_at is null) then
    return jsonb_build_object('confirmation_required',true,'message','Já existe uma auditoria em andamento para este CNPJ. Deseja criar uma nova mesmo assim?');
  end if;
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

create or replace function public.aud_register_pharmacy(payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 r:=aud_private.register_pharmacy_audit(payload);
 if r->>'id' is not null and payload ? 'contact' then perform aud_private.save_contact((r->>'id')::uuid,payload->'contact');end if;
 return r;
end $$;
create or replace function public.cre_command(op text, actor uuid default null, h text default null, pid uuid default null, payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.cre_processes; f public.cre_files; snap jsonb; total bigint; size_actual bigint;
begin
 if actor is not null then
  if not exists(select 1 from public.users u where u.id=actor and u.status='active' and (u.perfil='gestor_rbk' or exists(select 1 from public.rbk_admins a where a.user_id=actor and a.ativo))) then raise exception 'Acesso negado'; end if;
  if op='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'ficha',ficha,'updated_at',updated_at,'expires_at',expires_at) order by updated_at desc) from public.cre_processes where owner_id=actor),'[]');end if;
  if op='create' then
   perform pg_advisory_xact_lock(hashtextextended('cre-process:'||actor::text||':'||regexp_replace(upper(coalesce(payload->'ficha'->>'B20','')),'[./[:space:]-]','','g'),0));
   if payload->>'check_duplicate'='true' and coalesce(payload->>'confirm_duplicate','false')<>'true' and exists(
     select 1 from public.cre_processes x where x.owner_id=actor and x.token_hash is not null and x.expires_at>now()
       and regexp_replace(upper(coalesce(x.ficha->>'B20','')),'[./[:space:]-]','','g')=
           regexp_replace(upper(coalesce(payload->'ficha'->>'B20','')),'[./[:space:]-]','','g')) then
     return jsonb_build_object('confirmation_required',true,'message','Já existe um credenciamento em andamento para este CNPJ. Deseja criar um novo mesmo assim?');
   end if;
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

commit;
