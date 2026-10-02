-- Preparação local. Aplicar primeiro em staging e testar com dois usuários
-- de farmácias distintas antes de qualquer promoção para produção.
begin;

alter table public.users drop constraint if exists users_perfil_check;
alter table public.users add constraint users_perfil_check
  check (perfil in ('farmacia', 'rbk_admin', 'operador',
    'administrador_farmacia', 'gestor_rbk', 'superadmin_rbk'));
alter table public.users alter column farm_id drop not null;

create table if not exists public.rbk_manager_farms (
  manager_user_id uuid not null references public.users(id),
  farm_id uuid not null references public.farms(id),
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (manager_user_id, farm_id)
);
alter table public.rbk_manager_farms enable row level security;
revoke all on public.rbk_manager_farms from anon, authenticated;

create schema if not exists rbk_private;
revoke all on schema rbk_private from public, anon;
grant usage on schema rbk_private to authenticated;

create or replace function rbk_private.actor_role()
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.rbk_admins r
      where r.user_id = auth.uid() and r.ativo
    ) then 'superadmin_rbk'
    when u.perfil = 'superadmin_rbk' then null
    when u.perfil = 'farmacia' then 'administrador_farmacia'
    else u.perfil
  end
  from public.users u
  where u.id = auth.uid() and u.status = 'active'
    and (u.farm_id is null or exists (
      select 1 from public.farms f where f.id = u.farm_id and f.status = 'active'
    ))
  limit 1
$$;

create or replace function rbk_private.actor_farm_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select u.farm_id from public.users u
  where u.id = auth.uid() and u.status = 'active'
    and exists (
      select 1 from public.farms f where f.id = u.farm_id and f.status = 'active'
    )
  limit 1
$$;

