-- Aditivo. SOMENTE staging. Requer RBAC base com rbk_private.actor_role/can_access_farm.
-- Não aplicar em produção. Sem alterações de políticas legadas ou de Credenciamento.
begin;
create schema aud_private;
revoke all on schema aud_private from public,anon,authenticated;
grant usage on schema aud_private to authenticated,service_role;
create table public.aud_audits (
 id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id),
 pharmacy text not null, cnpj text not null, reference text not null check(length(reference) between 1 and 200),
 requested integer check(requested between 0 and 100000), deadline date, notes text not null default '' check(length(notes)<=2000),
 collection text not null default 'open' check(collection in ('open','closed')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 next_batch integer not null default 1, max_bytes bigint not null default 5368709120,
 retention_days integer default null check(retention_days>0)
);
create table aud_private.links (
 id uuid primary key default gen_random_uuid(), audit_id uuid not null references public.aud_audits(id),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),expires_at timestamptz not null,
 revoked_at timestamptz,created_at timestamptz not null default now()
);
create unique index aud_one_active_link on aud_private.links(audit_id) where revoked_at is null;
create table public.aud_batches (
 id uuid primary key default gen_random_uuid(),audit_id uuid not null references public.aud_audits(id),
 number integer not null,client_key uuid not null,manifest jsonb not null,
 started_at timestamptz not null default now(),completed_at timestamptz,
 protocol text unique,unique(audit_id,number),unique(audit_id,client_key)
);
create table public.aud_files (
 id uuid primary key,audit_id uuid not null references public.aud_audits(id),batch_id uuid references public.aud_batches(id),
 source text not null default 'pharmacy' check(source in ('pharmacy','office')),
 created_at timestamptz not null default clock_timestamp(),
 check((source='pharmacy' and batch_id is not null) or (source='office' and batch_id is null)),
 filename text not null,size bigint not null check(size between 1 and 104857600),mime text not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),storage_path text not null unique,
 received_at timestamptz,scan text not null default 'pending' check(scan in ('pending','clean','infected','error','rejected')),
 verified_sha256 text,scanned_at timestamptz,scan_attempts integer not null default 0,next_scan_at timestamptz not null default now(),unique(audit_id,source,fingerprint)
);
create index on public.aud_audits(farm_id,created_at desc);
create index on public.aud_batches(audit_id,number);
create index on public.aud_files(batch_id);
create table public.aud_events (
 id bigint generated always as identity primary key,audit_id uuid not null references public.aud_audits(id),
 event text not null,actor_id uuid,entity_id uuid,created_at timestamptz not null default clock_timestamp()
);
create index on public.aud_events(audit_id,created_at);
create table public.aud_jobs (
 id uuid primary key default gen_random_uuid(),audit_id uuid not null references public.aud_audits(id),
 batch_id uuid not null unique references public.aud_batches(id),kind text not null default 'classify_new',
 status text not null default 'held' check(status='held'),created_at timestamptz not null default now()
);
create table aud_private.rates (key text primary key,window_start timestamptz not null default now(),hits integer not null default 1);
create index on aud_private.rates(window_start);
alter table aud_private.links enable row level security;
alter table aud_private.rates enable row level security;
create function aud_private.can_manage(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.uid() is not null and rbk_private.actor_role() in ('gestor_rbk','superadmin_rbk') and exists(
 select 1 from public.aud_audits a where a.id=aid and rbk_private.can_access_farm(a.farm_id)),false)
