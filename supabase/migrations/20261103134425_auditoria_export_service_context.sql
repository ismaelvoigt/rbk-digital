-- Worker is service_role, but evaluates the existing manager policy as the stored requester.
-- No anonymous/authenticated grants are added.
grant execute on function aud_private.manager(text,uuid,jsonb) to service_role;
