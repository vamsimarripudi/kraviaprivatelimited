-- HR leave evidence is recorded only after a human request and separate review.
-- No leave balances, statutory entitlements, attendance, holidays or pay are seeded.
-- Monthly wages use only approved evidence and independently approved payroll.
create table if not exists public.office_hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  starts_on date not null,
  ends_on date not null,
  pay_class text not null check (pay_class in ('PAID_LEAVE','UNPAID_LEAVE','SICK_PAID','HOLIDAY_PAID')),
  minutes_per_weekday integer not null check(minutes_per_weekday between 30 and 360),
  evidence_reference text not null check(length(trim(evidence_reference))>=8),
  authority_reference text,
  request_reason text not null check(length(trim(request_reason))>=12),
  status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_by uuid not null references public.office_identity_users(user_id),
  reviewed_by uuid references public.office_identity_users(user_id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_hr_leave_date_range check(ends_on>=starts_on and ends_on-starts_on<=61),
  constraint office_hr_leave_independent_review check(
    status<>'APPROVED' or (reviewed_by is not null and reviewed_by<>requested_by
      and reviewed_by<>employee_user_id and reviewed_at is not null)
  ),
  constraint office_hr_leave_paid_authority check (
    pay_class='UNPAID_LEAVE' or length(trim(coalesce(authority_reference,'')))>=10
  )
);
create index if not exists office_hr_leave_employee_period
  on public.office_hr_leave_requests(employee_user_id,starts_on,ends_on,status);

