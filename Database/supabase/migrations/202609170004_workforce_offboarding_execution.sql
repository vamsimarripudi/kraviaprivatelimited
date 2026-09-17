-- Execute an approved offboarding request atomically with fail-closed Office access revocation.

create or replace function public.office_execute_workforce_offboarding(
  p_actor uuid,
  p_target uuid,
  p_request uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  req public.office_requests%rowtype;
  revoked boolean;
begin
  select * into req from public.office_requests where id=p_request for update;
  if req.id is null then raise exception 'Offboarding request not found'; end if;
  if req.request_type_code<>'EMPLOYEE_OFFBOARDING' then raise exception 'Request is not an employee offboarding request'; end if;
  if req.target_user_id is distinct from p_target then raise exception 'Offboarding request target mismatch'; end if;
  if req.status='FULFILLED' then return true; end if;
  if req.status<>'APPROVED' then raise exception 'Approved offboarding request is required'; end if;

  revoked:=public.office_revoke_workforce_access(p_actor,p_target,p_reason);
  if revoked is not true then raise exception 'Workforce access revocation failed'; end if;

  update public.office_requests
  set status='FULFILLED',completed_at=now(),updated_at=now()
  where id=p_request;

  insert into public.office_request_events(request_id,actor_user_id,event_type,from_status,to_status,note,metadata)
  values(p_request,p_actor,'FULFILLED','APPROVED','FULFILLED',left(trim(coalesce(p_reason,'')),2000),jsonb_build_object('target_user_id',p_target,'execution','OFFICE_ACCESS_REVOKED'));
  return true;
end;
$$;

revoke all on function public.office_execute_workforce_offboarding(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_execute_workforce_offboarding(uuid,uuid,uuid,text) to service_role;
