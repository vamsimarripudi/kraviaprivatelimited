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


-- Do not submit or settle a payroll result whose source snapshot omits an
-- approved leave/holiday that overlaps the payroll period. The reference must
-- be in the salary snapshot's approved source_leave_ids array.
create or replace function public.office_hr_leave_payroll_guard(p_period uuid)
returns void language plpgsql security definer set search_path='' as $kravia_leave$
declare per public.office_payroll_periods%rowtype;
begin
  select * into per from public.office_payroll_periods where id=p_period;
  if not found then raise exception 'Payroll period missing'; end if;

  -- Inspect actual scheduled weekdays. A weekend-only leave request has
  -- no ordinary payable hours and must not freeze monthly wages.
  -- Merely adding a leave ID to source_snapshot is NOT enough: the paid
  -- and unpaid hour totals must reconcile with the approved leave ledger.
  if exists (
    select 1
    from public.office_payroll_attendance_snapshots s
    cross join lateral (
      select
        coalesce(sum(case when l.pay_class<>'UNPAID_LEAVE'
          then l.minutes_per_weekday else 0 end),0)::numeric as paid_minutes,
        coalesce(sum(case when l.pay_class='UNPAID_LEAVE'
          then l.minutes_per_weekday else 0 end),0)::numeric as unpaid_minutes,
        count(*) filter (where not coalesce(
          (s.source_snapshot->'source_leave_ids') ? l.id::text,false)
        ) as missing_references
      from public.office_hr_leave_requests l
      cross join lateral generate_series(
        greatest(l.starts_on,per.starts_on)::timestamp,
        least(l.ends_on,per.ends_on)::timestamp,
        interval '1 day'
      ) as work_date
      where l.employee_user_id=s.employee_user_id
        and l.status='APPROVED'
        and l.starts_on<=per.ends_on
        and l.ends_on>=per.starts_on
        and extract(isodow from work_date) between 1 and 5
    ) verified
    where s.period_id=per.id
      and (verified.missing_references>0
        or abs(s.paid_leave_units*60-verified.paid_minutes)>0.06
        or abs(s.unpaid_leave_units*60-verified.unpaid_minutes)>0.06)
  ) then
    raise exception 'Payroll leave evidence or paid/unpaid hours are stale; re-import independently approved leave and re-review before calculation or payment';
  end if;
end; $kravia_leave$;
revoke all on function public.office_hr_leave_payroll_guard(uuid) from public,anon,authenticated;
grant execute on function public.office_hr_leave_payroll_guard(uuid) to service_role;

-- Preserve existing payroll transition semantics while enforcing the leave
-- freshness gate inside the database, not only in browser UI.

create or replace function public.office_payroll_calculate(p_actor uuid,p_period uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; snap record; comp public.office_compensation_versions%rowtype; pending_count integer; calc_version integer; earn bigint; deduct bigint; employer bigint; prorated bigint; net bigint; payload jsonb; hash text; result_count integer:=0; midperiod_count integer;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status not in ('ATTENDANCE_READY','CALCULATED') then raise exception 'Payroll attendance must be ready before calculation'; end if;
 perform public.office_hr_leave_payroll_guard(per.id);
 select count(*) into pending_count from public.office_payroll_attendance_snapshots where period_id=per.id and unresolved_units>0;
 if pending_count>0 then raise exception 'Payroll contains unresolved attendance units'; end if;
  select count(*) into pending_count from public.office_payroll_attendance_snapshots
  where period_id=per.id and (status<>'REVIEWED' or reviewed_by is null
    or reviewed_by=prepared_by or reviewed_by=employee_user_id or reviewed_at is null);
  if pending_count>0 then raise exception 'Independently reviewed attendance snapshots are required before payroll calculation'; end if;
  if exists(select 1 from public.office_payroll_attendance_snapshots
    where period_id=per.id and
      abs(payable_units+unpaid_leave_units+absence_units+unresolved_units-basis_units)>0.001) then
    raise exception 'Payroll attendance allocation is not reconciled'; end if;
 if per.period_kind='MONTHLY' and exists(
    select 1 from public.office_payroll_attendance_snapshots s
    join public.office_employment_registry e on e.employment_id=s.employment_id
    where s.period_id=per.id and (e.status='PLANNED' or e.start_date is null
      or e.start_date>per.ends_on or (e.end_date is not null and e.end_date<per.starts_on))
 ) then raise exception 'Monthly payroll requires verified employment dates, not planned roles'; end if;
 select count(*) into pending_count from public.office_payroll_adjustments where period_id=per.id and status='DRAFT';
 if pending_count>0 then raise exception 'Payroll contains unreviewed adjustments'; end if;
 calc_version:=per.calculation_version+1;
 update public.office_payroll_results set status='SUPERSEDED' where period_id=per.id and status='CALCULATED';
 for snap in select * from public.office_payroll_attendance_snapshots where period_id=per.id order by employment_id loop
   select count(*) into midperiod_count from public.office_compensation_versions where employment_id=snap.employment_id and status='APPROVED' and effective_from>per.starts_on and effective_from<=per.ends_on;
   if midperiod_count>0 then raise exception 'Mid-period compensation change requires an explicit arrears/off-cycle adjustment before calculation'; end if;
   select * into comp from public.office_compensation_versions where employment_id=snap.employment_id and status='APPROVED' and effective_from<=per.starts_on and (effective_to is null or effective_to>=per.starts_on) order by effective_from desc limit 1;
   if comp.id is null then raise exception 'Approved compensation is missing for payroll employment %',snap.employment_id; end if;
   select coalesce(sum(amount_minor),0) into earn from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='EARNING' and currency=comp.currency;
   select coalesce(sum(amount_minor),0) into deduct from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='DEDUCTION' and currency=comp.currency;
   select coalesce(sum(amount_minor),0) into employer from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='EMPLOYER_COST' and currency=comp.currency;
   if exists(select 1 from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and currency<>comp.currency) then raise exception 'Payroll adjustments must match compensation currency'; end if;
   prorated:=round(comp.monthly_gross_minor::numeric*snap.payable_units/snap.basis_units)::bigint;
   net:=prorated+earn-deduct;
   if net<0 then raise exception 'Payroll deductions exceed payable earnings'; end if;
   payload:=jsonb_build_object('period_id',per.id,'employment_id',snap.employment_id,'compensation_version_id',comp.id,'monthly_gross_minor',comp.monthly_gross_minor,'basis_units',snap.basis_units,'payable_units',snap.payable_units,'paid_leave_units',snap.paid_leave_units,'unpaid_leave_units',snap.unpaid_leave_units,'absence_units',snap.absence_units,'earnings_minor',earn,'deductions_minor',deduct,'employer_costs_minor',employer,'net_pay_minor',net,'currency',comp.currency,'calculation_version',calc_version);
   hash:=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex');
   insert into public.office_payroll_results(period_id,employment_id,employee_user_id,compensation_version_id,currency,base_gross_minor,prorated_gross_minor,additional_earnings_minor,deductions_minor,employer_costs_minor,net_pay_minor,line_items,calculation_snapshot,calculation_hash,calculation_version,calculated_by)
   values(per.id,snap.employment_id,snap.employee_user_id,comp.id,comp.currency,comp.monthly_gross_minor,prorated,earn,deduct,employer,net,jsonb_build_array(jsonb_build_object('code','BASE_GROSS','amount_minor',prorated),jsonb_build_object('code','ADDITIONAL_EARNINGS','amount_minor',earn),jsonb_build_object('code','DEDUCTIONS','amount_minor',deduct),jsonb_build_object('code','EMPLOYER_COSTS','amount_minor',employer)),payload,hash,calc_version,p_actor);
   result_count:=result_count+1;
 end loop;
 if result_count=0 then raise exception 'No payroll attendance snapshots are available'; end if;
 update public.office_payroll_periods set status='CALCULATED',calculation_version=calc_version,approval_request_id=null,updated_at=now() where id=per.id;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,per.id,'PAYROLL_CALCULATED',jsonb_build_object('calculation_version',calc_version,'employee_count',result_count));
 return result_count;