create table if not exists public.office_hr_leave_events (
  id bigint generated always as identity primary key,
  leave_request_id uuid not null references public.office_hr_leave_requests(id),
  actor_user_id uuid not null references public.office_identity_users(user_id),
  event_type text not null check(event_type in ('SUBMITTED','APPROVED','REJECTED','PAYROLL_RECONCILIATION_REQUIRED')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.office_hr_leave_requests enable row level security;
alter table public.office_hr_leave_events enable row level security;
revoke all on public.office_hr_leave_requests,public.office_hr_leave_events from public,anon,authenticated;
grant select,insert,update on public.office_hr_leave_requests to service_role;
grant select,insert on public.office_hr_leave_events to service_role;

create or replace function public.office_hr_leave_submit(
  p_actor uuid,p_employee uuid,p_start date,p_end date,p_pay_class text,
  p_minutes integer,p_evidence text,p_authority text,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $kravia_leave$
declare new_id uuid;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then
    raise exception 'A verified active Office identity must request leave'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_employee and status='ACTIVE') then
    raise exception 'Leave beneficiary must be an active Office identity'; end if;
  if p_actor<>p_employee and (
    not public.office_effective_permission(p_actor,'people.update','COMPANY',null,null)
    or not (exists(select 1 from public.office_user_roles r where r.user_id=p_actor
       and r.role in ('OWNER','DIRECTOR') and (r.expires_at is null or r.expires_at>now()))
      or exists(select 1 from public.office_user_access_profiles h
       where h.user_id=p_actor and h.profile_code='HR_MANAGER' and h.status='ACTIVE'
         and (h.effective_from is null or h.effective_from<=now())
         and (h.expires_at is null or h.expires_at>now())))
  ) then raise exception 'Only the employee or current People/HR officer may submit leave'; end if;
  if p_start < date '2026-08-01' or p_end<p_start or p_end-p_start>61 then
    raise exception 'Leave evidence must have a valid inclusive date range from 1 August 2026'; end if;
  if p_minutes not between 30 and 360 or p_pay_class not in ('PAID_LEAVE','UNPAID_LEAVE','SICK_PAID','HOLIDAY_PAID') then
    raise exception 'Invalid leave classification or paid minutes'; end if;
  if coalesce(length(trim(p_evidence)),0)<8 or coalesce(length(trim(p_reason)),0)<12 then
    raise exception 'Original evidence reference and meaningful leave reason required'; end if;
  if p_pay_class<>'UNPAID_LEAVE' and coalesce(length(trim(p_authority)),0)<10 then
    raise exception 'Paid leave or holiday requires a written policy/approval reference'; end if;
  insert into public.office_hr_leave_requests(employee_user_id,starts_on,ends_on,pay_class,
    minutes_per_weekday,evidence_reference,authority_reference,request_reason,requested_by)
  values(p_employee,p_start,p_end,p_pay_class,p_minutes,trim(p_evidence),nullif(trim(p_authority),''),
    trim(p_reason),p_actor) returning id into new_id;
  insert into public.office_hr_leave_events(leave_request_id,actor_user_id,event_type,detail)
  values(new_id,p_actor,'SUBMITTED',jsonb_build_object('evidence_reference',trim(p_evidence)));
  return new_id;
end; $kravia_leave$;

create or replace function public.office_hr_leave_decide(
  p_actor uuid,p_leave uuid,p_decision text,p_note text
) returns text language plpgsql security definer set search_path='' as $kravia_leave$
declare
  item public.office_hr_leave_requests%rowtype;
  employment public.office_employment_registry%rowtype;
  decision text:=upper(trim(p_decision));
  period record;
begin
  if decision not in ('APPROVE','REJECT') or coalesce(length(trim(p_note)),0)<12 then
    raise exception 'An independent leave decision and evidence review note are required'; end if;
  if not public.office_effective_permission(p_actor,'people.update','COMPANY',null,null)
    or not (exists(select 1 from public.office_user_roles r where r.user_id=p_actor
       and r.role in ('OWNER','DIRECTOR') and (r.expires_at is null or r.expires_at>now()))
      or exists(select 1 from public.office_user_access_profiles h
       where h.user_id=p_actor and h.profile_code='HR_MANAGER' and h.status='ACTIVE'
       and (h.effective_from is null or h.effective_from<=now())
       and (h.expires_at is null or h.expires_at>now()))) then
    raise exception 'Independent HR/Director leave review permission required'; end if;
  select * into item from public.office_hr_leave_requests where id=p_leave for update;
  if not found or item.status<>'PENDING' then raise exception 'Pending leave request not found'; end if;
  if p_actor=item.employee_user_id or p_actor=item.requested_by then
    raise exception 'Leave beneficiary or original submitter cannot approve their own request'; end if;
  if decision='APPROVE' then
    -- Serialise overlapping decisions against the beneficiary's real identity.
    perform 1 from public.office_identity_users where user_id=item.employee_user_id for update;
    select * into employment from public.office_employment_registry
      where identity_user_id=item.employee_user_id and status in ('ACTIVE','ON_LEAVE')
      order by start_date desc nulls last limit 1;
    if employment.employment_id is null or employment.start_date is null
      or employment.start_date>item.starts_on
      or (employment.end_date is not null and employment.end_date<item.ends_on) then
      raise exception 'Paid/unpaid leave requires verified active employment dates'; end if;
    if exists(select 1 from public.office_hr_leave_requests e
       where e.employee_user_id=item.employee_user_id and e.id<>item.id and e.status='APPROVED'
         and daterange(e.starts_on,e.ends_on,'[]') && daterange(item.starts_on,item.ends_on,'[]')) then
      raise exception 'Leave date already covered by an independently approved leave entry'; end if;
  end if;
  update public.office_hr_leave_requests set
     status=case when decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
     reviewed_by=p_actor,reviewed_at=now(),review_note=trim(p_note),updated_at=now()
  where id=p_leave;
  insert into public.office_hr_leave_events(leave_request_id,actor_user_id,event_type,detail)
    values(p_leave,p_actor,case when decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
      jsonb_build_object('review_note',left(trim(p_note),1000)));
  if decision='APPROVE' then
    -- Do not rewrite submitted/approved payroll. Flag later compensation
    -- reconciliation explicitly; never fabricate a bank-settlement record.
    for period in
      select p.id,p.period_code,p.status
      from public.office_payroll_attendance_snapshots s
      join public.office_payroll_periods p on p.id=s.period_id
      where s.employee_user_id=item.employee_user_id and
        p.starts_on<=item.ends_on and p.ends_on>=item.starts_on
        and p.status in ('PENDING_REVIEW','APPROVED','PAYMENT_PREPARED','CLOSED')
    loop
      insert into public.office_hr_leave_events(leave_request_id,actor_user_id,event_type,detail)
      values(p_leave,p_actor,'PAYROLL_RECONCILIATION_REQUIRED',
        jsonb_build_object('period_id',period.id,'period_code',period.period_code,
          'payroll_status',period.status,'reason','Approved leave requires a governed adjustment; locked wages are immutable'));
    end loop;
  end if;
  return case when decision='APPROVE' then 'APPROVED' else 'REJECTED' end;
end; $kravia_leave$;

revoke all on function public.office_hr_leave_submit(uuid,uuid,date,date,text,integer,text,text,text)
  from public,anon,authenticated;
revoke all on function public.office_hr_leave_decide(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.office_hr_leave_submit(uuid,uuid,date,date,text,integer,text,text,text)
  to service_role;
grant execute on function public.office_hr_leave_decide(uuid,uuid,text,text)
  to service_role;
