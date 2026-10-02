-- Consultas gerenciais explicitamente limitadas a uma farmácia.
-- O modelo de produção vincula autorizações por user_id -> users.farm_id.
begin;
create or replace function rbk_private.modulos_validar(p_farm uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if p_farm is null then raise exception 'Selecione uma farmácia/CNPJ.'; end if;
 if auth.uid() is null or not coalesce(rbk_private.can_access_farm(p_farm),false) then raise exception 'Sem acesso à farmácia selecionada.'; end if;
end $$;
create or replace function rbk_private.modulos_farmacias(p_busca text) returns setof public.farms
language sql stable security definer set search_path='' as $$
 select f.* from public.farms f where auth.uid() is not null
 and coalesce(rbk_private.can_access_farm(f.id),false)
 and (nullif(trim(p_busca),'') is null
 or position(lower(trim(p_busca)) in lower(coalesce(f.nome_fantasia,'')))>0
 or position(lower(trim(p_busca)) in lower(coalesce(f.razao_social,'')))>0
 or (regexp_replace(coalesce(p_busca,''),'[^0-9]','','g')<>'' and
 position(regexp_replace(p_busca,'[^0-9]','','g') in regexp_replace(f.cnpj,'[^0-9]','','g'))>0))
 order by coalesce(f.nome_fantasia,f.razao_social),f.id limit 50
$$;
create or replace function rbk_private.modulos_autorizacoes(p_farm uuid) returns setof public.autorizacoes
language plpgsql stable security definer set search_path='' as $$
begin
 perform rbk_private.modulos_validar(p_farm);
 return query select a.* from public.autorizacoes a join public.users u on u.id=a.user_id where u.farm_id=p_farm;
end $$;
create or replace function rbk_private.modulos_itens(p_farm uuid) returns setof public.dispensacao_itens
language plpgsql stable security definer set search_path='' as $$
begin
 perform rbk_private.modulos_validar(p_farm);
 return query select i.* from public.dispensacao_itens i join public.autorizacoes a on a.id=i.autorizacao_id join public.users u on u.id=a.user_id where u.farm_id=p_farm;
end $$;
create or replace function rbk_private.modulos_documentos(p_farm uuid,p_autorizacao uuid) returns setof public.documentos
language plpgsql stable security definer set search_path='' as $$
begin
 perform rbk_private.modulos_validar(p_farm);
 return query select d.* from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id join public.users u on u.id=a.user_id where u.farm_id=p_farm and a.id=p_autorizacao;
end $$;
create or replace function public.modulos_farmacias(p_busca text default '') returns setof public.farms language sql stable security invoker set search_path='' as $$select * from rbk_private.modulos_farmacias(p_busca)$$;
create or replace function public.modulos_autorizacoes(p_farm uuid) returns setof public.autorizacoes language sql stable security invoker set search_path='' as $$select * from rbk_private.modulos_autorizacoes(p_farm)$$;
create or replace function public.modulos_itens(p_farm uuid) returns setof public.dispensacao_itens language sql stable security invoker set search_path='' as $$select * from rbk_private.modulos_itens(p_farm)$$;
create or replace function public.modulos_documentos(p_farm uuid,p_autorizacao uuid) returns setof public.documentos language sql stable security invoker set search_path='' as $$select * from rbk_private.modulos_documentos(p_farm,p_autorizacao)$$;
revoke all on function rbk_private.modulos_validar(uuid),rbk_private.modulos_farmacias(text),rbk_private.modulos_autorizacoes(uuid),rbk_private.modulos_itens(uuid),rbk_private.modulos_documentos(uuid,uuid) from public,anon;
revoke all on function public.modulos_farmacias(text),public.modulos_autorizacoes(uuid),public.modulos_itens(uuid),public.modulos_documentos(uuid,uuid) from public,anon;
grant usage on schema rbk_private to authenticated;
grant execute on function rbk_private.modulos_validar(uuid),rbk_private.modulos_farmacias(text),rbk_private.modulos_autorizacoes(uuid),rbk_private.modulos_itens(uuid),rbk_private.modulos_documentos(uuid,uuid) to authenticated;
grant execute on function public.modulos_farmacias(text),public.modulos_autorizacoes(uuid),public.modulos_itens(uuid),public.modulos_documentos(uuid,uuid) to authenticated;
commit;
