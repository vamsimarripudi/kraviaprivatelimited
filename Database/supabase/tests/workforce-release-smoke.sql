-- Run only in ephemeral CI PostgreSQL, after fixtures + migrations.
-- Test transaction never commits actual pay, policies or ownership transfers.
begin;
do $$
declare
  founder uuid := 'f0000000-0000-4000-8000-000000000001';
  recipient uuid := 'f0000000-0000-4000-8000-000000000002';
  reviewer uuid := 'f0000000-0000-4000-8000-000000000003';
  worker uuid := 'f0000000-0000-4000-8000-000000000004';
  transfer_id uuid; rule_id uuid; shift_id uuid;
  flex_id uuid; slip_id uuid; salary_id uuid;
  settlement_id uuid; i integer;
  outcome text;
begin
  -- Policy can only become effective after distinct director review.
  rule_id:=public.office_worktime_policy_propose(founder,worker,'2026-08-01','KPL-BOARD-WORKTIME-2026-08');
  outcome:=public.office_worktime_policy_decide(reviewer,rule_id,'APPROVE');
  if outcome<>'APPROVED' then raise exception 'Policy not approved'; end if;

  -- Five distinct approved six-hour weekdays qualify for one extra Flex Day.
  for i in 3..7 loop
    shift_id:=public.office_worktime_submit(
      worker,worker,null,
      (('2026-08-'||lpad(i::text,2,'0')||' 10:00:00')::timestamp at time zone 'Asia/Kolkata'),
      (('2026-08-'||lpad(i::text,2,'0')||' 16:00:00')::timestamp at time zone 'Asia/Kolkata'),
      '[]'::jsonb,'HISTORICAL_CORRECTION','SIGNED-WORKLOG-202608',
      'Historically recorded approved six-hour duty');
    outcome:=public.office_worktime_decide(founder,shift_id,'APPROVE','Signed work log verified');
    if outcome<>'APPROVED' then raise exception 'Worktime not approved'; end if;
  end loop;
  flex_id:=public.office_flex_day_request(worker,'2026-08-03','2026-08-10');
  outcome:=public.office_flex_day_decide(founder,flex_id,'APPROVE','30h Mon-Fri verified');
  if outcome<>'APPROVED' then raise exception 'Flex leave not approved'; end if;
  begin
    perform public.office_flex_day_request(worker,'2026-08-03','2026-08-11');
    raise exception 'Duplicate Flex Day erroneously accepted';
  exception when others then
    if sqlerrm='Duplicate Flex Day erroneously accepted' then raise; end if;
  end;

  -- Prepare existing canonical approved/locked payroll evidence.
  insert into public.office_employment_registry(employment_id,employment_code)
    values('e0000000-0000-4000-8000-000000000001','KPL-EMP-01');
  insert into public.office_compensation_versions(id,annual_ctc_minor,monthly_gross_minor)
    values('c0000000-0000-4000-8000-000000000001',48000000,4000000);
  insert into public.office_payroll_periods(id,period_code,starts_on,ends_on,status)
    values('a0000000-0000-4000-8000-000000000001','2026-08','2026-08-01','2026-08-31','APPROVED');
  insert into public.office_payroll_results(id,period_id,employee_user_id,employment_id,
    compensation_version_id,currency,base_gross_minor,prorated_gross_minor,
    additional_earnings_minor,deductions_minor,net_pay_minor,line_items,
    calculation_version,calculation_hash,status)
    values('b0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000001',worker,
      'e0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001',
      'INR',4000000,4000000,0,0,4000000,'[]'::jsonb,1,
      'fixture-approved-payroll-calculation','LOCKED');
  salary_id:='b0000000-0000-4000-8000-000000000001';
  slip_id:=public.office_salary_slip_issue(reviewer,salary_id);
  if slip_id is null or public.office_salary_slip_integrity_check(slip_id) is distinct from true then
    raise exception 'Locked salary slip digest check failed'; end if;
  if public.office_salary_slip_issue(reviewer,salary_id)<>slip_id then
    raise exception 'Salary-slip issuance is not idempotent'; end if;

  -- One payment is only considered valid after a different reviewer verifies.
  settlement_id:=public.office_salary_settlement_submit(
    founder,salary_id,1500000,'2026-08-28 10:00:00+05:30','HDFC****1234','BANK-EVIDENCE-TEST-0001');
  outcome:=public.office_salary_settlement_decide(reviewer,settlement_id,'VERIFY');
  if outcome<>'VERIFIED' then raise exception 'Independent payment verification failed'; end if;
  if (select sum(amount_minor) from public.office_salary_settlement_evidence
      where payroll_result_id=salary_id and status='VERIFIED')<>1500000 then
    raise exception 'Verified partial wage balance did not reconcile'; end if;
  begin
    update public.office_salary_payslip_issues set snapshot='{}'::jsonb where id=slip_id;
    raise exception 'Issued payslip incorrectly mutable';
  exception when others then
    if sqlerrm='Issued payslip incorrectly mutable' then raise; end if;
  end;

  -- Ownership transfer must be accepted by another identity.
  transfer_id:=public.office_department_transfer_propose(
    founder,'FINANCE',recipient,'Permanent operational Finance handover');
  if public.office_department_permission_verdict(founder,'finance.payment.prepare')='DENY' then
    raise exception 'Pending transfer prematurely denied former owner'; end if;
  begin
    perform public.office_department_transfer_accept(founder,transfer_id);
    raise exception 'Founder improperly accepted their own transfer';
  exception when others then
    if sqlerrm='Founder improperly accepted their own transfer' then raise; end if;
  end;
  if public.office_department_transfer_accept(recipient,transfer_id)<>'ACCEPTED' then
    raise exception 'Recipient could not accept transfer'; end if;
  if public.office_department_permission_verdict(founder,'finance.payment.prepare')<>'DENY' then
    raise exception 'Founder retained Finance mutation after handover'; end if;
  if public.office_effective_permission(founder,'payroll.payment.prepare','COMPANY',null,null) then
    raise exception 'Former Founder Finance bypass remains'; end if;
  if not public.office_effective_permission(founder,'finance.read','COMPANY',null,null) then
    raise exception 'Founder incorrectly lost Finance read rights'; end if;
  if public.office_department_permission_verdict(recipient,'finance.payment.prepare')<>'DEPARTMENT_OWNER' then
    raise exception 'New Finance owner did not gain ownership authority'; end if;
  begin
    perform public.office_salary_settlement_submit(
      founder,salary_id,100000,'2026-08-29 10:00:00+05:30','HDFC****5678','BANK-EVIDENCE-TEST-0002');
    raise exception 'Transferred Founder still mutated Finance payroll';
  exception when others then
    if sqlerrm='Transferred Founder still mutated Finance payroll' then raise; end if;
  end;
end $$;
rollback;
select 'WORKFORCE_MIGRATIONS_VERIFIED' as result;
