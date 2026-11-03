-- Private export ledger: access only through authenticated server routes and worker.
create table public.aud_exports (
 id uuid primary key default gen_random_uuid(), audit_id uuid not null references public.aud_audits(id),
 actor_id uuid not null references public.users(id), batch_id uuid references public.aud_batches(id),
 snapshot_hash text not null, files jsonb not null, filename text not null,
 state text not null default 'queued' check(state in ('queued','preparing','validating','ready','failed','expired')),
 upload_id text, object_path text not null unique, run_id text,
 total_files integer not null check(total_files between 1 and 10000), total_bytes bigint not null,
 prepared_files integer not null default 0, verified_parts integer not null default 0,
 archive_bytes bigint, error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours', validated_at timestamptz,
 check(state<>'ready' or (validated_at is not null and archive_bytes>0))
);
create unique index aud_exports_active on public.aud_exports(actor_id,audit_id,snapshot_hash) where state not in ('failed','expired');
create index aud_exports_expiry on public.aud_exports(expires_at) where state<>'expired';
create table public.aud_export_parts (
 job_id uuid not null references public.aud_exports(id) on delete cascade,
 number integer not null check(number between 1 and 10000), bytes bigint not null check(bytes>0),
 start_offset bigint not null check(start_offset>=0), sha256 text not null, etag text not null,
 entries jsonb not null, verified boolean not null default false, primary key(job_id,number)
);
alter table public.aud_exports enable row level security;
alter table public.aud_export_parts enable row level security;
revoke all on public.aud_exports,public.aud_export_parts from public,anon,authenticated;
grant all on public.aud_exports,public.aud_export_parts to service_role;
-- Evaluate the existing manager policy using the stored requester, never caller-supplied identity.
grant usage on schema aud_private to service_role;
grant execute on function aud_private.can_manage(uuid) to service_role;
create function public.aud_export_detail(p_job uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.aud_exports; previous text; result jsonb;
begin
 select * into j from public.aud_exports where id=p_job;
 if not found then raise exception 'Exportação indisponível.';end if;
 previous:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',j.actor_id::text,true);
 if not aud_private.can_manage(j.audit_id) then raise exception 'Acesso revogado.';end if;
 result:=public.aud_manager('detail',j.audit_id,'{}'::jsonb);
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(previous,''),true);
 raise;
end $$;
revoke all on function public.aud_export_detail(uuid) from public,anon,authenticated;
grant execute on function public.aud_export_detail(uuid) to service_role;
-- Dedicated private area; no authenticated storage policies. Never expose partial objects.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('auditoria-exports','auditoria-exports',false,53687091200,array['application/zip'])
on conflict(id) do nothing;
