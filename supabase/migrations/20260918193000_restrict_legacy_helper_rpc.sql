-- As políticas das tabelas legadas ainda chamam estas funções.
-- Usuários autenticados conservam EXECUTE; acesso anônimo é removido.
revoke execute on function public.current_user_farm_id() from public, anon;
revoke execute on function public.is_rbk_admin() from public, anon;
grant execute on function public.current_user_farm_id() to authenticated;
grant execute on function public.is_rbk_admin() to authenticated;
