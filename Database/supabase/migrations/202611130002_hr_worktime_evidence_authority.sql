-- Permit effective HR_MANAGER access profiles to propose another employee's
-- time evidence and independently review claims. No HR self-review, beneficiary
-- approval, pay-rate approval or salary execution is added.
-- Must run after 202611130001_future_effective_hr_access.sql.
create or replace function public.office_worktime_submit(
  p_actor uuid,p_employee uuid,p_attendance uuid,p_start timestamptz,p_end timestamptz,
  p_breaks jsonb,p_source_kind text,p_source_reference text,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $kravia_payroll$
declare new_id uuid; recorded public.office_attendance_sessions%rowtype; canonical_breaks jsonb;
begin
  if p_actor<>p_employee and (
      not (exists(select 1 from public.office_user_roles r where r.user_id=p_actor
         and r.role in ('OWNER','DIRECTOR') and (r.expires_at is null or r.expires_at>now()))
      or exists(select 1 from public.office_user_access_profiles h
         where h.user_id=p_actor and h.profile_code='HR_MANAGER' and h.status='ACTIVE'
           and (h.effective_from is null or h.effective_from<=now())
           and (h.expires_at is null or h.expires_at>now())))
      or not public.office_effective_permission(p_actor,'people.update','COMPANY',null,null)
    ) then raise exception 'Employee or authorised HR Manager may propose worktime correction'; end if;
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
    if exists(select 1 from public.office_attendance_breaks b
              where b.attendance_session_id=p_attendance and b.ended_at is null) then
      raise exception 'Attendance has an unfinished break'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('startAt',b.started_at,'endAt',b.ended_at)
           order by b.started_at),'[]'::jsonb) into canonical_breaks
      from public.office_attendance_breaks b where b.attendance_session_id=p_attendance;
    -- Never trust client-provided breaks; canonical source is KRAVIA Office attendance.
    p_breaks:=canonical_breaks;
  elsif p_source_kind='HISTORICAL_CORRECTION' and p_attendance is null then
    -- A historical claim has its original timestamp and its actual submission
    -- date; it is never rewritten into a fabricated live check-in.
    -- Validate provided historical break intervals before sending for review.
    if exists(
      select 1 from jsonb_array_elements(coalesce(p_breaks,'[]'::jsonb)) x
      where not (jsonb_typeof(x)='object'
        and x ? 'startAt' and x ? 'endAt'
        and (x->>'startAt') ~ '^20[0-9]{2}-'
        and (x->>'endAt') ~ '^20[0-9]{2}-')
    ) then raise exception 'Historical break timestamps are invalid'; end if;
  else raise exception 'Invalid worktime evidence type'; end if;
  insert into public.office_worktime_review_cases
    (employee_user_id,attendance_session_id,work_starts_at,work_ends_at,
     breaks,source_kind,source_reference,requested_by,request_reason)
  values(p_employee,p_attendance,p_start,p_end,coalesce(p_breaks,'[]'::jsonb),
         p_source_kind,p_source_reference,p_actor,p_reason) returning id into new_id;
  insert into public.office_worktime_events(case_id,actor_user_id,event_type)
  values(new_id,p_actor,'SUBMITTED');
  return new_id;
end; $kravia_payroll$;

create or replace function public.office_worktime_decide(
  p_actor uuid,p_case uuid,p_decision text,p_note text
) returns text language plpgsql security definer set search_path='' as $kravia_payroll$
declare claim public.office_worktime_review_cases%rowtype;
begin
  select * into claim from public.office_worktime_review_cases where id=p_case for update;
  if not found or claim.status<>'PENDING' then raise exception 'Pending worktime claim not found'; end if;
  if p_actor=claim.employee_user_id or p_actor=claim.requested_by then
    raise exception 'Worktime cannot be self-approved'; end if;
  if not (exists(select 1 from public.office_user_roles r where r.user_id=p_actor
         and r.role in ('OWNER','DIRECTOR') and (r.expires_at is null or r.expires_at>now()))
      or exists(select 1 from public.office_user_access_profiles h
         where h.user_id=p_actor and h.profile_code='HR_MANAGER' and h.status='ACTIVE'
           and (h.effective_from is null or h.effective_from<=now())
           and (h.expires_at is null or h.expires_at>now()))) then
    raise exception 'Independent director or effective HR Manager authority is required'; end if;
  if not public.office_effective_permission(p_actor,'people.update','COMPANY',null,null) then
    raise exception 'Reviewer lacks current People department authority'; end if;
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
end; $kravia_payroll$;

-- Keep the SQL service-only boundary; no public/browser RPC execution.
revoke all on function public.office_worktime_submit(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text,text,text)
  from public,anon,authenticated;
revoke all on function public.office_worktime_decide(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.office_worktime_submit(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,text,text,text) to service_role;
grant execute on function public.office_worktime_decide(uuid,uuid,text,text) to service_role;
