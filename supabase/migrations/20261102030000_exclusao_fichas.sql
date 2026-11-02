-- Exclusão lógica: mantém ficha, documentos, eventos e farmácia.
begin;
alter table public.cre_processes add column deleted_at timestamptz;
alter table public.cre_processes add column deleted_by uuid references auth.users(id);

-- Patch only the relevant branches, preserving later portal/scan fixes.
do $migration$
declare definition text; previous text;
begin
 select pg_get_functiondef('public.cre_command(text,uuid,text,uuid,jsonb)'::regprocedure) into definition;
 previous:=definition;
 definition:=replace(definition,'where owner_id=actor)','where owner_id=actor and deleted_at is null)');
 definition:=replace(definition,'where id=pid and owner_id=actor for update','where id=pid and owner_id=actor and deleted_at is null for update');
 definition:=replace(definition,'where token_hash=h and expires_at>now() for update','where token_hash=h and expires_at>now() and deleted_at is null for update');
 if definition=previous or position('where owner_id=actor and deleted_at is null)' in definition)=0
    or position('where id=pid and owner_id=actor and deleted_at is null for update' in definition)=0
    or position('where token_hash=h and expires_at>now() and deleted_at is null for update' in definition)=0 then
   raise exception 'Unexpected cre_command definition: review migration';
 end if;
 previous:=definition;
 definition:=replace(definition, $old$ if op='renew' or op='revoke' then$old$, $new$ if op='remove' then
  if actor is null then raise exception 'Acesso negado';end if;
  if payload->>'confirmed' is distinct from 'true' then raise exception 'Confirme a exclusão da ficha';end if;
  update public.cre_processes set deleted_at=clock_timestamp(),deleted_by=actor,token_hash=null,expires_at=null,updated_at=clock_timestamp() where id=p.id;
  insert into public.cre_events(process_id,action) values(p.id,'removed');
  return jsonb_build_object('removed',true);
 elsif op='renew' or op='revoke' then$new$);
 if definition=previous then raise exception 'Missing credential removal insertion point';end if;
 execute definition;

 select pg_get_functiondef('aud_private.manager(text,uuid,jsonb)'::regprocedure) into definition;
 previous:=definition;
 definition:=replace(definition, $old$ if op='delete_empty' then$old$, $new$ if op='delete_empty' then
  if payload->>'confirmed' is distinct from 'true'
     or regexp_replace(upper(coalesce(payload->>'cnpj','')),'[./[:space:]-]','','g') !~ '^[A-Z0-9]{12}[0-9]{2}$'
     or regexp_replace(upper(coalesce(payload->>'cnpj','')),'[./[:space:]-]','','g') is distinct from regexp_replace(upper(coalesce(a.cnpj,'')),'[./[:space:]-]','','g') then
    raise exception 'Digite o CNPJ da auditoria e confirme a exclusão.' using errcode='22023';
  end if;$new$);
 if definition=previous then raise exception 'Missing audit removal insertion point';end if;
 execute definition;
end $migration$;
commit;
