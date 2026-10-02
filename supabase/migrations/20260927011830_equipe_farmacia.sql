-- Equipe: migração validada em PostgreSQL local com duas farmácias.
-- Aplicar apenas ao banco explicitamente autorizado antes da publicação da interface.
begin;

alter table public.users drop constraint if exists users_perfil_check;
alter table public.users add constraint users_perfil_check
  check (perfil in ('farmacia', 'rbk_admin', 'operador',
    'administrador_farmacia', 'gerente_farmacia', 'gestor_rbk', 'superadmin_rbk'));
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

create or replace function rbk_private.equipe_operacional(target_farm uuid)
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
      rbk_private.actor_role() in ('operador', 'gerente_farmacia', 'administrador_farmacia')
      and rbk_private.actor_farm_id() = target_farm
    )
  )
$$;

create or replace function rbk_private.can_write_farm(target_farm uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select rbk_private.actor_role() in ('operador', 'gerente_farmacia', 'administrador_farmacia')
    and rbk_private.actor_farm_id() = target_farm
$$;

revoke all on all functions in schema rbk_private from public, anon;
grant execute on function rbk_private.actor_role() to authenticated;
grant execute on function rbk_private.actor_farm_id() to authenticated;
grant execute on function rbk_private.equipe_operacional(uuid) to authenticated;
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
  using (rbk_private.equipe_operacional(farm_id));
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
    where a.id = autorizacao_id and rbk_private.equipe_operacional(a.farm_id)
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
  using (rbk_private.equipe_operacional(id));
drop policy if exists "RBK admins can view all users" on public.users;
drop policy if exists users_can_view_their_profile on public.users;
create policy users_read_scope on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or rbk_private.actor_role() = 'superadmin_rbk'
    or (rbk_private.actor_role() = 'gestor_rbk'
      and rbk_private.equipe_operacional(farm_id))
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
    and rbk_private.equipe_operacional(rbk_private.storage_path_farm(name)));
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