end; $$;

create or replace function public.office_payroll_submit(p_actor uuid,p_period uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; approval uuid; total bigint; employees integer; currencies integer;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status<>'CALCULATED' then raise exception 'Calculated payroll period is required'; end if;
 perform public.office_hr_leave_payroll_guard(per.id);
 select count(*),coalesce(sum(net_pay_minor),0),count(distinct currency) into employees,total,currencies from public.office_payroll_results where period_id=per.id and calculation_version=per.calculation_version and status='CALCULATED';
 if employees=0 then raise exception 'Payroll results are missing'; end if;
 if currencies<>1 then raise exception 'A payroll approval request must contain a single currency batch'; end if;
 approval:=public.office_create_request(p_actor,'PAYROLL_RUN_APPROVAL','Payroll approval · '||per.period_code,'Review '||employees::text||' payroll results with total net pay minor units '||total::text,jsonb_build_object('period_id',per.id,'period_code',per.period_code,'calculation_version',per.calculation_version,'employee_count',employees,'net_total_minor',total),'HIGH',null,'PAYROLL_PERIOD',per.id::text);
 update public.office_payroll_periods set status='PENDING_REVIEW',approval_request_id=approval,updated_at=now() where id=per.id;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,per.id,'PAYROLL_SUBMITTED',jsonb_build_object('approval_request_id',approval,'employee_count',employees,'net_total_minor',total));
 return approval;
end; $$;

create or replace function public.office_payroll_sync_approval(p_actor uuid,p_period uuid)
returns text language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; r public.office_requests%rowtype; final_approver uuid; state text;
begin
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.approval_request_id is null then raise exception 'Payroll approval request is missing'; end if;
 if not public.office_effective_permission(p_actor,'payroll.run.read','COMPANY',null,null) and not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll read permission is required'; end if;
 select * into r from public.office_requests where id=per.approval_request_id;
 if r.id is null then raise exception 'Payroll approval workflow not found'; end if;
 if r.status='APPROVED' then
   perform public.office_hr_leave_payroll_guard(per.id);
   select decision_by into final_approver from public.office_request_steps where request_id=r.id and status='APPROVED' order by step_order desc limit 1;
   update public.office_payroll_periods set status='APPROVED',approved_by=final_approver,approved_at=now(),updated_at=now() where id=per.id;
   update public.office_payroll_results set status='LOCKED' where period_id=per.id and calculation_version=per.calculation_version and status='CALCULATED';
   update public.office_payroll_attendance_snapshots set status='LOCKED',updated_at=now() where period_id=per.id;
   state:='APPROVED';
 elsif r.status='REJECTED' then
   update public.office_payroll_periods set status='CALCULATED',approval_request_id=null,updated_at=now() where id=per.id;
   state:='REJECTED';
 else state:='PENDING_REVIEW'; end if;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,per.id,'PAYROLL_APPROVAL_SYNCED',jsonb_build_object('workflow_status',r.status,'payroll_status',state));
 return state;
end; $$;