create or replace function rbk_private.can_access_farm(target_farm uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select target_farm is not null and exists (
    select 1 from public.farms f
    where f.id = target_farm and f.status = 'active'
  ) and (
    rbk_private.actor_role() = 'superadmin_rbk'
    or (
      rbk_private.actor_role() = 'gestor_rbk'
      and exists (
        select 1 from public.rbk_manager_farms m
        where m.manager_user_id = auth.uid() and m.farm_id = target_farm
      )
    )
    or (
      rbk_private.actor_role() in ('operador', 'administrador_farmacia')
      and rbk_private.actor_farm_id() = target_farm
    )
  )
$$;

create or replace function rbk_private.can_write_farm(target_farm uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select rbk_private.actor_role() in ('operador', 'administrador_farmacia')
    and rbk_private.actor_farm_id() = target_farm
$$;

revoke all on all functions in schema rbk_private from public, anon;
grant execute on function rbk_private.actor_role() to authenticated;
grant execute on function rbk_private.actor_farm_id() to authenticated;
grant execute on function rbk_private.can_access_farm(uuid) to authenticated;
grant execute on function rbk_private.can_write_farm(uuid) to authenticated;

alter table public.autorizacoes
  add column if not exists farm_id uuid references public.farms(id),
  add column if not exists analysis_status text not null default 'nao_analisada';
alter table public.autorizacoes drop constraint if exists autorizacoes_analysis_status_check;
alter table public.autorizacoes add constraint autorizacoes_analysis_status_check
  check (analysis_status in ('nao_analisada', 'em_analise',
    'requer_conferencia', 'revisada'));

update public.autorizacoes a set farm_id = u.farm_id
from public.users u where a.user_id = u.id and a.farm_id is null;
do $$
begin
  if exists (select 1 from public.autorizacoes where farm_id is null) then
    raise exception 'Existem autorizações sem farm_id; migração interrompida';
  end if;
end $$;
alter table public.autorizacoes alter column farm_id set not null;
create index if not exists autorizacoes_farm_id_idx on public.autorizacoes(farm_id);
create index if not exists autorizacoes_farm_created_idx
  on public.autorizacoes(farm_id, created_at desc);

-- O vínculo da farmácia é derivado no banco; o cliente não pode escolher
-- o tenant ao criar uma autorização.
create or replace function rbk_private.set_authorization_farm()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.farm_id := rbk_private.actor_farm_id();
    if new.farm_id is null or new.user_id is distinct from auth.uid() then
      raise exception 'Usuário sem farmácia ativa';
    end if;
  elsif new.farm_id is distinct from old.farm_id
      or new.user_id is distinct from old.user_id then
    raise exception 'Não é permitido alterar a farmácia ou o criador';
  elsif new.analysis_status is distinct from old.analysis_status
      and pg_trigger_depth() <= 1 and auth.uid() is not null then
    raise exception 'O estado da análise é controlado pela RBK';
  end if;
  return new;
end $$;
drop trigger if exists trg_authorization_farm on public.autorizacoes;
create trigger trg_authorization_farm before insert or update
on public.autorizacoes for each row
execute function rbk_private.set_authorization_farm();

drop policy if exists "Usuários podem consultar suas próprias autorizações" on public.autorizacoes;
drop policy if exists "Usuários podem inserir suas próprias autorizações" on public.autorizacoes;
drop policy if exists "Usuários podem atualizar suas próprias autorizações" on public.autorizacoes;
drop policy if exists "Usuários podem excluir suas próprias autorizações" on public.autorizacoes;
create policy autorizacoes_read_farm on public.autorizacoes for select to authenticated
  using (rbk_private.can_access_farm(farm_id));
create policy autorizacoes_insert_farm on public.autorizacoes for insert to authenticated
  with check (rbk_private.can_write_farm(farm_id) and user_id = (select auth.uid()));
create policy autorizacoes_update_farm on public.autorizacoes for update to authenticated
  using (rbk_private.can_write_farm(farm_id))
  with check (rbk_private.can_write_farm(farm_id));
create policy autorizacoes_delete_farm on public.autorizacoes for delete to authenticated
  using (rbk_private.can_write_farm(farm_id));

drop policy if exists "Usuários podem consultar seus próprios documentos" on public.documentos;
drop policy if exists "Usuários podem inserir documentos de suas autorizações" on public.documentos;
drop policy if exists "Usuários podem atualizar seus próprios documentos" on public.documentos;
drop policy if exists "Usuários podem excluir seus próprios documentos" on public.documentos;
create policy documentos_read_farm on public.documentos for select to authenticated
  using (exists (
    select 1 from public.autorizacoes a
    where a.id = autorizacao_id and rbk_private.can_access_farm(a.farm_id)
  ));
create policy documentos_insert_farm on public.documentos for insert to authenticated
  with check (exists (
    select 1 from public.autorizacoes a
    where a.id = autorizacao_id and rbk_private.can_write_farm(a.farm_id)
  ));
create policy documentos_update_farm on public.documentos for update to authenticated
  using (exists (
    select 1 from public.autorizacoes a
    where a.id = autorizacao_id and rbk_private.can_write_farm(a.farm_id)
  ))
  with check (exists (
    select 1 from public.autorizacoes a
    where a.id = autorizacao_id and rbk_private.can_write_farm(a.farm_id)
  ));
create policy documentos_delete_farm on public.documentos for delete to authenticated
  using (exists (
    select 1 from public.autorizacoes a
    where a.id = autorizacao_id and rbk_private.can_write_farm(a.farm_id)
  ));

drop policy if exists users_can_view_their_farm on public.farms;
create policy farms_read_scope on public.farms for select to authenticated
  using (rbk_private.can_access_farm(id));
drop policy if exists "RBK admins can view all users" on public.users;
drop policy if exists users_can_view_their_profile on public.users;
create policy users_read_scope on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or rbk_private.actor_role() = 'superadmin_rbk'
    or (rbk_private.actor_role() = 'gestor_rbk'
      and rbk_private.can_access_farm(farm_id))
    or (rbk_private.actor_role() = 'administrador_farmacia'
      and farm_id = rbk_private.actor_farm_id())
  );

-- Documentos existentes usam caminhos iniciados pelo UUID do autor do
-- upload. O acesso ao arquivo segue a farmácia do usuário dono do caminho.
create or replace function rbk_private.storage_path_farm(path text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select u.farm_id from public.users u
  where u.id::text = split_part(path, '/', 1)
  limit 1
$$;
revoke all on function rbk_private.storage_path_farm(text) from public, anon;
grant execute on function rbk_private.storage_path_farm(text) to authenticated;
drop policy if exists "Usuários podem visualizar seus documentos" on storage.objects;
drop policy if exists documentos_select_own on storage.objects;
drop policy if exists documentos_insert_own on storage.objects;
drop policy if exists documentos_update_own on storage.objects;
drop policy if exists documentos_delete_own on storage.objects;
create policy documentos_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos'
    and rbk_private.can_access_farm(rbk_private.storage_path_farm(name)));
create policy documentos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and rbk_private.can_write_farm(rbk_private.storage_path_farm(name)));
create policy documentos_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'documentos'
    and rbk_private.can_write_farm(rbk_private.storage_path_farm(name)))
  with check (bucket_id = 'documentos'
    and rbk_private.can_write_farm(rbk_private.storage_path_farm(name)));
