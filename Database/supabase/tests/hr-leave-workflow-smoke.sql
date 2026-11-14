-- Disposable PostgreSQL verification; no live HR rows are inserted.
do $qa$
declare
  employee constant uuid := 'f0000000-0000-4000-8000-000000000004';
  reviewer constant uuid := 'f0000000-0000-4000-8000-000000000003';
  director constant uuid := 'f0000000-0000-4000-8000-000000000001';
  emp uuid;
  leave_id uuid;
  other_leave_id uuid;
  v_period uuid;
  failed boolean;
begin
  insert into public.office_employment_registry(employment_code,identity_user_id,status,start_date)
  values('HR-LEAVE-QA',employee,'ACTIVE','2026-08-01') returning employment_id into emp;
  leave_id:=public.office_hr_leave_submit(employee,employee,'2026-10-19','2026-10-19',
    'PAID_LEAVE',360,'Signed leave request case HR-2026-001',
    'EMPLOYEE-LEAVE-POLICY-2026','Approved policy entitlement requested by employee');
  if not exists(select 1 from public.office_hr_leave_requests where id=leave_id and status='PENDING') then
    raise exception 'Paid leave request was not staged for independent approval'; end if;
  failed:=false;
  begin
    perform public.office_hr_leave_decide(employee,leave_id,'APPROVE',
      'Self approval attempt is not authorised');
  exception when others then failed:=true; end;
  if not failed then raise exception 'Leave beneficiary approved own request'; end if;

  if public.office_hr_leave_decide(reviewer,leave_id,'APPROVE',
      'Validated original leave evidence and recorded written company entitlement')<>'APPROVED' then
    raise exception 'Independent leave approval failed'; end if;
  if not exists(select 1 from public.office_hr_leave_requests
      where id=leave_id and status='APPROVED' and reviewed_by=reviewer) then
    raise exception 'Approved leave reviewer evidence is missing'; end if;

  other_leave_id:=public.office_hr_leave_submit(employee,employee,
      '2026-10-19','2026-10-19','UNPAID_LEAVE',180,
      'HR second request case 2026-002',null,'Attempt to submit overlapping leave twice');
  failed:=false;
  begin
    perform public.office_hr_leave_decide(reviewer,other_leave_id,'APPROVE',
      'Independent reviewer should reject duplicate pay classifications');
  exception when others then failed:=true; end;
  if not failed then raise exception 'Overlapping paid and unpaid leave were both approved'; end if;

  insert into public.office_payroll_periods(period_code,starts_on,ends_on,status)
    values('HR-LEAVE-2026-10','2026-10-01','2026-10-31','ATTENDANCE_READY')
    returning id into v_period;
  insert into public.office_payroll_attendance_snapshots(period_id,employment_id,
      prepared_by,source_snapshot)
    values(v_period,emp,director,'{"source":"HR_EVIDENCE_REVIEW","evidence_reference":"TIMESHEET-001","note":"Payroll hours need leave review"}'::jsonb);
  failed:=false;
  begin
    perform public.office_hr_leave_payroll_guard(v_period);
  exception when others then failed:=true; end;
  if not failed then raise exception 'Payroll accepted an approved leave entry omitted from the snapshot'; end if;

  -- Forged source references must NOT silently validate leave when payable
  -- hours still omit the six-hour paid entitlement.
  update public.office_payroll_attendance_snapshots
    set source_snapshot=jsonb_build_object('source','HR_EVIDENCE_REVIEW',
      'evidence_reference','TIMESHEET-001',
      'note','The approved leave record was reconciled',
      'source_leave_ids',jsonb_build_array(leave_id::text))
    where period_id=v_period;
  failed:=false;
  begin
    perform public.office_hr_leave_payroll_guard(v_period);
  exception when others then failed:=true; end;
  if not failed then raise exception 'A leave ID alone bypassed paid hours reconciliation'; end if;

  update public.office_payroll_attendance_snapshots
    set payable_units=12,paid_leave_units=6,unresolved_units=114
    where period_id=v_period;
  perform public.office_hr_leave_payroll_guard(v_period);
  failed:=false;
  begin
    update public.office_payroll_attendance_snapshots
      set paid_leave_units=0 where period_id=v_period;
    perform public.office_hr_leave_payroll_guard(v_period);
  exception when others then failed:=true; end;
  if not failed then raise exception 'A modified paid leave balance passed without reconciliation'; end if;
end;
$qa$;
select 'HR_LEAVE_INDEPENDENT_PAYROLL_VERIFIED' as result;
