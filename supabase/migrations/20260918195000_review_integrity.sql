-- Decisões humanas e relatórios liberados precisam de autoria verificável.
alter table public.rbk_possible_findings
  add constraint rbk_possible_findings_review_complete check (
    (review_status = 'pending'
      and reviewed_by is null and reviewed_at is null and review_reason is null)
    or
    (review_status in ('confirmed', 'dismissed')
      and reviewed_by is not null and reviewed_at is not null
      and nullif(btrim(review_reason), '') is not null)
  ),
  add constraint rbk_possible_findings_confidence_range check (
    technical_confidence is null or
    (technical_confidence >= 0 and technical_confidence <= 1)
  );

alter table public.rbk_monitora_reports
  add constraint rbk_monitora_reports_period_check
    check (period_end >= period_start),
  add constraint rbk_monitora_reports_release_complete check (
    status = 'draft'
    or (status = 'released' and risk_level is not null
      and released_by is not null and released_at is not null)
  );

create or replace function rbk_private.log_finding_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare tenant_id uuid;
begin
  if new.review_status is distinct from old.review_status then
    select farm_id into tenant_id
    from public.autorizacoes where id = new.authorization_id;
    insert into public.audit_logs(
      farm_id, user_id, action, entity_type, entity_id, metadata
    ) values (
      tenant_id, coalesce(auth.uid(), new.reviewed_by),
      'review_' || new.review_status, 'possible_finding', new.id,
      jsonb_build_object('previous_status', old.review_status)
    );
  end if;
  return new;
end $$;
