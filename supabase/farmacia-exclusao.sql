-- Service-only, resumable deletion. Storage bytes are removed through its API, never SQL.
create schema if not exists rbk_private;
create table rbk_private.farm_deletions (
 farm_id uuid primary key, actor_id uuid not null, cnpj text not null,
 summary jsonb not null, entity_ids uuid[] not null, user_ids uuid[] not null,
 audit_ids uuid[] not null, credential_ids uuid[] not null,
 objects jsonb not null, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table rbk_private.farm_deletions enable row level security;
revoke all on rbk_private.farm_deletions from public,anon,authenticated;

create or replace function rbk_private.deletion_row_blocked(r jsonb) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from rbk_private.farm_deletions j where
   exists(select 1 from jsonb_each_text(r) kv where kv.key in
     ('id','farm_id','user_id','owner_id','owner','created_by','deleted_by','manager_user_id','granted_by','uploaded_by','atualizado_por','autorizacao_id','authorization_id','document_id','documento_id','client_id','audit_id','batch_id','process_id','credential_id')
     and kv.value=any(j.entity_ids::text[]))
   or exists(select 1 from jsonb_array_elements(j.objects) obj
     where obj->>'name'=r->>'caminho_arquivo' or obj->>'name'=r->>'storage_path')
   or (r ? 'bucket_id' and (
     exists(select 1 from jsonb_array_elements(j.objects) o where o->>'bucket'=r->>'bucket_id' and o->>'name'=r->>'name')
     or string_to_array(r->>'name','/') && j.entity_ids::text[])))
$$;
revoke all on function rbk_private.deletion_row_blocked(jsonb) from public,anon,authenticated;

create or replace function rbk_private.deletion_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Shared writer lock and exclusive prepare/finalize lock close the eligibility/upload race.
 perform pg_advisory_xact_lock_shared(92836211);
 if rbk_private.deletion_row_blocked(to_jsonb(new)) or
    (tg_op='UPDATE' and rbk_private.deletion_row_blocked(to_jsonb(old))) then
   raise exception 'Farmácia em exclusão definitiva. Não é permitido alterar seus dados.' using errcode='P0001';
 end if;
 return new;
end $$;
revoke all on function rbk_private.deletion_guard() from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['public.farms','public.users','public.rbk_admins','public.rbk_manager_farms',
 'public.autorizacoes','public.documentos','public.dispensacao_itens','public.clients',
 'public.authorizations','public.documents','public.document_versions','public.compras_estoque',
 'public.aud_events','public.cre_events','public.aud_audits','public.aud_files','public.aud_batches','public.aud_jobs','aud_private.links',
 'public.cre_processes','public.cre_files','public.invitation_deliveries','auth.users','auth.sessions','storage.objects'] loop
 execute format('create trigger farmacia_deletion_guard before insert or update on %s for each row execute function rbk_private.deletion_guard()',t);
 end loop;
end $$;

