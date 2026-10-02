-- Dependências aditivas dos portais. Preserva tabelas e políticas legadas.
begin;
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


commit;
