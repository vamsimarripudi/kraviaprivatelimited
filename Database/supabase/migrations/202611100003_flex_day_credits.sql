-- KRAVIA: one additional paid Flex Day per 30-hour verified workweek,
-- capped at one earned day per calendar month. No data is backfilled.
-- Employee self-request; independent director decides. Payroll always uses
-- existing approved attendance snapshots, not a separate salary engine.

create table if not exists public.office_flex_day_requests (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  earned_month text not null check (earned_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  earned_week_monday date not null,
  leave_date date not null,
  qualifying_work_minutes numeric(10,3) not null check (qualifying_work_minutes >= 1800),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_by uuid not null references public.office_identity_users(user_id),
  reviewed_by uuid references public.office_identity_users(user_id),
  reviewed_at timestamptz,
  requested_at timestamptz not null default now(),
  review_note text,
  constraint flex_day_independent_approval check (
    status <> 'APPROVED' or (reviewed_by is not null and reviewed_by <> employee_user_id
       and reviewed_by <> requested_by and reviewed_at is not null)
  )
);
create unique index if not exists office_one_flex_day_per_month
  on public.office_flex_day_requests(employee_user_id,earned_month)
  where status in ('PENDING','APPROVED');
create index if not exists office_flex_employee_leave_date
  on public.office_flex_day_requests(employee_user_id,leave_date);

alter table public.office_flex_day_requests enable row level security;
revoke all on public.office_flex_day_requests from public,anon,authenticated;
grant select,insert,update on public.office_flex_day_requests to service_role;

create or replace function public.office_flex_day_request(
  p_actor uuid, p_week_monday date, p_leave_date date
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  rule_rec public.office_worktime_policy_versions%rowtype;
  first_at timestamptz;
  last_at timestamptz;
  worked numeric;
  earned_month_code text;
  request_id uuid;
begin
  if not exists(select 1 from public.office_identity_users
      where user_id=p_actor and status='ACTIVE') then raise exception 'Active employee identity required'; end if;
  if extract(isodow from p_week_monday)<>1 then raise exception 'Qualifying week must begin Monday'; end if;
  earned_month_code:=to_char(p_week_monday+4,'YYYY-MM');
  if p_leave_date < p_week_monday+7 or p_leave_date >=
     (date_trunc('month',(p_week_monday+4)::timestamp)+interval '2 months')::date then
    raise exception 'Paid Flex Day must be used in a later week within the allowed carry window'; end if;
  if extract(isodow from p_leave_date)>5 then raise exception 'Flex Day must fall on a scheduled weekday'; end if;
  select * into rule_rec from public.office_worktime_policy_versions
    where employee_user_id=p_actor and status='APPROVED' and effective_from<=p_week_monday
    order by effective_from desc limit 1;
  if not found or rule_rec.flex_days_per_month<1 then raise exception 'Approved Flex Day policy required'; end if;
  first_at:=p_week_monday::timestamp at time zone 'Asia/Kolkata';
  last_at:=(p_week_monday+5)::timestamp at time zone 'Asia/Kolkata';
  select coalesce(sum(
      greatest(0,extract(epoch from
        least(c.work_ends_at,last_at)-greatest(c.work_starts_at,first_at))/60)
      - coalesce((select sum(greatest(0,extract(epoch from
          least((b->>'endAt')::timestamptz,last_at)
          -greatest((b->>'startAt')::timestamptz,first_at))/60))
        from jsonb_array_elements(c.breaks) b),0)
    ),0) into worked
  from public.office_worktime_review_cases c
  where c.employee_user_id=p_actor and c.status='APPROVED'
    and c.work_starts_at<last_at and c.work_ends_at>first_at;
  if worked < rule_rec.weekly_target_minutes then
    raise exception 'Verified 30-hour qualifying workweek not yet recorded'; end if;
  if exists(select 1 from public.office_flex_day_requests where employee_user_id=p_actor
       and earned_month=earned_month_code and status in ('PENDING','APPROVED')) then
    raise exception 'Only one Flex Day credit per month'; end if;
  insert into public.office_flex_day_requests
    (employee_user_id,earned_month,earned_week_monday,leave_date,qualifying_work_minutes,requested_by)
  values(p_actor,earned_month_code,p_week_monday,p_leave_date,worked,p_actor)
  returning id into request_id;
  return request_id;
end; $$;

create or replace function public.office_flex_day_decide(
  p_actor uuid,p_flex uuid,p_decision text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare claim public.office_flex_day_requests%rowtype;
begin
  select * into claim from public.office_flex_day_requests where id=p_flex for update;
  if not found or claim.status<>'PENDING' then raise exception 'Pending Flex Day not found'; end if;
  if p_actor=claim.employee_user_id or p_actor=claim.requested_by then
    raise exception 'Paid Flex Day cannot be self-approved'; end if;
  if not exists(select 1 from public.office_user_roles where user_id=p_actor
      and role in ('OWNER','DIRECTOR') and (expires_at is null or expires_at>now()))
    or not public.office_effective_permission(p_actor,'people.update','COMPANY',null,null) then
    raise exception 'Current independent director People authority required'; end if;
  if p_decision not in ('APPROVE','REJECT') then raise exception 'Invalid Flex Day decision'; end if;
  update public.office_flex_day_requests
    set status=case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end,
        reviewed_by=p_actor,reviewed_at=now(),review_note=p_note
  where id=p_flex;
  return case when p_decision='APPROVE' then 'APPROVED' else 'REJECTED' end;
end; $$;

revoke all on function public.office_flex_day_request(uuid,date,date) from public,anon,authenticated;
revoke all on function public.office_flex_day_decide(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_flex_day_request(uuid,date,date) to service_role;
grant execute on function public.office_flex_day_decide(uuid,uuid,text,text) to service_role;