create or replace function rbk_private.farmacia_exclusao(p_actor uuid,p_farm uuid,p_action text,p_cnpj text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 f public.farms; j rbk_private.farm_deletions;
 uids uuid[]; aids uuid[]; cids uuid[]; entities uuid[]; paths jsonb; pending_objects jsonb;
 never_accessed boolean; doc_count integer; auth_count integer; summary jsonb; blocked text;
begin
 if not exists(select 1 from public.rbk_admins a join public.users u on u.id=a.user_id
   where a.user_id=p_actor and a.ativo and u.status='active') then
   raise exception 'Acesso restrito aos administradores ativos do RBK Digital.';
 end if;
 if p_action not in ('preview','prepare','finish') then raise exception 'Operação inválida.'; end if;
 if p_action<>'preview' then perform pg_advisory_xact_lock(92836211); end if;
 select * into j from rbk_private.farm_deletions where farm_id=p_farm;
 if found then
   if p_action<>'preview' and regexp_replace(coalesce(p_cnpj,''),'\D','','g')<>j.cnpj then raise exception 'Digite o CNPJ correto para confirmar.'; end if;
   if j.completed_at is not null then return j.summary || jsonb_build_object('completed',true,'pending',false); end if;
   select coalesce(jsonb_agg(o),'[]') into pending_objects from
     (select obj from jsonb_array_elements(j.objects) obj where exists(select 1 from storage.objects s where s.bucket_id=obj->>'bucket' and s.name=obj->>'name') limit 200) q(o);
   if p_action<>'finish' or jsonb_array_length(pending_objects)>0 then
     return j.summary || jsonb_build_object('pending',true,'objects',pending_objects);
   end if;
   -- All actual objects have been removed. Referential cleanup is one atomic transaction.
   delete from public.invitation_deliveries where audit_id=any(j.audit_ids) or credential_id=any(j.credential_ids);
   delete from public.aud_jobs where audit_id=any(j.audit_ids);
   delete from public.aud_files where audit_id=any(j.audit_ids);
   delete from public.aud_events where audit_id=any(j.audit_ids);
   delete from aud_private.links where audit_id=any(j.audit_ids);
   delete from public.aud_batches where audit_id=any(j.audit_ids);
   delete from public.aud_audits where id=any(j.audit_ids);
   delete from public.cre_files where process_id=any(j.credential_ids);
   delete from public.cre_events where process_id=any(j.credential_ids);
   delete from public.cre_processes where id=any(j.credential_ids);
   delete from public.dispensacao_itens where autorizacao_id in (select id from public.autorizacoes where user_id=any(j.user_ids));
   delete from public.documentos where autorizacao_id in (select id from public.autorizacoes where user_id=any(j.user_ids));
   delete from public.autorizacoes where user_id=any(j.user_ids);
   delete from public.document_versions where document_id in (select d.id from public.documents d join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm);
   delete from public.documents where authorization_id in (select id from public.authorizations where farm_id=p_farm);
   delete from public.authorizations where farm_id=p_farm;
   delete from public.clients where farm_id=p_farm;
   delete from public.compras_estoque where farm_id=p_farm;
   delete from public.audit_logs where farm_id=p_farm;
   delete from public.rbk_manager_farms where farm_id=p_farm;
   delete from public.users where farm_id=p_farm;
   delete from auth.users where id=any(j.user_ids);
   delete from public.farms where id=p_farm;
   update rbk_private.farm_deletions set completed_at=now() where farm_id=p_farm;
   return j.summary || jsonb_build_object('completed',true,'pending',false);
 end if;
 if p_action='finish' then raise exception 'A exclusão ainda não foi confirmada.'; end if;
 select * into f from public.farms where id=p_farm;
 if not found then raise exception 'Farmácia não encontrada.'; end if;
 select coalesce(array_agg(id),'{}') into uids from public.users where farm_id=p_farm;
 if p_action='prepare' and (length(regexp_replace(coalesce(p_cnpj,''),'\D','','g'))<>14 or regexp_replace(p_cnpj,'\D','','g')<>regexp_replace(f.cnpj,'\D','','g')) then
   raise exception 'Digite o CNPJ correto para confirmar.';
 end if;
 select coalesce(array_agg(id),'{}') into aids from public.aud_audits where farm_id=p_farm;
 select coalesce(array_agg(id),'{}') into cids from public.cre_processes where owner_id=any(uids);
 select array_agg(distinct id) into entities from (
   select p_farm id union select unnest(uids) union select unnest(aids) union select unnest(cids)
   union select id from public.autorizacoes where user_id=any(uids)
   union select d.id from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id where a.user_id=any(uids)
   union select id from public.aud_batches where audit_id=any(aids)
   union select id from public.clients where farm_id=p_farm
   union select id from public.authorizations where farm_id=p_farm
   union select d.id from public.documents d join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm
   union select v.id from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm
 ) ids;
 -- Includes dangling file references and uploads which have not yet been attached to a document.
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'name',name)),'[]') into paths from (
   select 'documentos' bucket,d.caminho_arquivo name from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id where a.user_id=any(uids) and nullif(d.caminho_arquivo,'') is not null
   union select 'documentos',v.storage_path from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id=p_farm and nullif(v.storage_path,'') is not null
   union select 'auditoria-private',storage_path from public.aud_files where audit_id=any(aids) and nullif(storage_path,'') is not null
   union select 'credenciamento-private',storage_path from public.cre_files where process_id=any(cids) and nullif(storage_path,'') is not null
   union select bucket_id,name from storage.objects where owner=any(uids) or owner_id=any(uids::text[]) or (bucket_id='documentos' and split_part(name,'/',1)=any(uids::text[])) or (bucket_id='auditoria-private' and split_part(name,'/',1)=any(aids::text[])) or (bucket_id='credenciamento-private' and split_part(name,'/',1)=any(cids::text[]))
 ) files;
 doc_count:=jsonb_array_length(paths);
 select not exists(select 1 from public.users u join auth.users a on a.id=u.id
   where u.farm_id=p_farm and (u.last_access_at is not null or a.last_sign_in_at is not null)) into never_accessed;
 select count(*) into auth_count from public.autorizacoes where user_id=any(uids);
 if p_actor=any(uids) or exists(select 1 from public.rbk_admins where user_id=any(uids))
   or exists(select 1 from public.users where id=any(uids) and perfil not in ('farmacia','operador','administrador_farmacia'))
   or exists(select 1 from public.rbk_manager_farms where manager_user_id=any(uids) or granted_by=any(uids)) then
   blocked:='Não é permitido excluir a própria conta ou uma farmácia com vínculos administrativos.';
 elsif exists(select 1 from public.aud_audits where id<>all(aids) and (created_by=any(uids) or deleted_by=any(uids)))
   or exists(select 1 from public.authorizations where farm_id<>p_farm and client_id in (select id from public.clients where farm_id=p_farm))
   or exists(select 1 from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id<>p_farm and v.uploaded_by=any(uids))
   or exists(select 1 from public.dispensacao_itens i join public.autorizacoes a on a.id=i.autorizacao_id where a.user_id<>all(uids) and i.documento_id in (select d.id from public.documentos d join public.autorizacoes da on da.id=d.autorizacao_id where da.user_id=any(uids)))
   or exists(select 1 from public.aud_files af join public.aud_batches b on b.id=af.batch_id where b.audit_id=any(aids) and af.audit_id<>all(aids))
   or exists(select 1 from public.aud_jobs aj join public.aud_batches b on b.id=aj.batch_id where b.audit_id=any(aids) and aj.audit_id<>all(aids)) then
   blocked:='Há vínculos com outra farmácia. Revise esses vínculos antes de excluir.';
 elsif exists(select 1 from (
   select 'documentos' bucket,caminho_arquivo name from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id where a.user_id<>all(uids)
   union all select 'documentos',storage_path from public.document_versions v join public.documents d on d.id=v.document_id join public.authorizations a on a.id=d.authorization_id where a.farm_id<>p_farm
   union all select 'auditoria-private',storage_path from public.aud_files where audit_id<>all(aids)
   union all select 'credenciamento-private',storage_path from public.cre_files where process_id<>all(cids)
 ) external_file where exists(select 1 from jsonb_array_elements(paths) p where p->>'bucket'=external_file.bucket and p->>'name'=external_file.name)) then
   blocked:='Há arquivos compartilhados com outra farmácia. Revise esses vínculos antes de excluir.';
 elsif not never_accessed and doc_count>0 then
   blocked:='Esta farmácia já acessou e possui documentos enviados. Utilize Inativar farmácia para preservar o histórico.';
 end if;
 summary:=jsonb_build_object('farm_id',p_farm,'name',coalesce(nullif(f.nome_fantasia,''),f.razao_social),'cnpj',f.cnpj,
   'eligible',blocked is null,'reason',blocked,'never_accessed',never_accessed,'documents',doc_count,
   'users',cardinality(uids),'authorizations',auth_count,'audits',cardinality(aids),'credentials',cardinality(cids),'pending',false,'completed',false);
 if p_action='preview' then return summary; end if;
 if blocked is not null then raise exception '%',blocked; end if;
 -- Freeze access before publishing the tombstone used by all writer guards.
 update public.farms set status='inactive' where id=p_farm;
 update public.users set status='inactive' where farm_id=p_farm;
 update auth.users set banned_until=now()+interval '100 years' where id=any(uids);
 delete from auth.sessions where user_id=any(uids);
 insert into rbk_private.farm_deletions(farm_id,actor_id,cnpj,summary,entity_ids,user_ids,audit_ids,credential_ids,objects)
 values(p_farm,p_actor,regexp_replace(f.cnpj,'\D','','g'),summary,entities,uids,aids,cids,paths);
 return rbk_private.farmacia_exclusao(p_actor,p_farm,'prepare',p_cnpj);
