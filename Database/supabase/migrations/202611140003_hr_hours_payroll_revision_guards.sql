-- HR salary controls: audit-safe correction of PENDING historical evidence,
-- and automatic invalidation of stale payroll results when draft inputs change.
-- NO records, salary levels, work hours, or payment instructions are seeded.

create or replace function public.office_worktime_amend_pending(
  p_actor uuid, p_case uuid, p_start timestamptz, p_end timestamptz,
  p_breaks jsonb, p_source_reference text, p_reason text
) returns uuid language plpgsql security definer set search_path='' as $kravia_hr$
declare
  rec public.office_worktime_review_cases%rowtype;
  item jsonb;
  b_start timestamptz;
  b_end timestamptz;
  previous_end timestamptz;
begin
  select * into rec from public.office_worktime_review_cases where id=p_case for update;
  if not found or rec.status<>'PENDING' or rec.source_kind<>'HISTORICAL_CORRECTION' then
    raise exception 'Only pending historical evidence can be amended'; end if;
  if rec.requested_by<>p_actor then
    raise exception 'Only the original submitter may amend a pending request; another HR reviewer must reject and request resubmission'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then
    raise exception 'Active Office identity required'; end if;
  if p_start < timestamptz '2026-07-31 18:30:00+00'
     or p_end<=p_start or p_end-p_start>interval '24 hours' or p_end>now()+interval '1 minute' then
    raise exception 'Historical evidence must describe completed work from 1 August 2026'; end if;
  if length(trim(coalesce(p_source_reference,'')))<5 or length(trim(coalesce(p_reason,'')))<8 then
    raise exception 'Traceable evidence and a meaningful correction reason required'; end if;
  if jsonb_typeof(coalesce(p_breaks,'[]'::jsonb)) <> 'array' then
    raise exception 'Unpaid breaks must be a JSON array'; end if;

  previous_end := p_start;
  for item in select value from jsonb_array_elements(coalesce(p_breaks,'[]'::jsonb))
              order by value->>'startAt' loop
    if jsonb_typeof(item)<>'object' or not (item ? 'startAt' and item ? 'endAt') then
      raise exception 'Break boundaries missing'; end if;
    begin
      b_start := (item->>'startAt')::timestamptz;
      b_end := (item->>'endAt')::timestamptz;
    exception when others then raise exception 'Invalid break timestamp';
    end;
    if b_start < previous_end or b_end <= b_start or b_end > p_end then
      raise exception 'Breaks overlap or fall outside verified work interval'; end if;
    previous_end := b_end;
  end loop;

  update public.office_worktime_review_cases set
    work_starts_at=p_start,work_ends_at=p_end,breaks=coalesce(p_breaks,'[]'::jsonb),
    source_reference=trim(p_source_reference),request_reason=trim(p_reason)
  where id=p_case;
  insert into public.office_worktime_events(case_id,actor_user_id,event_type,context)
  values(p_case,p_actor,'SUBMITTED',jsonb_build_object(
    'action','AMENDED_PENDING','previous_start',rec.work_starts_at,
    'previous_end',rec.work_ends_at,'previous_breaks',rec.breaks,
    'previous_source',rec.source_reference,'previous_reason',rec.request_reason,
    'revised_start',p_start,'revised_end',p_end));
  return p_case;
end; $kravia_hr$;

revoke all on function public.office_worktime_amend_pending(
  uuid,uuid,timestamptz,timestamptz,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.office_worktime_amend_pending(
  uuid,uuid,timestamptz,timestamptz,jsonb,text,text) to service_role;

-- Draft payroll mutations invalidate any previously calculated version.
-- Audit captures old and new evidence. Attendance uses prepared_by and
-- adjustments use created_by; never rewrite locked payroll.
create or replace function public.office_payroll_invalidate_changed_draft()
returns trigger language plpgsql security definer set search_path='' as $kravia_hr$
declare
  per public.office_payroll_periods%rowtype;
  touched_id uuid;
  old_evidence jsonb;
  new_evidence jsonb := to_jsonb(NEW);
  audit_actor uuid;
begin
  touched_id := (new_evidence->>'period_id')::uuid;
  select * into per from public.office_payroll_periods where id=touched_id for update;
  if not found then raise exception 'Payroll period missing'; end if;
  if per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then
    raise exception 'Submitted, approved, and paid payroll inputs cannot be rewritten'; end if;
  if TG_OP='UPDATE' then old_evidence := to_jsonb(OLD); end if;
  audit_actor := coalesce(
    nullif(new_evidence->>'prepared_by','')::uuid,
    nullif(new_evidence->>'created_by','')::uuid);
  if audit_actor is null then raise exception 'Payroll change actor is missing'; end if;
  if per.status='CALCULATED' then
    update public.office_payroll_results set status='SUPERSEDED'
    where period_id=per.id and status='CALCULATED';
    update public.office_payroll_periods set status='ATTENDANCE_READY',
      approval_request_id=null,updated_at=now() where id=per.id;
  end if;
  insert into public.office_payroll_events(
    actor_user_id,period_id,employment_id,event_type,metadata
  ) values(
    audit_actor,per.id,(new_evidence->>'employment_id')::uuid,
    'PAYROLL_DRAFT_INPUT_CHANGED',
    jsonb_build_object('relation',TG_TABLE_NAME,'operation',TG_OP,
      'invalidated_calculation',per.status='CALCULATED',
      'before',old_evidence,'after',new_evidence)
  );
  return NEW;
end; $kravia_hr$;

drop trigger if exists office_attendance_auto_invalidate on public.office_payroll_attendance_snapshots;
create trigger office_attendance_auto_invalidate
after insert or update on public.office_payroll_attendance_snapshots
for each row execute function public.office_payroll_invalidate_changed_draft();

drop trigger if exists office_adjustment_auto_invalidate on public.office_payroll_adjustments;
create trigger office_adjustment_auto_invalidate
after insert or update on public.office_payroll_adjustments
for each row execute function public.office_payroll_invalidate_changed_draft();

revoke all on function public.office_payroll_invalidate_changed_draft() from public,anon,authenticated;
