-- Default remains strict; enable only on the explicitly selected staging database.
begin;
create table aud_private.test_settings(singleton boolean primary key default true check(singleton), allow_test_cnpj boolean not null default false);
revoke all on aud_private.test_settings from public,anon,authenticated,service_role;
create or replace function aud_private.register_pharmacy_audit(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c text; nm text; fid uuid; r jsonb; total integer; weight integer; dv integer; j integer; k integer; created boolean:=false;
begin
 if auth.uid() is null or coalesce(rbk_private.actor_role(),'') not in ('gestor_rbk','superadmin_rbk') then raise exception 'Acesso negado' using errcode='42501'; end if;
 c:=regexp_replace(upper(coalesce(payload->'new_farm'->>'cnpj','')),'[./[:space:]-]','','g');
 nm:=btrim(coalesce(payload->'new_farm'->>'name',''));
 if length(nm)<3 or length(nm)>200 then raise exception 'Informe o nome da farmácia (3 a 200 caracteres).' using errcode='22023'; end if;
 if not (c ~ '^[0-9]{14}$' and coalesce((select allow_test_cnpj from aud_private.test_settings where singleton=true),false)) then
 if c !~ '^[A-Z0-9]{12}[0-9]{2}$' or c=repeat(substr(c,1,1),14) then raise exception 'CNPJ inválido. Confira os caracteres e os dígitos verificadores.' using errcode='22023'; end if;
 -- Receita Federal: ASCII - 48, pesos cíclicos 2..9 da direita para a esquerda.
 for k in 12..13 loop
  total:=0;weight:=2;
  for j in reverse k..1 loop total:=total+(ascii(substr(c,j,1))-48)*weight;weight:=case when weight=9 then 2 else weight+1 end;end loop;
  dv:=case when total%11<2 then 0 else 11-total%11 end;
  if substr(c,k+1,1)<>dv::text then raise exception 'CNPJ inválido. Confira os caracteres e os dígitos verificadores.' using errcode='22023';end if;
 end loop;
 end if;
 -- Serialize registrations through this endpoint; do not grant access to an existing tenant.
 perform pg_advisory_xact_lock(hashtextextended('audit-farm:'||c,0));
 select id into fid from public.farms where regexp_replace(upper(cnpj),'[./[:space:]-]','','g')=c order by id limit 1;
 if fid is not null then
  if not coalesce(rbk_private.can_access_farm(fid),false) then raise exception 'Cadastro indisponível para esta operação. Solicite à RBK a conferência do vínculo.' using errcode='42501';end if;
 else
  insert into public.farms(razao_social,cnpj,status) values(nm,c,'active') returning id into fid;
  insert into public.rbk_manager_farms(manager_user_id,farm_id,granted_by) values(auth.uid(),fid,auth.uid());
  created:=true;
 end if;
 r:=aud_private.manager('create',null,(payload-'new_farm')||jsonb_build_object('farm_id',fid));
 if created then insert into public.aud_events(audit_id,event,actor_id) values((r->>'id')::uuid,'pharmacy_registered',auth.uid());end if;
 return r;
end$$;
commit;
