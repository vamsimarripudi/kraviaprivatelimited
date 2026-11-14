-- Enforce a distinct HR/Finance preparer, independent Finance reviewer
-- and separate Owner final approver. The separate owner stage is an actual
-- approved workflow decision, never implied by authority or job title.
-- No salaries, reviewer assignments or approvals are created here.
create or replace function public.office_payroll_maker_checker_guard(p_period uuid,p_request uuid)
returns void language plpgsql security definer set search_path='' as $kravia_payroll$
declare
  period public.office_payroll_periods%rowtype;
  request public.office_requests%rowtype;
  reviewer uuid;
  owner_approver uuid;
begin
  select * into period from public.office_payroll_periods where id=p_period;
  if not found or period.approval_request_id is distinct from p_request then
    raise exception 'Payroll approval request does not match the payroll period';
  end if;
  select * into request from public.office_requests where id=p_request;
  if not found or request.status<>'APPROVED' then
    raise exception 'Payroll approval workflow has not reached an approved decision';
  end if;
  select decision_by into reviewer from public.office_request_steps
    where request_id=p_request and step_code='PAYROLL_REVIEW' and status='APPROVED'
    order by step_order limit 1;
  select decision_by into owner_approver from public.office_request_steps
    where request_id=p_request and step_code='OWNER_APPROVAL' and status='APPROVED'
    order by step_order limit 1;
  if reviewer is null or owner_approver is null
     or reviewer=request.requester_user_id
     or owner_approver=request.requester_user_id
     or reviewer=owner_approver then
    raise exception 'Payroll requires independent preparation, Finance review and a separate Owner approval';
  end if;
  if not exists(select 1 from public.office_user_roles
      where user_id=owner_approver and role='OWNER'
      and (expires_at is null or expires_at>now())) then
    raise exception 'Final payroll approver has no effective Owner authority';
  end if;
  if not public.office_effective_permission(reviewer,'payroll.run.review','COMPANY',null,null) then
    raise exception 'Finance payroll reviewer must hold current delegated review authority';
  end if;
end; $kravia_payroll$;
revoke all on function public.office_payroll_maker_checker_guard(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.office_payroll_maker_checker_guard(uuid,uuid)
  to service_role;

-- Do not rewrite the previously approved salary or leave evidence;
-- only strengthen final payroll synchronization with independent reviewers.

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
   perform public.office_payroll_maker_checker_guard(per.id,r.id);
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

revoke all on function public.office_payroll_sync_approval(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_payroll_sync_approval(uuid,uuid) to service_role;