end $$;
revoke all on function rbk_private.farmacia_exclusao(uuid,uuid,text,text) from public,anon,authenticated;

create or replace function public.farmacia_exclusao(p_actor uuid,p_farm uuid,p_action text default 'preview',p_cnpj text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select rbk_private.farmacia_exclusao(p_actor,p_farm,p_action,p_cnpj)
$$;
revoke all on function public.farmacia_exclusao(uuid,uuid,text,text) from public,anon,authenticated;
grant usage on schema rbk_private to service_role;
grant execute on function rbk_private.farmacia_exclusao(uuid,uuid,text,text) to service_role;
grant execute on function public.farmacia_exclusao(uuid,uuid,text,text) to service_role;

-- The legacy last_access_at field was not always written by the login flow.
create or replace function rbk_private.usuarios_acessos(p_actor uuid)
returns table(user_id uuid,last_access_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.rbk_admins a join public.users u on u.id=a.user_id where a.user_id=p_actor and a.ativo and u.status='active') then raise exception 'Acesso restrito.'; end if;
 return query select u.id,greatest(u.last_access_at,a.last_sign_in_at) from public.users u join auth.users a on a.id=u.id;
end $$;
revoke all on function rbk_private.usuarios_acessos(uuid) from public,anon,authenticated;
create or replace function public.usuarios_acessos(p_actor uuid)
returns table(user_id uuid,last_access_at timestamptz)
language sql security invoker set search_path='' as $$select * from rbk_private.usuarios_acessos(p_actor)$$;
revoke all on function public.usuarios_acessos(uuid) from public,anon,authenticated;
grant execute on function rbk_private.usuarios_acessos(uuid),public.usuarios_acessos(uuid) to service_role;