$$;
-- Boolean helper only. No read access to hidden token tables.
revoke all on function aud_private.can_manage(uuid) from public,anon;
grant execute on function aud_private.can_manage(uuid) to authenticated;
DO $$ declare t text;begin foreach t in array array['aud_audits','aud_batches','aud_files','aud_events','aud_jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy aud_read on public.%I for select to authenticated using (aud_private.can_manage(%I))',t,case when t='aud_audits' then 'id' else 'audit_id' end);
end loop;end $$;
create function aud_private.summary(aid uuid,internal boolean) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('audit',case when internal then to_jsonb(a) else jsonb_build_object('id',a.id,'pharmacy',a.pharmacy,'cnpj',a.cnpj,'reference',a.reference,'deadline',a.deadline,'collection',a.collection) end,
 'total_files',(select count(*) from public.aud_files f where f.audit_id=aid and f.source='pharmacy' and f.received_at is not null),
 'total_bytes',coalesce((select sum(size) from public.aud_files f where f.audit_id=aid and f.source='pharmacy' and f.received_at is not null),0),
 'last_received',(select max(completed_at) from public.aud_batches where audit_id=aid),
 'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'number',b.number,'started_at',b.started_at,'completed_at',b.completed_at,'protocol',b.protocol,
 'files',(select coalesce(jsonb_agg(case when internal then to_jsonb(f)-'fingerprint' else jsonb_build_object('id',f.id,'filename',f.filename,'size',f.size,'received_at',f.received_at) end order by f.filename),'[]') from public.aud_files f where f.batch_id=b.id)) order by b.number)
 from public.aud_batches b where b.audit_id=aid and (internal or b.completed_at is not null)),'[]'))
 from public.aud_audits a where a.id=aid
