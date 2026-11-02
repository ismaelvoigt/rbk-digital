-- Downloads de auditoria sem espera pelo scanner; mantém autenticação,
-- autorização por auditoria e confirmação efetiva do recebimento.
begin;
do $migration$
declare definition text;previous text;
begin
 select pg_get_functiondef('aud_private.manager(text,uuid,jsonb)'::regprocedure) into definition;
 previous:=definition;
 definition:=replace(definition,$old$ and f.scan in ('pending','clean','error') and f.received_at is not null$old$,$new$ and f.received_at is not null$new$);
 definition:=replace(definition,$old$ and f.scan='clean' and f.received_at is not null$old$,$new$ and f.received_at is not null$new$);
 if definition=previous then raise exception 'Unexpected audit download definition; review migration';end if;
 if position('where f.audit_id=aid and f.id=' in definition)=0 or position('if not aud_private.can_manage(aid)' in definition)=0 then raise exception 'Missing audit access guard';end if;
 definition:=replace(definition,'Arquivo indisponível ou aguardando verificação de segurança','Arquivo indisponível ou envio ainda não confirmado');
 definition:=replace(definition,'Arquivo indisponível ou bloqueado por segurança','Arquivo indisponível ou envio ainda não confirmado');
 execute definition;
end $migration$;
commit;