create policy documentos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos'
    and rbk_private.can_write_farm(rbk_private.storage_path_farm(name)));

-- Dados internos do futuro Motor de Auditoria: sem grants ao navegador.
create table if not exists public.rbk_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.autorizacoes(id),
  requested_by uuid references auth.users(id),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  reason text not null check (reason in ('new_authorization', 'document_changed', 'manual')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create table if not exists public.rbk_possible_findings (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.autorizacoes(id),
  job_id uuid references public.rbk_analysis_jobs(id),
  rule_key text,
  rule_version text,
  document_ids uuid[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  technical_confidence numeric(5,4),
  public_message text not null,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'dismissed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now()
);
create table if not exists public.rbk_monitora_reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'released')),
  risk_level text check (risk_level in ('baixo', 'medio', 'alto')),
  released_by uuid references auth.users(id),
  released_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.rbk_analysis_jobs enable row level security;
alter table public.rbk_possible_findings enable row level security;
alter table public.rbk_monitora_reports enable row level security;
revoke all on public.rbk_analysis_jobs, public.rbk_possible_findings,
  public.rbk_monitora_reports from anon, authenticated;
create index if not exists rbk_analysis_jobs_authorization_idx
  on public.rbk_analysis_jobs(authorization_id, created_at desc);
create index if not exists rbk_possible_findings_authorization_idx
  on public.rbk_possible_findings(authorization_id, review_status);

create or replace function rbk_private.log_authorization_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs(farm_id, user_id, action, entity_type, entity_id)
  values (new.farm_id, auth.uid(), lower(tg_op), 'autorizacao', new.id);
  return new;
end $$;
drop trigger if exists trg_authorization_audit on public.autorizacoes;
create trigger trg_authorization_audit after insert or update
on public.autorizacoes for each row
execute function rbk_private.log_authorization_change();

create or replace function rbk_private.log_document_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  auth_id uuid;
  tenant_id uuid;
begin
  if tg_op = 'DELETE' then
    auth_id := old.autorizacao_id;
  else
    auth_id := new.autorizacao_id;
  end if;
  select farm_id into tenant_id from public.autorizacoes where id = auth_id;
  insert into public.audit_logs(farm_id, user_id, action, entity_type, entity_id, metadata)
  values (tenant_id, auth.uid(), lower(tg_op), 'documento',
    case when tg_op = 'DELETE' then old.id else new.id end,
    jsonb_build_object('authorization_id', auth_id));
  if tg_op = 'UPDATE' and new.caminho_arquivo is distinct from old.caminho_arquivo then
    update public.autorizacoes set analysis_status = 'nao_analisada'
    where id = auth_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists trg_document_audit on public.documentos;
create trigger trg_document_audit after insert or update or delete
on public.documentos for each row
execute function rbk_private.log_document_change();

create or replace function rbk_private.log_finding_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare tenant_id uuid;
begin
  if new.review_status is distinct from old.review_status then
    select farm_id into tenant_id from public.autorizacoes where id = new.authorization_id;
    insert into public.audit_logs(farm_id, user_id, action, entity_type, entity_id, metadata)
    values (tenant_id, auth.uid(), 'review_' || new.review_status,
      'possible_finding', new.id,
      jsonb_build_object('previous_status', old.review_status));
  end if;
  return new;
end $$;
drop trigger if exists trg_finding_review_audit on public.rbk_possible_findings;
create trigger trg_finding_review_audit after update of review_status
on public.rbk_possible_findings for each row
execute function rbk_private.log_finding_review();

commit;
