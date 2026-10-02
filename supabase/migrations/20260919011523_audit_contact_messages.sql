begin;
alter table public.aud_audits add column contact_email text not null default '',add column contact_phone text not null default '';
create function aud_private.save_contact(aid uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare email text:=btrim(coalesce(payload->>'email','')); phone text:=btrim(coalesce(payload->>'phone',''));
begin
 if not coalesce(aud_private.can_manage(aid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
 if length(email)>254 or (email<>'' and (email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or email ~ '[[:cntrl:]]')) then raise exception 'Informe um e-mail válido.' using errcode='22023';end if;
 if length(phone)>40 or phone ~ '[^0-9+() .-]' then raise exception 'Informe celular com DDD.' using errcode='22023';end if;
 phone:=regexp_replace(phone,'[^0-9]','','g');
 if length(phone) in (10,11) then phone:='55'||phone;end if;
 if phone<>'' and phone !~ '^55[1-9][0-9]{9,10}$' then raise exception 'Informe celular brasileiro com DDD.' using errcode='22023';end if;
 update public.aud_audits set contact_email=email,contact_phone=phone where id=aid;
 insert into public.aud_events(audit_id,event,actor_id) values(aid,'contact_updated',auth.uid());
 return jsonb_build_object('email',email,'phone',phone);
end$$;
revoke all on function aud_private.save_contact(uuid,jsonb) from public,anon;
grant execute on function aud_private.save_contact(uuid,jsonb) to authenticated;
create function public.aud_contact(aid uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select aud_private.save_contact(aid,payload)$$;
revoke all on function public.aud_contact(uuid,jsonb) from public,anon;
grant execute on function public.aud_contact(uuid,jsonb) to authenticated;
create or replace function public.aud_register_pharmacy(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 r:=aud_private.register_pharmacy_audit(payload);
 if payload ? 'contact' then perform aud_private.save_contact((r->>'id')::uuid,payload->'contact');end if;
 return r;
end$$;
commit;