-- Management access excludes counter attendants even through direct RPC calls.
create or replace function rbk_private.can_access_farm(target_farm uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(rbk_private.equipe_operacional(target_farm),false)
 and coalesce(rbk_private.actor_role() in ('administrador_farmacia','gerente_farmacia','gestor_rbk','superadmin_rbk'),false)
$$;
revoke all on function rbk_private.can_access_farm(uuid) from public,anon;
grant execute on function rbk_private.can_access_farm(uuid) to authenticated;
revoke all on public.users from authenticated,anon;
grant select on public.users to authenticated;
revoke all on public.audit_logs from authenticated,anon;
grant select on public.audit_logs to authenticated;
drop policy if exists farm_users_can_insert_audit_logs on public.audit_logs;
drop policy if exists farm_users_can_view_audit_logs on public.audit_logs;
create policy equipe_audit_read on public.audit_logs for select to authenticated using(
 rbk_private.actor_role()='administrador_farmacia' and farm_id=rbk_private.actor_farm_id());

alter table public.users add column if not exists tipo_convite text;
alter table public.users add column if not exists convidado_por uuid;
alter table public.users add column if not exists convite_enviado_em timestamptz;

create or replace function rbk_private.equipe_admin() returns uuid
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or rbk_private.actor_role() is distinct from 'administrador_farmacia' or rbk_private.actor_farm_id() is null then
 raise exception 'Acesso restrito ao administrador da farmácia.';end if;
 return rbk_private.actor_farm_id();
end $$;
create or replace function public.equipe_listar()
returns table(id uuid,nome text,email text,perfil text,status text,created_at timestamptz,convite_enviado_em timestamptz,aceito boolean)
language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 f:=rbk_private.equipe_admin();
 return query select u.id,u.nome,u.email,u.perfil,u.status,u.created_at,u.convite_enviado_em,
 a.last_sign_in_at is not null from public.users u join auth.users a on a.id=u.id
 where u.farm_id=f order by u.created_at,u.id;
end $$;
create or replace function public.equipe_salvar(p_id uuid,p_nome text,p_perfil text,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare f uuid; antigo public.users;
begin
 f:=rbk_private.equipe_admin();perform pg_advisory_xact_lock(hashtextextended(f::text,917));
 -- Recheck permission after serializing all membership changes.
 f:=rbk_private.equipe_admin();
 if p_nome is null or length(trim(p_nome)) not between 2 and 150 or p_perfil is null or p_perfil not in ('administrador_farmacia','gerente_farmacia','operador') or p_status is null or p_status not in ('active','inactive') then raise exception 'Dados inválidos.';end if;
 select * into antigo from public.users where id=p_id and farm_id=f for update;
 if not found or antigo.perfil not in ('farmacia','administrador_farmacia','gerente_farmacia','operador') or exists(select 1 from public.rbk_admins where user_id=p_id and ativo) then raise exception 'Usuário indisponível.';end if;
 if p_id=auth.uid() and (p_status<>'active' or p_perfil<>'administrador_farmacia') then raise exception 'Não é permitido remover seu próprio acesso administrativo.';end if;
 if antigo.perfil in ('farmacia','administrador_farmacia') and antigo.status='active' and (p_status<>'active' or p_perfil<>'administrador_farmacia') and not exists(select 1 from public.users where farm_id=f and id<>p_id and perfil in ('farmacia','administrador_farmacia') and status='active') then raise exception 'Mantenha um administrador ativo.';end if;
 update public.users set nome=trim(p_nome),perfil=case when antigo.perfil='farmacia' and p_perfil='administrador_farmacia' then 'farmacia' else p_perfil end,status=p_status where users.id=p_id;
 if p_status='inactive' then delete from auth.sessions where user_id=p_id;end if;
 insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)values(f,auth.uid(),'update','usuario',p_id,jsonb_build_object('perfil_anterior',antigo.perfil,'perfil',p_perfil,'status_anterior',antigo.status,'status',p_status));
end $$;
-- Server-only entry point. Actor identity comes from a validated access token, never request JSON.
create or replace function public.equipe_registrar_convite(p_actor uuid,p_id uuid,p_nome text,p_email text,p_perfil text,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 select u.farm_id into f from public.users u join public.farms f on f.id=u.farm_id where u.id=p_actor and u.status='active' and u.perfil in ('farmacia','administrador_farmacia') and f.status='active' and not exists(select 1 from public.rbk_admins r where r.user_id=p_actor and r.ativo);
 if f is null then raise exception 'Acesso restrito.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f::text,917));
 if not exists(select 1 from public.users where id=p_actor and status='active' and perfil in ('farmacia','administrador_farmacia')) then raise exception 'Acesso restrito.';end if;
 if p_nome is null or length(trim(p_nome)) not between 2 and 150 or p_perfil is null or p_perfil not in ('administrador_farmacia','gerente_farmacia','operador') or p_status is null or p_status not in ('active','inactive') or not exists(select 1 from auth.users where id=p_id and lower(email)=lower(p_email)) then raise exception 'Dados inválidos.';end if;
 if exists(select 1 from public.users where id=p_id or lower(email)=lower(p_email)) then raise exception 'E-mail já cadastrado. Não é permitido transferir usuários.';end if;
 insert into public.users(id,farm_id,nome,email,perfil,status,tipo_convite,convidado_por)values(p_id,f,trim(p_nome),lower(p_email),p_perfil,p_status,'funcionario',p_actor);
 insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)values(f,p_actor,'invite','usuario',p_id,jsonb_build_object('perfil',p_perfil,'status',p_status,'tipo_convite','funcionario'));
end $$;
revoke all on function public.equipe_registrar_convite(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.equipe_registrar_convite(uuid,uuid,text,text,text,text) to service_role;
revoke all on function rbk_private.equipe_admin(),public.equipe_listar(),public.equipe_salvar(uuid,text,text,text) from public,anon;
grant execute on function rbk_private.equipe_admin(),public.equipe_listar(),public.equipe_salvar(uuid,text,text,text) to authenticated;

create or replace function rbk_private.equipe_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb; f uuid;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='autorizacoes' then f:=(r->>'farm_id')::uuid;
 else select farm_id into f from public.autorizacoes where id=(r->>'autorizacao_id')::uuid;end if;
 if f is not null then insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)
 values(f,auth.uid(),lower(tg_op),case when tg_table_name='autorizacoes' then 'autorizacao' else 'documento' end,(r->>'id')::uuid,
 jsonb_build_object('autorizacao_id',r->>'autorizacao_id','ator_nome',(select nome from public.users where id=auth.uid())));end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function rbk_private.equipe_audit() from public,anon,authenticated;
create trigger equipe_autorizacao_audit after insert or update or delete on public.autorizacoes for each row execute function rbk_private.equipe_audit();
create trigger equipe_documento_audit after insert or update or delete on public.documentos for each row execute function rbk_private.equipe_audit();
-- Prevent moving a document across authorizations or linking another tenant's storage path.
create or replace function rbk_private.equipe_document_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare f uuid;
begin
 if tg_op='UPDATE' and new.autorizacao_id is distinct from old.autorizacao_id then raise exception 'Não é permitido transferir documentos.';end if;
 select farm_id into f from public.autorizacoes where id=new.autorizacao_id;
 if auth.uid() is not null and (not coalesce(rbk_private.can_write_farm(f),false) or rbk_private.storage_path_farm(new.caminho_arquivo) is distinct from f) then raise exception 'Documento fora da farmácia.';end if;
 return new;
end $$;
revoke all on function rbk_private.equipe_document_guard() from public,anon,authenticated;
create trigger equipe_document_guard before insert or update on public.documentos for each row execute function rbk_private.equipe_document_guard();
do $optional$ begin
 if to_regclass('public.cupom_extracoes') is not null then
 execute $definition$
create or replace function public.cupom_confirmar(p_documento uuid,p_versao uuid,p_actor uuid,p_itens jsonb,p_substituir boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare j public.cupom_extracoes;d public.documentos;a public.autorizacoes;r jsonb;k text;origem jsonb;pos integer=0;referencia text;
begin
 -- Serializa confirmações de cupons distintos da mesma autorização.
 select a0.* into a from public.autorizacoes a0 join public.documentos d0 on d0.autorizacao_id=a0.id where d0.id=p_documento for update of a0;
 if a.id is null or not exists(select 1 from public.users u join public.farms f on f.id=u.farm_id where u.id=p_actor and u.status='active' and f.status='active' and u.farm_id=a.farm_id and u.perfil in ('farmacia','administrador_farmacia','gerente_farmacia','operador') and not exists(select 1 from public.rbk_admins r where r.user_id=p_actor and r.ativo)) then raise exception 'Sem permissão para confirmar os itens desta autorização.';end if;
 select * into d from public.documentos where id=p_documento for update;
 select * into j from public.cupom_extracoes where documento_id=p_documento for update;
 if j.documento_id is null or j.versao<>p_versao or j.estado<>'revisao' or j.autorizacao_id<>a.id or j.caminho_arquivo<>d.caminho_arquivo or d.status<>'recebido' then raise exception 'Extração alterada ou indisponível. Atualize a página.';end if;
 if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>500 then raise exception 'Itens inválidos.';end if;
 if exists(select 1 from public.dispensacao_itens where autorizacao_id=a.id) and not p_substituir then raise exception 'Confirme a substituição da base de itens da autorização.';end if;
 -- Os itens são uma única base canônica. Não soma cupons fiscal/vinculado.
 delete from public.dispensacao_itens where autorizacao_id=a.id;
 for r in select value from jsonb_array_elements(p_itens) loop
  pos=pos+1;
  if jsonb_typeof(r->'produto') is distinct from 'string' or length(btrim(r->>'produto')) not between 1 and 300 or jsonb_typeof(r->'fonte') is distinct from 'string' or length(btrim(r->>'fonte')) not between 1 and 1000 then raise exception 'Produto e fonte obrigatórios.';end if;
  origem='{}';referencia='Conferido no documento '||d.id||' • '||(r->>'fonte');
  foreach k in array array['produto','ean','unidade','quantidade','valor_unitario','valor_total','valor_pfpb','principio_ativo','indicacao','data_dispensacao'] loop
   if r->k is not null and r->k<>'null'::jsonb then origem=origem||jsonb_build_object(k,referencia);end if;
  end loop;
  insert into public.dispensacao_itens(autorizacao_id,documento_id,posicao,produto,ean,unidade,quantidade,valor_unitario,valor_total,valor_pfpb,principio_ativo,indicacao,data_dispensacao,status,origens)
  values(a.id,d.id,pos,btrim(r->>'produto'),r->>'ean',r->>'unidade',(r->>'quantidade')::numeric,(r->>'valor_unitario')::numeric,(r->>'valor_total')::numeric,(r->>'valor_pfpb')::numeric,r->>'principio_ativo',r->>'indicacao',(r->>'data_dispensacao')::date,'confirmado',origem);
 end loop;
 update public.cupom_extracoes set estado='substituido',updated_at=now() where autorizacao_id=a.id and documento_id<>d.id and estado='confirmado';
 update public.cupom_extracoes set estado='confirmado',revisado_por=p_actor,revisado_em=now(),updated_at=now() where documento_id=d.id;
end $$;
$definition$;
 end if;
end $optional$;

commit;
