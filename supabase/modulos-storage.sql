begin;
-- Acesso privado aos arquivos continua restrito ao vínculo real do documento.
create or replace function rbk_private.modulos_pode_baixar(p_caminho text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.documentos d join public.autorizacoes a on a.id=d.autorizacao_id join public.users u on u.id=a.user_id
 where d.caminho_arquivo=p_caminho and coalesce(rbk_private.can_access_farm(u.farm_id),false))
$$;
revoke all on function rbk_private.modulos_pode_baixar(text) from public,anon;
grant execute on function rbk_private.modulos_pode_baixar(text) to authenticated;
create policy modulos_documentos_farmacia on storage.objects for select to authenticated
using(bucket_id='documentos' and rbk_private.modulos_pode_baixar(name));
commit;
