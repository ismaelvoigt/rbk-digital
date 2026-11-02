-- Development rollout. Existing pharmacies retain their access; new ones start with storage.
alter table public.farms add column plano text not null default 'completo' check (plano in ('armazenamento','completo'));
alter table public.farms alter column plano set default 'armazenamento';

create or replace function rbk_private.plano_gestao_liberado(p_farm uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(rbk_private.actor_role() in ('gestor_rbk','superadmin_rbk'),false)
 or exists(select 1 from public.farms where id=p_farm and plano='completo' and status='active')
$$;
revoke all on function rbk_private.plano_gestao_liberado(uuid) from public,anon;
grant execute on function rbk_private.plano_gestao_liberado(uuid) to authenticated;

-- Operational storage/team permissions intentionally remain independent of this gate.
create or replace function rbk_private.can_access_farm(target_farm uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(rbk_private.equipe_operacional(target_farm),false)
 and coalesce(rbk_private.actor_role() in ('administrador_farmacia','gerente_farmacia','gestor_rbk','superadmin_rbk'),false)
 and rbk_private.plano_gestao_liberado(target_farm)
$$;
create or replace function rbk_private.proximas_validar(p_farm uuid,p_escrita boolean default false,p_compras boolean default false) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_farm is null then raise exception 'Selecione uma farmácia/CNPJ.';end if;
 if auth.uid() is null or not coalesce(rbk_private.equipe_operacional(p_farm),false) then raise exception 'Sem acesso à farmácia selecionada.';end if;
 if not rbk_private.plano_gestao_liberado(p_farm) then raise exception 'Módulo não incluído no plano da farmácia.';end if;
 if p_escrita and not coalesce(rbk_private.can_write_farm(p_farm),false) then raise exception 'Sem permissão para alterar previsões.';end if;
 if p_compras and not coalesce(rbk_private.can_access_farm(p_farm),false) then raise exception 'Sem permissão para consultar compras.';end if;
end $$;
create policy plano_gestao on public.dispensacao_itens as restrictive for select to authenticated using (exists(select 1 from public.autorizacoes a where a.id=autorizacao_id and rbk_private.plano_gestao_liberado(a.farm_id)));

-- Defense in depth for direct reads; ordinary module RPCs enforce the same gate.
do $$declare t text;begin
 foreach t in array array['proximas_contatos','proximas_previsoes','proximas_eventos'] loop
 if to_regclass('public.'||t) is not null then
 execute format('create policy plano_gestao on public.%I as restrictive for select to authenticated using (rbk_private.plano_gestao_liberado(farmacia_id))',t);
 end if;end loop;
end $$;

create or replace function rbk_private.farmacia_acesso_alterar(p_actor uuid,p_id uuid,p_acao text,p_plano text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u public.users; antes text; locked_farm uuid;
begin
 perform pg_advisory_xact_lock_shared(92836211);
 if not exists(select 1 from public.rbk_admins a join public.users x on x.id=a.user_id where a.user_id=p_actor and a.ativo and x.status='active') then raise exception 'Acesso restrito aos administradores ativos do RBK Digital.';end if;
 select * into u from public.users where id=p_id;
 if not found or u.farm_id is null or (u.perfil<>'farmacia' and coalesce(u.tipo_convite,'')<>'farmacia') or u.perfil not in ('farmacia','operador','administrador_farmacia') or exists(select 1 from public.rbk_admins where user_id=p_id) then raise exception 'Responsável da farmácia inválido.';end if;
 locked_farm:=u.farm_id;
 perform pg_advisory_xact_lock(hashtextextended(locked_farm::text,917));
 select * into u from public.users where id=p_id for update;
 if not found or u.farm_id is distinct from locked_farm or (u.perfil<>'farmacia' and coalesce(u.tipo_convite,'')<>'farmacia') or u.perfil not in ('farmacia','operador','administrador_farmacia') or exists(select 1 from public.rbk_admins where user_id=p_id) then raise exception 'Responsável alterado durante a operação. Atualize a página.';end if;
 if not exists(select 1 from public.rbk_admins a join public.users x on x.id=a.user_id where a.user_id=p_actor and a.ativo and x.status='active') then raise exception 'Acesso restrito aos administradores ativos do RBK Digital.';end if;
 if u.status<>'active' or not exists(select 1 from public.farms where id=u.farm_id and status='active') then raise exception 'Ative a farmácia e o responsável antes de alterar o acesso.';end if;
 if p_acao='promover' then
   update public.users set perfil='administrador_farmacia',tipo_convite='farmacia' where id=p_id;
   insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)values(u.farm_id,p_actor,'promote','usuario',p_id,jsonb_build_object('perfil_anterior',u.perfil,'perfil','administrador_farmacia'));
 elsif p_acao='plano' and p_plano in ('armazenamento','completo') then
   select plano into antes from public.farms where id=u.farm_id for update;
   update public.farms set plano=p_plano where id=u.farm_id;
   insert into public.audit_logs(farm_id,user_id,action,entity_type,entity_id,metadata)values(u.farm_id,p_actor,'plan','farmacia',u.farm_id,jsonb_build_object('plano_anterior',antes,'plano',p_plano));
 else raise exception 'Operação inválida.';end if;
 return jsonb_build_object('completed',true);
end $$;
revoke all on function rbk_private.farmacia_acesso_alterar(uuid,uuid,text,text) from public,anon,authenticated;
create function public.farmacia_acesso_alterar(p_actor uuid,p_id uuid,p_acao text,p_plano text default null) returns jsonb
language sql security invoker set search_path='' as $$select rbk_private.farmacia_acesso_alterar(p_actor,p_id,p_acao,p_plano)$$;
revoke all on function public.farmacia_acesso_alterar(uuid,uuid,text,text) from public,anon,authenticated;
grant usage on schema rbk_private to service_role;
grant execute on function rbk_private.farmacia_acesso_alterar(uuid,uuid,text,text),public.farmacia_acesso_alterar(uuid,uuid,text,text) to service_role;

-- Immutable receipt closes the stale-token/write race using the existing writer lock.
create table rbk_private.user_deletions(user_id uuid primary key,actor_id uuid not null,email text not null,farm_id uuid,deleted_at timestamptz not null default now());
alter table rbk_private.user_deletions enable row level security;
revoke all on rbk_private.user_deletions from public,anon,authenticated,service_role;
create function rbk_private.deleted_user_row(r jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from rbk_private.user_deletions d where exists(select 1 from jsonb_each_text(r) kv where kv.key in ('id','user_id','owner','owner_id','uploaded_by','created_by','manager_user_id','granted_by','usuario_id','atualizado_por') and kv.value=d.user_id::text)
 or (r ? 'bucket_id' and d.user_id::text=any(string_to_array(r->>'name','/'))))
$$;
revoke all on function rbk_private.deleted_user_row(jsonb) from public,anon,authenticated;
create or replace function rbk_private.deletion_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock_shared(92836211);
 if rbk_private.deleted_user_row(to_jsonb(new)) or (tg_op='UPDATE' and rbk_private.deleted_user_row(to_jsonb(old))) then raise exception 'Usuário excluído. Não é permitido criar ou alterar seus registros.';end if;
 if rbk_private.deletion_row_blocked(to_jsonb(new)) or (tg_op='UPDATE' and rbk_private.deletion_row_blocked(to_jsonb(old))) then raise exception 'Farmácia em exclusão definitiva. Não é permitido alterar seus dados.';end if;
 return new;
end $$;

create function rbk_private.usuario_sem_uso_excluir(p_actor uuid,p_id uuid,p_action text,p_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u public.users; linked boolean:=false; hit boolean; fk record; motivo text; eligible boolean;
begin
 if not exists(select 1 from public.rbk_admins a join public.users x on x.id=a.user_id where a.user_id=p_actor and a.ativo and x.status='active') then raise exception 'Acesso restrito aos administradores ativos do RBK Digital.';end if;
 if p_action not in ('preview','delete') then raise exception 'Operação inválida.';end if;
 -- All supported application/Auth/Storage writers already take the matching shared lock.
 perform pg_advisory_xact_lock(92836211);
 if not exists(select 1 from public.rbk_admins a join public.users x on x.id=a.user_id where a.user_id=p_actor and a.ativo and x.status='active') then raise exception 'Acesso restrito aos administradores ativos do RBK Digital.';end if;
 select * into u from public.users where id=p_id for update;
 if not found then raise exception 'Usuário não encontrado. Atualize a lista.';end if;
 if p_id=p_actor or exists(select 1 from public.rbk_admins where user_id=p_id) or u.perfil not in ('farmacia','administrador_farmacia','gerente_farmacia','operador') then motivo:='Contas RBK e a própria conta não podem ser excluídas por esta ação.';
 elsif nullif(trim(u.email),'') is null then motivo:='O cadastro está sem e-mail. Corrija o cadastro antes de excluir.';
 elsif exists(select 1 from rbk_private.farm_deletions where farm_id=u.farm_id) then motivo:='A farmácia possui processo de exclusão. Utilize a ação da farmácia.';
 else
 -- Block business records regardless of ON DELETE CASCADE/SET NULL. Audit evidence is retained.
 for fk in select ns.nspname,c.relname,a.attname from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace ns on ns.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1]
 where k.contype='f' and k.confrelid in ('auth.users'::regclass,'public.users'::regclass) and ns.nspname not in ('auth','storage') and not (ns.nspname='public' and c.relname in ('users','audit_logs'))
 union
 select ns.nspname,c.relname,a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace ns on ns.oid=c.relnamespace
 where ns.nspname='public' and c.relkind in ('r','p') and c.relname not in ('users','audit_logs') and a.attnum>0 and not a.attisdropped and a.atttypid='uuid'::regtype
 and a.attname in ('user_id','owner_id','uploaded_by','created_by','deleted_by','updated_by','atualizado_por','manager_user_id','granted_by','responsavel_id','usuario_id','actor_id') loop
 execute format('select exists(select 1 from %I.%I where %I=$1)',fk.nspname,fk.relname,fk.attname) into hit using p_id;
 linked:=linked or hit;
 end loop;
 linked:=linked or exists(select 1 from public.autorizacoes where user_id=p_id)
 or exists(select 1 from public.document_versions where uploaded_by=p_id)
 or exists(select 1 from storage.objects where owner_id=p_id::text or owner=p_id or p_id::text=any(string_to_array(name,'/')))
 or exists(select 1 from public.audit_logs where user_id=p_id and entity_type in ('documento','autorizacao') and action in ('insert','update','create','upload'));
 if linked then motivo:='Este usuário possui documentos, autorizações, histórico de uso ou outros registros vinculados. Preserve a conta e utilize Inativar.';
 elsif u.perfil in ('farmacia','administrador_farmacia') and exists(select 1 from public.users where farm_id=u.farm_id and id<>p_id and status='active') and not exists(select 1 from public.users where farm_id=u.farm_id and id<>p_id and status='active' and perfil in ('farmacia','administrador_farmacia')) then motivo:='Promova outro administrador antes de excluir o responsável pela equipe.';
 end if;
 end if;
 eligible:=motivo is null;
 if p_action='preview' then return jsonb_build_object('eligible',eligible,'reason',motivo,'email',u.email);end if;
 if not eligible then raise exception '%',motivo;end if;
 if lower(trim(coalesce(p_email,'')))<>lower(u.email) or nullif(trim(p_email),'') is null then raise exception 'Digite o e-mail correto do usuário para confirmar.';end if;
 insert into rbk_private.user_deletions(user_id,actor_id,email,farm_id)values(p_id,p_actor,u.email,u.farm_id);
 -- Auth cascades identities, sessions and public.users, never business records (checked above).
 delete from auth.users where id=p_id;
 if not found then raise exception 'Login não encontrado. Nenhuma alteração foi realizada.';end if;
 return jsonb_build_object('completed',true);
end $$;
revoke all on function rbk_private.usuario_sem_uso_excluir(uuid,uuid,text,text) from public,anon,authenticated;
create function public.usuario_sem_uso_excluir(p_actor uuid,p_id uuid,p_action text,p_email text default null) returns jsonb
language sql security invoker set search_path='' as $$select rbk_private.usuario_sem_uso_excluir(p_actor,p_id,p_action,p_email)$$;
revoke all on function public.usuario_sem_uso_excluir(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function rbk_private.usuario_sem_uso_excluir(uuid,uuid,text,text),public.usuario_sem_uso_excluir(uuid,uuid,text,text) to service_role;
