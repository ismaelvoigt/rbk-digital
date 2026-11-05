-- Accept ZIP and RAR as opaque documents; no automatic archive extraction.
-- Keep existing authorization, limits, receipt confirmation and original file types.
do $$
declare definition text; previous text;
begin
 select pg_get_functiondef('aud_private.portal(text,text,jsonb)'::regprocedure) into definition;
 previous:=definition;
 definition:=replace(definition,
  'when ''tiff'' then ''image/tiff'' end;',
  'when ''tiff'' then ''image/tiff'' when ''zip'' then ''application/zip'' when ''rar'' then ''application/vnd.rar'' end;');
 if definition=previous then raise exception 'Formato de validação alterado. Revise antes de aplicar.';end if;
 execute definition;
 update storage.buckets set allowed_mime_types=(
  select array_agg(distinct mime) from unnest(allowed_mime_types||array['application/zip','application/vnd.rar']) mime
 ) where id='auditoria-private' and public=false and allowed_mime_types is not null;
 if not found then raise exception 'Bucket privado da auditoria indisponível ou sem restrição de tipos.';end if;
end $$;
