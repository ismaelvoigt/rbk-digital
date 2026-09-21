-- A trilha é escrita por gatilhos de banco e por serviços RBK autorizados.
-- Clientes não podem inserir eventos nem ler metadados internos diretamente.
drop policy if exists farm_users_can_insert_audit_logs on public.audit_logs;
drop policy if exists farm_users_can_view_audit_logs on public.audit_logs;
revoke all on public.audit_logs from anon, authenticated;
