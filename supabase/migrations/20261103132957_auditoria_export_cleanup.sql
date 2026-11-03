-- Keep referential integrity while allowing business entities to be deleted.
-- Nullable references deny future access; the private object is still cleaned by job id.
alter table public.aud_exports alter column audit_id drop not null, alter column actor_id drop not null;
alter table public.aud_exports
 drop constraint aud_exports_audit_id_fkey,
 add constraint aud_exports_audit_id_fkey foreign key(audit_id) references public.aud_audits(id) on delete set null,
 drop constraint aud_exports_actor_id_fkey,
 add constraint aud_exports_actor_id_fkey foreign key(actor_id) references public.users(id) on delete set null,
 drop constraint aud_exports_batch_id_fkey,
 add constraint aud_exports_batch_id_fkey foreign key(batch_id) references public.aud_batches(id) on delete set null;
alter table public.aud_exports add column build jsonb;
create function public.aud_export_cleanup(p_job uuid,p_state text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_state not in ('expired','failed') then raise exception 'Estado inválido.';end if;
 delete from public.aud_export_parts where job_id=p_job;
 update public.aud_exports set state=p_state,files='[]'::jsonb,upload_id=null,build=null,
 error_code=case when p_state='failed' then 'preparation_failed' else null end,updated_at=now() where id=p_job;
end $$;
revoke all on function public.aud_export_cleanup(uuid,text) from public,anon,authenticated;
grant execute on function public.aud_export_cleanup(uuid,text) to service_role;

create function public.aud_export_allowed(p_job uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.aud_exports; previous text; result boolean;
begin
 select * into j from public.aud_exports where id=p_job;
 if not found or j.actor_id is null or j.audit_id is null then return false;end if;
 previous:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',j.actor_id::text,true);
 result:=aud_private.can_manage(j.audit_id);
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);raise;
end $$;
revoke all on function public.aud_export_allowed(uuid) from public,anon,authenticated;
grant execute on function public.aud_export_allowed(uuid) to service_role;

create function public.aud_export_start(p_actor uuid,p_audit uuid,p_batch uuid,p_hash text,p_files jsonb,p_filename text) returns public.aud_exports
language plpgsql security invoker set search_path='' as $$
declare j public.aud_exports; previous text; total bigint; jid uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,314159));
 previous:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if not aud_private.can_manage(p_audit) then raise exception 'Acesso revogado.';end if;
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);
 if p_batch is not null and not exists(select 1 from public.aud_batches where id=p_batch and audit_id=p_audit and completed_at is not null) then raise exception 'Lote inválido.';end if;
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 10000 then raise exception 'Arquivos inválidos.';end if;
 update public.aud_exports set state='expired' where actor_id=p_actor and expires_at<=now() and state not in ('failed','expired');
 select * into j from public.aud_exports where actor_id=p_actor and audit_id=p_audit and snapshot_hash=p_hash and state not in ('failed','expired');
 if found then return j;end if;
 if (select count(*) from public.aud_exports where actor_id=p_actor and state in ('queued','preparing','validating'))>=2 then raise exception using errcode='P0001',message='Aguarde a preparação atual antes de iniciar outra.';end if;
 select sum((f->>'size')::bigint) into total from jsonb_array_elements(p_files) f;
 insert into public.aud_exports(id,audit_id,actor_id,batch_id,snapshot_hash,files,filename,object_path,total_files,total_bytes)
 values(jid,p_audit,p_actor,p_batch,p_hash,p_files,p_filename,jid||'/auditoria.zip',jsonb_array_length(p_files),total) returning * into j;
 return j;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);raise;
end $$;
revoke all on function public.aud_export_start(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.aud_export_start(uuid,uuid,uuid,text,jsonb,text) to service_role;
