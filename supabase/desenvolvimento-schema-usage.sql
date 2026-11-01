-- Aplicado somente em ympeqcycjadvvumanmwm para completar a cópia estrutural.
-- USAGE permite resolver os nomes já autorizados; não concede EXECUTE,
-- acesso a tabelas, CREATE, acesso anônimo ou exposição de schema na API.
BEGIN;
GRANT USAGE ON SCHEMA rbk_private TO authenticated, service_role;
GRANT USAGE ON SCHEMA aud_private TO authenticated, service_role;
COMMIT;