$$;
create function aud_private.manager(op text,aid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.aud_audits;farm public.farms;fid uuid;result jsonb;days integer;v public.aud_files;doc jsonb;ext text;mime text;obj storage.objects;
begin
 if auth.uid() is null or coalesce(rbk_private.actor_role(),'') not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso negado' using errcode='42501';end if;
 if op='farms' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.razao_social,'cnpj',f.cnpj) order by f.razao_social),'[]') from public.farms f where rbk_private.can_access_farm(f.id));
 elsif op='list' then
  return (select coalesce(jsonb_agg(jsonb_build_object('audit',to_jsonb(x),'total_files',(select count(*) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),'total_bytes',coalesce((select sum(size) from public.aud_files f where f.audit_id=x.id and f.source='pharmacy' and f.received_at is not null),0),'last_received',(select max(completed_at) from public.aud_batches where audit_id=x.id),'batches','[]'::jsonb) order by x.created_at desc),'[]') from (select * from public.aud_audits ax where aud_private.can_manage(ax.id) order by created_at desc,id limit 50 offset least(greatest(coalesce((payload->>'offset')::integer,0),0),100000)) x);
 elsif op='usage' then
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select ax.farm_id,ax.pharmacy,to_char(f.received_at at time zone 'America/Sao_Paulo','YYYY-MM') period,sum(f.size) bytes,count(*) files from public.aud_files f join public.aud_audits ax on ax.id=f.audit_id where f.received_at is not null and aud_private.can_manage(ax.id) group by ax.farm_id,ax.pharmacy,period order by period desc,ax.pharmacy limit 1000) x);
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
create function public.aud_manager(op text,aid uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aud_private.manager(op,aid,payload)$$;
revoke all on function aud_private.manager(text,uuid,jsonb) from public,anon;
grant execute on function aud_private.manager(text,uuid,jsonb) to authenticated;
revoke all on function public.aud_manager(text,uuid,jsonb) from public,anon;
grant execute on function public.aud_manager(text,uuid,jsonb) to authenticated;

-- Capability API is server-only. Browser anon/authenticated cannot invoke it.
create function aud_private.portal(h text,op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.aud_audits;l aud_private.links;b public.aud_batches;f public.aud_files;item jsonb;total bigint;count_files integer;sz bigint;ext text;expected_mime text;obj storage.objects;
begin
 -- Lock the audit first; close/revoke/renew serialize on this same row.
 select x.* into a from public.aud_audits x join aud_private.links k on k.audit_id=x.id where k.token_hash=h for update of x;
 if a.id is null then raise exception 'Link indisponível' using errcode='28000';end if;
 select * into l from aud_private.links where token_hash=h;
 if l.revoked_at is not null or l.expires_at<=clock_timestamp() or not exists(select 1 from public.farms where id=a.farm_id and status='active') then raise exception 'Link indisponível' using errcode='28000';end if;
 if op='summary' then
  insert into public.aud_events(audit_id,event) values(a.id,'portal_access');return aud_private.summary(a.id,false);
 end if;
 if a.collection<>'open' then raise exception 'Coleta encerrada';end if;
 if op='begin' then
  select * into b from public.aud_batches where audit_id=a.id and client_key=(payload->>'key')::uuid;
  if b.id is not null then
   if b.manifest is distinct from payload->'files' then raise exception 'Chave já usada por outro manifesto';end if;
  else
   if jsonb_typeof(payload->'files') is distinct from 'array' then raise exception 'Manifesto inválido';end if;
   count_files=jsonb_array_length(payload->'files');
   if count_files not between 1 and 100 then raise exception 'Envie entre 1 e 100 arquivos por lote';end if;
   if (select count(*) from public.aud_files where audit_id=a.id)+count_files>1000 then raise exception 'Limite de 1000 arquivos por auditoria';end if;
   total=0;
   for item in select * from jsonb_array_elements(payload->'files') loop
    sz=(item->>'size')::bigint;ext=lower(substring(item->>'name' from '[.]([a-zA-Z0-9]+)$'));
    expected_mime=case ext when 'pdf' then 'application/pdf' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg' when 'png' then 'image/png' when 'tif' then 'image/tiff' when 'tiff' then 'image/tiff' end;
    if sz is null or sz not between 1 and 104857600 or expected_mime is null or item->>'mime' is distinct from expected_mime or
     length(item->>'name') not between 1 and 180 or item->>'name' ~ '[[:cntrl:]/\\]' then raise exception 'Tipo, nome ou tamanho não permitido';end if;
    total=total+sz;
   end loop;
   if total>1073741824 or total+coalesce((select sum(size) from public.aud_files where audit_id=a.id),0)>a.max_bytes then raise exception 'Limite de armazenamento atingido';end if;
   insert into public.aud_batches(audit_id,number,client_key,manifest) values(a.id,a.next_batch,(payload->>'key')::uuid,payload->'files') returning * into b;
   update public.aud_audits set next_batch=next_batch+1 where id=a.id;
   for item in select * from jsonb_array_elements(payload->'files') loop
    insert into public.aud_files(id,audit_id,batch_id,filename,size,mime,fingerprint,storage_path)
    values((item->>'id')::uuid,a.id,b.id,item->>'name',(item->>'size')::bigint,item->>'mime',item->>'fingerprint',a.id::text||'/'||b.id::text||'/'||(item->>'id')||'.'||lower(substring(item->>'name' from '[.]([a-zA-Z0-9]+)$')));
   end loop;
   insert into public.aud_events(audit_id,event,entity_id) values(a.id,'batch_started',b.id);
  end if;
  return jsonb_build_object('id',b.id,'number',b.number,'files',(select jsonb_agg(jsonb_build_object('id',id,'filename',filename,'size',size)) from public.aud_files where batch_id=b.id));
 elsif op in ('ticket','failure') then
  select * into f from public.aud_files where id=(payload->>'file_id')::uuid and audit_id=a.id and source='pharmacy';
  if f.id is null then raise exception 'Arquivo indisponível';end if;
  if op='failure' then
   insert into public.aud_events(audit_id,event,entity_id) values(a.id,'upload_failure',f.id);return '{}';
  end if;
  if f.received_at is not null then raise exception 'Arquivo já recebido';end if;
  insert into public.aud_events(audit_id,event,entity_id) values(a.id,'upload_ticket',f.id);
  return jsonb_build_object('path',f.storage_path,'size',f.size,'mime',f.mime,'exists',exists(select 1 from storage.objects o where o.bucket_id='auditoria-private' and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.size and o.metadata->>'mimetype'=f.mime));
 elsif op='complete' then
  select * into b from public.aud_batches where id=(payload->>'batch_id')::uuid and audit_id=a.id;
  if b.id is null then raise exception 'Lote indisponível';end if;
  if b.completed_at is not null then return jsonb_build_object('protocol',b.protocol);end if;
  for f in select * from public.aud_files where batch_id=b.id loop
   select * into obj from storage.objects where bucket_id='auditoria-private' and name=f.storage_path;
   if obj.id is null or (obj.metadata->>'size')::bigint is distinct from f.size or obj.metadata->>'mimetype' is distinct from f.mime then raise exception 'Upload incompleto ou metadados divergentes';end if;
  end loop;
  update public.aud_files set received_at=clock_timestamp() where batch_id=b.id;
  update public.aud_batches set completed_at=clock_timestamp(),protocol='RBK-'||a.id::text||'-'||b.number::text where id=b.id returning * into b;
  insert into public.aud_events(audit_id,event,entity_id) select a.id,'file_received',id from public.aud_files where batch_id=b.id;
  insert into public.aud_events(audit_id,event,entity_id) values(a.id,'batch_completed',b.id);
  insert into public.aud_jobs(audit_id,batch_id) values(a.id,b.id);
  return jsonb_build_object('protocol',b.protocol);
 end if;
 raise exception 'Operação inválida';
end $$;
create function public.aud_portal(h text,op text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aud_private.portal(h,op,payload)$$;
create function aud_private.rate(k text,lim integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if length(k)>150 or lim not between 1 and 1000 then return false;end if;
 if k='portal:global' then delete from aud_private.rates where window_start<now()-interval '1 day';end if;
 insert into aud_private.rates(key) values(k) on conflict(key) do update set
 hits=case when aud_private.rates.window_start<now()-interval '1 minute' then 1 else aud_private.rates.hits+1 end,
 window_start=case when aud_private.rates.window_start<now()-interval '1 minute' then now() else aud_private.rates.window_start end returning hits into n;
 return n<=lim;
end $$;
create function public.aud_rate(k text,lim integer) returns boolean language sql security invoker set search_path='' as $$select aud_private.rate(k,lim)$$;
-- Scanner only updates verification state. It cannot change received documents.
create function aud_private.scan_result(fid uuid,result text,sha text) returns void language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 if result not in ('clean','infected','error','rejected') or sha is null or sha !~ '^[a-f0-9]{64}$' then raise exception 'Resultado inválido';end if;
 update public.aud_files set scan=result,verified_sha256=sha,scanned_at=clock_timestamp(),scan_attempts=scan_attempts+1,next_scan_at=now()+interval '15 minutes' where id=fid and received_at is not null and scan in ('pending','error') and (result<>'clean' or sha=fingerprint) returning audit_id into a;
 if a is null then raise exception 'Arquivo indisponível';end if;
 insert into public.aud_events(audit_id,event,entity_id) values(a,'scan_'||result,fid);
end $$;
create function public.aud_scan_result(fid uuid,result text,sha text) returns void language sql security invoker set search_path='' as $$select aud_private.scan_result(fid,result,sha)$$;
revoke all on function aud_private.summary(uuid,boolean) from public,anon,authenticated;
revoke all on function aud_private.portal(text,text,jsonb),public.aud_portal(text,text,jsonb),aud_private.rate(text,integer),public.aud_rate(text,integer),aud_private.scan_result(uuid,text,text),public.aud_scan_result(uuid,text,text) from public,anon,authenticated;
grant execute on function aud_private.portal(text,text,jsonb),public.aud_portal(text,text,jsonb),aud_private.rate(text,integer),public.aud_rate(text,integer),aud_private.scan_result(uuid,text,text),public.aud_scan_result(uuid,text,text) to service_role;
grant select on public.aud_files to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('auditoria-private','auditoria-private',false,104857600,array['application/pdf','text/html','image/jpeg','image/png','image/tiff']);
-- Sem INSERT/UPDATE/DELETE para anon/authenticated: uploads somente capabilities por objeto.
-- Downloads are signed server-side only after logged aud_manager authorization.
-- Restrictive policy also protects this bucket from overly broad legacy policies.
create policy aud_storage_no_browser on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'auditoria-private') with check(bucket_id<>'auditoria-private');
commit;
