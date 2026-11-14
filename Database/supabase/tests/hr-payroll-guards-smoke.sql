-- Runs only in isolated PostgreSQL CI after the HR guard migration.
do $qa$
declare
  employee constant uuid := 'f0000000-0000-4000-8000-000000000004';
  founder constant uuid := 'f0000000-0000-4000-8000-000000000001';
  reviewer constant uuid := 'f0000000-0000-4000-8000-000000000003';
  employment uuid;
  compensation uuid;
  period uuid;
  claim uuid;
  session uuid;
  sample_id uuid;
  failed boolean;
begin
  insert into public.office_employment_registry(employment_code,identity_user_id,status,start_date) values ('HR-QA-EMP',employee,'ACTIVE','2026-08-01') returning employment_id into employment;
  insert into public.office_compensation_versions(annual_ctc_minor,monthly_gross_minor)
  values (60000000,5000000) returning id into compensation;

  insert into public.office_worktime_review_cases (
    employee_user_id,work_starts_at,work_ends_at,source_kind,source_reference,requested_by,request_reason
  ) values (employee,'2026-10-16 09:00+05:30','2026-10-16 15:00+05:30','HISTORICAL_CORRECTION',
    'HR-QA-ORIGINAL',employee,'Original corrected worked interval') returning id into claim;
  perform public.office_worktime_amend_pending(
    employee,claim,'2026-10-16 10:00+05:30','2026-10-16 17:00+05:30','[{"startAt":"2026-10-16T13:00:00+05:30","endAt":"2026-10-16T13:30:00+05:30"}]'::jsonb,
    'HR-QA-REVISED','Corrected employee timesheet after reviewer request');
  if not exists(select 1 from public.office_worktime_review_cases
      where id=claim and source_reference='HR-QA-REVISED'
        and work_starts_at='2026-10-16 10:00+05:30'::timestamptz) then
    raise exception 'Pending correction failed'; end if;
  if not exists(select 1 from public.office_worktime_events
      where case_id=claim and context->>'previous_source'='HR-QA-ORIGINAL') then
    raise exception 'Pending correction audit history missing'; end if;

  failed:=false;
  begin
    perform public.office_worktime_amend_pending(
      founder,claim,'2026-10-16 10:00+05:30','2026-10-16 17:00+05:30','[]'::jsonb,
      'HR-QA-UNAUTHORIZED','Unauthorized attempt');
  exception when others then failed:=true; end;
  if not failed then raise exception 'Unauthorized edit passed'; end if;

  insert into public.office_attendance_sessions(user_id,check_in_at,check_out_at)
  values(employee,'2026-10-17 10:00+05:30','2026-10-17 16:00+05:30')
  returning id into session;
  sample_id:=public.office_worktime_queue_recorded(employee,employee,session);
  if not exists(select 1 from public.office_worktime_review_cases
      where id=sample_id and source_kind='RECORDED_SESSION' and status='PENDING') then
    raise exception 'Actual recorded attendance was not queued'; end if;

  failed:=false;
  begin
    perform public.office_worktime_queue_recorded(employee,employee,session);
  exception when others then failed:=true; end;
  if not failed then raise exception 'Duplicate recorded attendance accepted'; end if;

  insert into public.office_payroll_periods(period_code,starts_on,ends_on,status)
  values('2026-10-HRQA','2026-10-01','2026-10-31','CALCULATED') returning id into period;
  insert into public.office_payroll_results(
    period_id,employee_user_id,employment_id,compensation_version_id,
    currency,base_gross_minor,prorated_gross_minor,additional_earnings_minor,
    deductions_minor,net_pay_minor,calculation_hash,status
  ) values(period,employee,employment,compensation,'INR',5000000,5000000,0,0,5000000,
    repeat('0',64),'CALCULATED');
  insert into public.office_payroll_attendance_snapshots(period_id,employment_id,prepared_by)
  values(period,employment,founder);
  if not exists(select 1 from public.office_payroll_periods
     where id=period and status='ATTENDANCE_READY') then
    raise exception 'Stale calculation was not invalidated'; end if;
  if not exists(select 1 from public.office_payroll_results
     where period_id=period and status='SUPERSEDED') then
    raise exception 'Stale payroll result not superseded'; end if;
  if not exists(select 1 from public.office_payroll_events
     where period_id=period and event_type='PAYROLL_DRAFT_INPUT_CHANGED') then
    raise exception 'Input correction audit missing'; end if;

  insert into public.office_payroll_adjustments(
    period_id,employment_id,adjustment_code,source_reference,amount_minor,status,created_by
  ) values(period,employment,'WORKTIME_WEEKDAY_OT','WORKTIME:first',12345,'DRAFT',founder);
  failed:=false;
  begin
    insert into public.office_payroll_adjustments(
      period_id,employment_id,adjustment_code,source_reference,amount_minor,status,created_by
    ) values(period,employment,'WORKTIME_WEEKDAY_OT','WORKTIME:changed',12345,'DRAFT',founder);
  exception when unique_violation then failed:=true; end;
  if not failed then raise exception 'Second active OT premium accepted'; end if;

  -- No "REVIEWED" status may appear without a distinct human approval.
  failed:=false;
  begin
    update public.office_payroll_attendance_snapshots set status='REVIEWED'
    where period_id=period;
  exception when check_violation then failed:=true; end;
  if not failed then raise exception 'Attendance was falsely marked reviewed without a reviewer'; end if;

  -- Planned/invited identities are not payable employment.
  update public.office_employment_registry set status='PLANNED' where employment_id=employment;
  failed:=false;
  begin
    perform public.office_payroll_set_attendance_snapshot_v2(
      founder,period,employment,126,126,0,0,0,0,
      '{"source":"HR_EVIDENCE_REVIEW","evidence_reference":"QA-WORKLOG-001","note":"Actual test evidence for a fully paid period"}'::jsonb,
      (select updated_at from public.office_payroll_attendance_snapshots where period_id=period),
      'HR correction for an independently reviewed month');
  exception when others then
    if sqlerrm not like '%verified employment dates%' then raise; end if;
    failed:=true;
  end;
  if not failed then raise exception 'Planned employment entered payable monthly payroll'; end if;
  update public.office_employment_registry set status='ACTIVE' where employment_id=employment;

  -- Invalid leave/absence allocations must fail at the database boundary.
  failed:=false;
  begin
    perform public.office_payroll_set_attendance_snapshot_v2(
      founder,period,employment,126,125,0,0,0,0,
      '{"source":"HR_EVIDENCE_REVIEW","evidence_reference":"QA-WORKLOG-001","note":"Actual test evidence for invalid hours"}'::jsonb,
      (select updated_at from public.office_payroll_attendance_snapshots where period_id=period),
      'HR correction checking incomplete allocation');
  exception when others then
    if sqlerrm not like '%reconcile exactly%' then raise; end if;
    failed:=true;
  end;
  if not failed then raise exception 'Unreconciled hours were accepted'; end if;

  perform public.office_payroll_set_attendance_snapshot_v2(
    founder,period,employment,126,126,0,0,0,0,
    '{"source":"HR_EVIDENCE_REVIEW","evidence_reference":"QA-WORKLOG-001","note":"Reviewed independent source evidence"}'::jsonb,
    (select updated_at from public.office_payroll_attendance_snapshots where period_id=period),
    'HR correction after verified worktime reconciliation');
  -- Returning without an independently approved review note is impossible.
  failed:=false;
  begin
    perform public.office_payroll_review_attendance(founder,
      (select id from public.office_payroll_attendance_snapshots where period_id=period),
      'APPROVE','Self approval must not be accepted');
  exception when others then failed:=true; end;
  if not failed then raise exception 'Attendance preparer self-approved'; end if;
  if public.office_payroll_review_attendance(reviewer,
      (select id from public.office_payroll_attendance_snapshots where period_id=period),
      'APPROVE','Independent review of genuine timesheet evidence completed')<>'REVIEWED' then
    raise exception 'Independent attendance review did not complete'; end if;
  if not exists(select 1 from public.office_payroll_attendance_snapshots
      where period_id=period and status='REVIEWED' and reviewed_by=reviewer) then
    raise exception 'Independent reviewer was not persisted'; end if;

  update public.office_payroll_adjustments set employee_user_id=employee
    where period_id=period and adjustment_code='WORKTIME_WEEKDAY_OT';
  failed:=false;
  begin
    perform public.office_payroll_review_adjustment(employee,
      (select id from public.office_payroll_adjustments where period_id=period limit 1),
      'APPROVE');
  exception when others then failed:=true; end;
  if not failed then raise exception 'Overtime beneficiary self-approved their own adjustment'; end if;

  -- Approved payroll legitimately LOCKS a previously reviewed attendance
  -- snapshot; this must not be mistaken for retroactive hours tampering.
  update public.office_payroll_periods set status='APPROVED' where id=period;
  update public.office_payroll_attendance_snapshots set status='LOCKED',updated_at=now()
    where period_id=period;
  if not exists(select 1 from public.office_payroll_attendance_snapshots
     where period_id=period and status='LOCKED') then
    raise exception 'Approved payroll failed to lock reviewed attendance'; end if;
  failed:=false;
  begin
    update public.office_payroll_attendance_snapshots
    set payable_units=12 where period_id=period;
  exception when others then failed:=true; end;
  if not failed then raise exception 'Approved payroll attendance was rewritten'; end if;
end;
$qa$;
select 'HR_PAYROLL_CORRECTION_GUARDS_VERIFIED' as result;
