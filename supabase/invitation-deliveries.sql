-- Apply once in the same homologation database as both existing portals.
-- This script is deliberately not applied automatically by the application.
begin;
create table public.invitation_deliveries (
 attempt_id uuid primary key,
 audit_id uuid references public.aud_audits(id) on delete cascade,
 credential_id uuid references public.cre_processes(id) on delete cascade,
 link_hash text not null check (link_hash ~ '^[a-f0-9]{64}$'),
 channel text not null check (channel in ('email','whatsapp')),
 status text not null check (status in ('pending','accepted','failed','manual','not_configured','invalid_contact','unsafe_link','unavailable')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (num_nonnulls(audit_id,credential_id)=1)
);
alter table public.invitation_deliveries enable row level security;
revoke all on public.invitation_deliveries from public,anon,authenticated;
grant select,insert,update on public.invitation_deliveries to service_role;
create index on public.invitation_deliveries(audit_id,created_at desc);
create index on public.invitation_deliveries(credential_id,created_at desc);
commit;
