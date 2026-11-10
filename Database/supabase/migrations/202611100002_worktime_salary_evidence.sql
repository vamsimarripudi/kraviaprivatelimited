-- KRAVIA Office: evidence-led worktime, company-benefit policies and salary documents.
-- NO live employee salary, attendance, payment, policy or user is seeded.
-- Apply after the permanent ownership migration; do not deploy code first.
-- These records supplement canonical attendance, approved payroll results and
-- bank reconciliation. They are not an alternate payroll or payment system.

create table if not exists public.office_worktime_policy_versions (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  effective_from date not null,
  authority_reference text not null,
  regular_daily_minutes integer not null default 360 check (regular_daily_minutes between 60 and 600),
  weekly_target_minutes integer not null default 1800 check (weekly_target_minutes between 60 and 2880),
  reference_monthly_minutes integer not null default 7800 check (reference_monthly_minutes between 60 and 20000),
  weekday_ot_bps integer not null default 20000 check (weekday_ot_bps between 20000 and 100000),
  weekend_bps integer not null default 30000 check (weekend_bps between 20000 and 100000),
  night_premium_bps integer not null default 2000 check (night_premium_bps between 0 and 10000),
  night_from_hour smallint not null default 22 check (night_from_hour between 0 and 23),
  night_until_hour smallint not null default 6 check (night_until_hour between 0 and 23),
  maximum_daily_minutes integer not null default 600 check (maximum_daily_minutes between 60 and 600),
  maximum_weekly_minutes integer not null default 2880 check (maximum_weekly_minutes between 60 and 2880),
  flexible_start_allowed boolean not null default true,
  flex_days_per_month smallint not null default 1 check (flex_days_per_month between 0 and 1),
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','REJECTED','RETIRED')),
  proposed_by uuid not null references public.office_identity_users(user_id),
  approved_by uuid references public.office_identity_users(user_id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint worktime_policy_independent_approval check (
    status <> 'APPROVED' or (approved_by is not null and approved_by <> proposed_by and approved_by <> employee_user_id and approved_at is not null)
  )
);
create unique index if not exists office_worktime_policy_active_at
  on public.office_worktime_policy_versions(employee_user_id,effective_from) where status='APPROVED';

create table if not exists public.office_worktime_review_cases (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  attendance_session_id uuid references public.office_attendance_sessions(id),
  work_starts_at timestamptz not null,
  work_ends_at timestamptz not null,
  breaks jsonb not null default '[]'::jsonb check (jsonb_typeof(breaks)='array'),
  time_zone text not null default 'Asia/Kolkata' check (time_zone='Asia/Kolkata'),
  source_kind text not null check (source_kind in ('RECORDED_SESSION','HISTORICAL_CORRECTION')),
  source_reference text not null check (length(trim(source_reference))>=5),
  requested_by uuid not null references public.office_identity_users(user_id),
  request_reason text not null check (length(trim(request_reason))>=8),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  reviewed_by uuid references public.office_identity_users(user_id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint worktime_review_time_order check (work_ends_at>work_starts_at and work_ends_at-work_starts_at<=interval '24 hours'),
  constraint worktime_review_independence check (status<>'APPROVED' or (reviewed_by is not null and reviewed_by<>employee_user_id and reviewed_by<>requested_by and reviewed_at is not null)),
  constraint worktime_session_source_kind check (
    (source_kind='RECORDED_SESSION' and attendance_session_id is not null) or
    (source_kind='HISTORICAL_CORRECTION' and attendance_session_id is null)
  )
);
create unique index if not exists office_worktime_one_approved_session
  on public.office_worktime_review_cases(attendance_session_id)
  where status='APPROVED' and attendance_session_id is not null;
create index if not exists office_worktime_employee_index
  on public.office_worktime_review_cases(employee_user_id,work_starts_at);

create table if not exists public.office_worktime_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.office_worktime_review_cases(id),
  actor_user_id uuid not null references public.office_identity_users(user_id),
  event_type text not null check (event_type in ('SUBMITTED','APPROVED','REJECTED')),
  created_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb
);

-- Immutable bank-confirmation evidence. PREPARED batches do not create entries.
-- A verified settlement is independently checked, with audit context; a
-- reversal/correction needs a separate controlled event in a later workflow.
create table if not exists public.office_salary_settlement_evidence (
  id uuid primary key default gen_random_uuid(),
  payroll_result_id uuid not null references public.office_payroll_results(id),
  amount_minor bigint not null check (amount_minor>0),
  currency text not null default 'INR' check (currency='INR'),
  credited_at timestamptz not null,
  masked_bank_reference text not null check (length(trim(masked_bank_reference))>=6),
  evidence_reference text not null check (length(trim(evidence_reference))>=8),
  submitted_by uuid not null references public.office_identity_users(user_id),
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED','REJECTED')),
  verified_by uuid references public.office_identity_users(user_id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint salary_settlement_independent_review check (
    status<>'VERIFIED' or (verified_by is not null and verified_by<>submitted_by and verified_at is not null)
  ),
  unique(payroll_result_id,masked_bank_reference)
);

-- One immutable issued-document input snapshot for each approved calculation.
-- A PDF/DOCX renderer may read this snapshot but cannot silently reissue with
-- changed amounts. Payment state is derived separately from bank evidence.
create table if not exists public.office_salary_payslip_issues (
  id uuid primary key default gen_random_uuid(),
  payroll_result_id uuid not null unique references public.office_payroll_results(id),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  issue_code text not null unique,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  snapshot_sha256 text not null check (length(snapshot_sha256)=64),
  issued_by uuid not null references public.office_identity_users(user_id),
  issued_at timestamptz not null default now()
);

alter table public.office_worktime_policy_versions enable row level security;
alter table public.office_worktime_review_cases enable row level security;
alter table public.office_worktime_events enable row level security;
alter table public.office_salary_settlement_evidence enable row level security;
alter table public.office_salary_payslip_issues enable row level security;

revoke all on public.office_worktime_policy_versions,public.office_worktime_review_cases,
  public.office_worktime_events,public.office_salary_settlement_evidence,
  public.office_salary_payslip_issues from public,anon,authenticated;
grant select,insert,update on public.office_worktime_policy_versions,public.office_worktime_review_cases,
  public.office_salary_settlement_evidence to service_role;
grant select,insert on public.office_worktime_events,public.office_salary_payslip_issues to service_role;
grant usage,select on sequence public.office_worktime_events_id_seq to service_role;

create or replace function public.office_worktime_submit(
  p_actor uuid,p_employee uuid,p_attendance uuid,p_start timestamptz,p_end timestamptz,
  p_breaks jsonb,p_source_kind text,p_source_reference text,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; recorded public.office_attendance_sessions%rowtype;
begin
  if p_actor<>p_employee then raise exception 'Only employee self-service may submit worktime; director changes require a correction request'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then
    raise exception 'Active employee identity required'; end if;
  if p_end<=p_start or p_end-p_start>interval '24 hours' then raise exception 'Invalid worktime range'; end if;
  if jsonb_typeof(coalesce(p_breaks,'[]'::jsonb))<>'array' then raise exception 'Breaks must be structured'; end if;
  if length(trim(coalesce(p_source_reference,'')))<5 or length(trim(coalesce(p_reason,'')))<8 then
    raise exception 'Work evidence and a meaningful reason are required'; end if;
  if p_source_kind='RECORDED_SESSION' then
    select * into recorded from public.office_attendance_sessions where id=p_attendance and user_id=p_actor;
    if not found or recorded.check_out_at is null or recorded.check_in_at<>p_start or recorded.check_out_at<>p_end then
      raise exception 'Reviewed time must match a completed recorded session'; end if;
  elsif p_source_kind='HISTORICAL_CORRECTION' and p_attendance is null then
    -- A historical claim has its original timestamp and its actual submission
    -- date; it is never rewritten into a fabricated live check-in.
    null;
  else raise exception 'Invalid worktime evidence type'; end if;
  insert into public.office_worktime_review_cases
    (employee_user_id,attendance_session_id,work_starts_at,work_ends_at,
     breaks,source_kind,source_reference,requested_by,request_reason)
  values(p_employee,p_attendance,p_start,p_end,coalesce(p_breaks,'[]'::jsonb),
         p_source_kind,p_source_reference,p_actor,p_reason) returning id into new_id;
  insert into public.office_worktime_events(case_id,actor_user_id,event_type)
  values(new_id,p_actor,'SUBMITTED');
  return new_id;
end; $$;

create or replace function public.office_worktime_decide(
  p_actor uuid,p_case uuid,p_decision text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare claim public.office_worktime_review_cases%rowtype;
begin
  select * into claim from public.office_worktime_review_cases where id=p_case for update;
  if not found or claim.status<>'PENDING' then raise exception 'Pending worktime claim not found'; end if;
  if p_actor=claim.employee_user_id or p_actor=claim.requested_by then
    raise exception 'Worktime cannot be self-approved'; end if;
  if not exists(select 1 from public.office_user_roles where user_id=p_actor
         and role in ('OWNER','DIRECTOR') and (expires_at is null or expires_at>now())) then
    raise exception 'Independent director authority is required'; end if;
  if p_decision not in ('APPROVE','REJECT') then raise exception 'Invalid review decision'; end if;
  if p_decision='APPROVE' and exists (
    select 1 from public.office_worktime_review_cases e
    where e.employee_user_id=claim.employee_user_id and e.id<>claim.id and e.status='APPROVED'
      and tstzrange(e.work_starts_at,e.work_ends_at,'[)') && tstzrange(claim.work_starts_at,claim.work_ends_at,'[)')
  ) then raise exception 'Worktime overlaps an existing approved claim'; end if;
  update public.office_worktime_review_cases set
    status=case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
    reviewed_by=p_actor,reviewed_at=now(),review_note=p_note where id=p_case;
  insert into public.office_worktime_events(case_id,actor_user_id,event_type,context)
  values(p_case,p_actor,case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
         jsonb_build_object('note',left(coalesce(p_note,''),500)));
  return case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end;
end; $$;

create or replace function public.office_salary_settlement_submit(
  p_actor uuid,p_result uuid,p_amount bigint,p_credited timestamptz,
  p_masked_bank_ref text,p_evidence text
) returns uuid language plpgsql security definer set search_path='' as $$
declare payslip public.office_payroll_results%rowtype; record_id uuid;
begin
  if not public.office_effective_permission(p_actor,'payroll.payment.prepare','COMPANY',null,null) then
    raise exception 'Salary settlement preparation permission required'; end if;
  select * into payslip from public.office_payroll_results where id=p_result and status='LOCKED';
  if not found then raise exception 'An approved locked payroll result is required'; end if;
  if p_amount<=0 or p_amount>payslip.net_pay_minor then raise exception 'Invalid payment amount'; end if;
  if length(trim(coalesce(p_masked_bank_ref,'')))<6 or length(trim(coalesce(p_evidence,'')))<8 then
    raise exception 'Independent bank evidence is required'; end if;
  insert into public.office_salary_settlement_evidence
    (payroll_result_id,amount_minor,currency,credited_at,masked_bank_reference,evidence_reference,submitted_by)
  values(p_result,p_amount,payslip.currency,p_credited,p_masked_bank_ref,p_evidence,p_actor) returning id into record_id;
  return record_id;
end; $$;

create or replace function public.office_salary_settlement_decide(
  p_actor uuid,p_settlement uuid,p_decision text
) returns text language plpgsql security definer set search_path='' as $$
declare rec public.office_salary_settlement_evidence%rowtype; payable bigint; already_paid bigint; employee uuid;
begin
  select * into rec from public.office_salary_settlement_evidence where id=p_settlement for update;
  if not found or rec.status<>'PENDING' then raise exception 'Pending settlement evidence not found'; end if;
  if p_actor=rec.submitted_by then raise exception 'Payment evidence must be independently verified'; end if;
  select net_pay_minor,employee_user_id into payable,employee
  from public.office_payroll_results where id=rec.payroll_result_id for update;
  if p_actor=employee then raise exception 'Employee cannot approve their own salary payment'; end if;
  if not public.office_effective_permission(p_actor,'payroll.run.review','COMPANY',null,null) then
    raise exception 'An independent payroll reviewer is required'; end if;
  if p_decision not in ('VERIFY','REJECT') then raise exception 'Invalid settlement review'; end if;
  if p_decision='VERIFY' then
    select coalesce(sum(amount_minor),0) into already_paid
      from public.office_salary_settlement_evidence
      where payroll_result_id=rec.payroll_result_id and status='VERIFIED';
    if already_paid+rec.amount_minor>payable then raise exception 'Verified bank credits exceed approved salary'; end if;
  end if;
  update public.office_salary_settlement_evidence set
    status=case when p_decision='VERIFY' then 'VERIFIED' else 'REJECTED' end,
    verified_by=p_actor,verified_at=now() where id=p_settlement;
  return case when p_decision='VERIFY' then 'VERIFIED' else 'REJECTED' end;
end; $$;

create or replace function public.office_salary_slip_issue(p_actor uuid,p_result uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare rec record; payload jsonb; digest text; saved_id uuid;
begin
  if not public.office_effective_permission(p_actor,'payroll.run.review','COMPANY',null,null) then
    raise exception 'Payroll review authority is required to issue a wage slip'; end if;
  select r.*,p.period_code,p.starts_on,p.ends_on,p.status as period_status,
         i.display_name,e.employment_code,c.annual_ctc_minor,c.monthly_gross_minor
  into rec from public.office_payroll_results r
    join public.office_payroll_periods p on p.id=r.period_id
    join public.office_identity_users i on i.user_id=r.employee_user_id
    join public.office_employment_registry e on e.employment_id=r.employment_id
    join public.office_compensation_versions c on c.id=r.compensation_version_id
  where r.id=p_result;
  if not found or rec.status<>'LOCKED' or rec.period_status not in ('APPROVED','PAYMENT_PREPARED') then
    raise exception 'A Board-controlled approved payroll result is required'; end if;
  payload:=jsonb_build_object(
    'company_name','KRAVIA PRIVATE LIMITED','cin','U62011AP2026PTC126691',
    'employee_name',rec.display_name,'employee_id',rec.employment_code,
    'employee_user_id',rec.employee_user_id,'period_code',rec.period_code,
    'period_start',rec.starts_on,'period_end',rec.ends_on,'currency',rec.currency,
    'annual_ctc_minor',rec.annual_ctc_minor,'monthly_gross_minor',rec.monthly_gross_minor,
    'gross_earned_minor',rec.prorated_gross_minor+rec.additional_earnings_minor,
    'base_gross_minor',rec.prorated_gross_minor,'additional_earnings_minor',rec.additional_earnings_minor,
    'deductions_minor',rec.deductions_minor,'net_pay_minor',rec.net_pay_minor,
    'line_items',rec.line_items,'calculation_version',rec.calculation_version,
    'calculation_hash',rec.calculation_hash,'issued_at',now());
  digest:=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex');
  insert into public.office_salary_payslip_issues
    (payroll_result_id,employee_user_id,issue_code,snapshot,snapshot_sha256,issued_by)
  values(rec.id,rec.employee_user_id,'KPL-PAY-'||rec.period_code||'-'||rec.employment_code,
         payload,digest,p_actor)
  on conflict(payroll_result_id) do nothing returning id into saved_id;
  if saved_id is null then select id into saved_id from public.office_salary_payslip_issues
    where payroll_result_id=rec.id; end if;
  return saved_id;
end; $$;

-- Signed wage-slip facts and settlement reports are immutable evidence.
create or replace function public.office_prohibit_wage_evidence_rewrite()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Issued payroll evidence is immutable; use a versioned corrective record';
end; $$;
drop trigger if exists office_salary_issue_write_once on public.office_salary_payslip_issues;
create trigger office_salary_issue_write_once before update or delete
  on public.office_salary_payslip_issues for each row execute function public.office_prohibit_wage_evidence_rewrite();
drop trigger if exists office_salary_evidence_no_delete on public.office_salary_settlement_evidence;
create trigger office_salary_evidence_no_delete before delete
  on public.office_salary_settlement_evidence for each row execute function public.office_prohibit_wage_evidence_rewrite();

revoke all on function public.office_worktime_submit(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.office_worktime_decide(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_salary_settlement_submit(uuid,uuid,bigint,timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.office_salary_settlement_decide(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_salary_slip_issue(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_prohibit_wage_evidence_rewrite() from public,anon,authenticated;
grant execute on function public.office_worktime_submit(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text,text,text) to service_role;
grant execute on function public.office_worktime_decide(uuid,uuid,text,text) to service_role;
grant execute on function public.office_salary_settlement_submit(uuid,uuid,bigint,timestamptz,text,text) to service_role;
grant execute on function public.office_salary_settlement_decide(uuid,uuid,text) to service_role;
grant execute on function public.office_salary_slip_issue(uuid,uuid) to service_role;
