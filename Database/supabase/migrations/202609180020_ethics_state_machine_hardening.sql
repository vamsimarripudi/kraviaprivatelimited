-- KRAVIA Office OS — ethics state-machine hardening.
-- Enforces explicit investigation progression before independent review.

create or replace function public.office_ethics_transition(
 p_actor uuid,p_case uuid,p_status text,p_outcome text,p_reporter_outcome text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_ethics_cases%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into c from public.office_ethics_cases where id=p_case for update;
 if c.id is null then raise exception 'Ethics case not found'; end if;

 if p_actor=c.reporter_user_id and target='WITHDRAWN' then
  if c.status not in ('SUBMITTED','TRIAGE') then raise exception 'Case can no longer be withdrawn by reporter'; end if;
  update public.office_ethics_cases set status='WITHDRAWN',updated_at=now(),closed_at=now() where id=c.id;
  insert into public.office_ethics_events(case_id,actor_user_id,event_type,previous_status,new_status)
  values(c.id,p_actor,'CASE_WITHDRAWN',c.status,'WITHDRAWN');
  return 'WITHDRAWN';
 end if;

 review:=target in ('CLOSED','UNSUBSTANTIATED');
 if review then
  if not public.office_effective_permission(p_actor,'ethics.case.review','COMPANY',null,null) then
    raise exception 'Independent ethics review permission is required';
  end if;
  if p_actor=c.reporter_user_id or p_actor=c.investigator_user_id then
    raise exception 'Reporter/investigator cannot independently close the same ethics case';
  end if;
  if c.status<>'AWAITING_REVIEW' then raise exception 'Case awaiting independent review is required'; end if;
  if nullif(trim(coalesce(p_outcome,'')),'') is null
     or nullif(trim(coalesce(p_reporter_outcome,'')),'') is null then
    raise exception 'Restricted and reporter-safe outcome summaries are required';
  end if;
 else
  if not public.office_effective_permission(p_actor,'ethics.case.manage','COMPANY',null,null)
     or p_actor<>c.investigator_user_id then
    raise exception 'Assigned investigator authority is required';
  end if;
  if c.status='TRIAGE' and target<>'INVESTIGATING' then
    raise exception 'Triaged case must enter investigation';
  elsif c.status='INVESTIGATING' and target not in ('ACTION_PENDING','AWAITING_REVIEW') then
    raise exception 'Investigating case must move to action pending or independent review';
  elsif c.status='ACTION_PENDING' and target not in ('INVESTIGATING','AWAITING_REVIEW') then
    raise exception 'Action-pending case must return to investigation or independent review';
  elsif c.status not in ('TRIAGE','INVESTIGATING','ACTION_PENDING') then
    raise exception 'Current ethics case state cannot be transitioned by investigator';
  end if;
 end if;

 update public.office_ethics_cases
 set status=target,
     reviewer_user_id=case when review then p_actor else reviewer_user_id end,
     outcome_summary=case when review then trim(p_outcome) else outcome_summary end,
     reporter_safe_outcome=case when review then trim(p_reporter_outcome) else reporter_safe_outcome end,
     updated_at=now(),
     closed_at=case when review then now() else closed_at end
 where id=c.id;

 insert into public.office_ethics_events(case_id,actor_user_id,event_type,previous_status,new_status)
 values(c.id,p_actor,'CASE_TRANSITION',c.status,target);
 return target;
end;
$$;

revoke all on function public.office_ethics_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.office_ethics_transition(uuid,uuid,text,text,text) to service_role;
