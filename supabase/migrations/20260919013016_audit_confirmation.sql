begin;
alter table public.aud_audits add column confirmed_at timestamptz;
create function aud_private.confirm_audit(aid uuid,hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.aud_audits; result jsonb;
begin
 if not coalesce(aud_private.can_manage(aid),false) then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into strict a from public.aud_audits where id=aid for update;
 if a.confirmed_at is not null then return jsonb_build_object('created',false);end if;
 if a.collection <> 'open' then raise exception 'Reabra a coleta antes de confirmar.' using errcode='22023';end if;
 if a.contact_email='' or a.contact_phone='' then raise exception 'Informe e-mail e WhatsApp do cliente.' using errcode='22023';end if;
 if not exists(select 1 from public.aud_files where audit_id=aid and source='office' and received_at is not null and scan not in ('infected','rejected')) then raise exception 'Anexe o ofício antes de confirmar a auditoria.' using errcode='22023';end if;
 if hash is null or hash !~ '^[a-f0-9]{64}$' then raise exception 'Link inválido' using errcode='22023';end if;
 perform aud_private.manager('link',aid,jsonb_build_object('hash',hash,'days',40));
 update public.aud_audits set confirmed_at=now() where id=aid;
 insert into public.aud_events(audit_id,event,actor_id) values(aid,'audit_confirmed',auth.uid());
 return jsonb_build_object('created',true);
end$$;
revoke all on function aud_private.confirm_audit(uuid,text) from public,anon;
grant execute on function aud_private.confirm_audit(uuid,text) to authenticated;
create function public.aud_confirm(aid uuid,hash text) returns jsonb language sql security invoker set search_path='' as $$select aud_private.confirm_audit(aid,hash)$$;
revoke all on function public.aud_confirm(uuid,text) from public,anon;
grant execute on function public.aud_confirm(uuid,text) to authenticated;
commit;
