-- Evaluate request-creation permissions against the requester's actual scope.
-- This keeps generic request creation fail-closed while allowing department,
-- product, repository and other scoped access profiles to create legitimate work.

create or replace function public.office_create_request(
  p_requester uuid,
  p_request_type text,
  p_title text,
  p_description text,
  p_payload jsonb default '{}'::jsonb,
  p_priority text default null,
  p_target_user uuid default null,
  p_resource_type text default null,
  p_resource_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  rt public.office_request_type_catalog%rowtype;
  tmpl public.office_workflow_templates%rowtype;
  req_id uuid;
  requester_dept text;
  assigned uuid;
  first_step integer;
  step_rec record;
  active_step boolean;
  resolved_priority text;
  requester_allowed boolean:=false;
  normalized_resource_type text:=upper(trim(coalesce(p_resource_type,'')));
begin
  select coalesce(j.department_code,i.primary_department) into requester_dept
  from public.office_identity_users i left join public.office_job_assignments j on j.user_id=i.user_id
  where i.user_id=p_requester and i.status='ACTIVE';
  if requester_dept is null then raise exception 'Active workforce assignment required'; end if;

  select * into rt from public.office_request_type_catalog where code=p_request_type and active=true;
  if not found then raise exception 'Request type is unavailable'; end if;

  if rt.requester_permission is not null then
    requester_allowed:=
      public.office_effective_permission(p_requester,rt.requester_permission,'OWN',null,p_requester)
      or public.office_effective_permission(p_requester,rt.requester_permission,'DEPARTMENT',requester_dept,null)
      or public.office_effective_permission(p_requester,rt.requester_permission,'COMPANY',null,null);
    if not requester_allowed and normalized_resource_type in ('TEAM','PRODUCT','PROJECT','REPOSITORY','COST_CENTER') and p_resource_key is not null then
      requester_allowed:=public.office_effective_permission(p_requester,rt.requester_permission,normalized_resource_type,p_resource_key,null);
    end if;
    if not requester_allowed then raise exception 'Requester lacks required permission'; end if;
  end if;

  resolved_priority:=coalesce(p_priority,rt.default_priority);
  if resolved_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'Invalid priority'; end if;
  select * into tmpl from public.office_workflow_templates where request_type_code=p_request_type and active=true order by version desc limit 1;
  if not found then raise exception 'No active workflow template'; end if;

  insert into public.office_requests(request_type_code,template_id,requester_user_id,requester_department,target_user_id,resource_type,resource_key,title,description,payload,priority,status,due_at,submitted_at)
  values(p_request_type,tmpl.id,p_requester,requester_dept,p_target_user,p_resource_type,p_resource_key,left(trim(p_title),180),left(trim(p_description),4000),coalesce(p_payload,'{}'::jsonb),resolved_priority,'PENDING',now()+make_interval(hours=>rt.default_due_hours),now())
  returning id into req_id;

  for step_rec in select * from public.office_workflow_template_steps where template_id=tmpl.id order by step_order loop
    active_step:=public.office_condition_is_active(step_rec.condition_json,coalesce(p_payload,'{}'::jsonb));
    assigned:=null;
    if active_step and step_rec.approver_selector='REQUESTER_MANAGER' then
      select reports_to_user_id into assigned from public.office_job_assignments where user_id=p_requester and status in ('ACTIVE','ON_LEAVE');
    elsif active_step and step_rec.approver_selector='OWNER' then
      select r.user_id into assigned from public.office_user_roles r join public.office_identity_users i on i.user_id=r.user_id
      where r.role='OWNER' and i.status='ACTIVE' and (r.expires_at is null or r.expires_at>now()) limit 1;
    end if;
    insert into public.office_request_steps(request_id,template_step_id,step_order,step_code,label,approver_selector,approver_value,required_permission,assigned_user_id,status)
    values(req_id,step_rec.id,step_rec.step_order,step_rec.step_code,step_rec.label,step_rec.approver_selector,step_rec.approver_value,step_rec.required_permission,assigned,case when active_step then 'PENDING' else 'SKIPPED' end);
  end loop;

  select min(step_order) into first_step from public.office_request_steps where request_id=req_id and status='PENDING';
  if first_step is null then
    update public.office_requests set status='APPROVED',current_step_order=null,updated_at=now() where id=req_id;
  else
    update public.office_requests set current_step_order=first_step,updated_at=now() where id=req_id;
  end if;
  insert into public.office_request_events(request_id,actor_user_id,event_type,to_status,metadata)
  values(req_id,p_requester,'REQUEST_SUBMITTED','PENDING',jsonb_build_object('request_type',p_request_type,'priority',resolved_priority));
  insert into public.office_notifications(user_id,request_id,kind,title,body)
  values(p_requester,req_id,'REQUEST_STATUS','Request submitted','Your request is pending approval.');
  select assigned_user_id into assigned from public.office_request_steps where request_id=req_id and step_order=first_step;
  if assigned is not null then
    insert into public.office_notifications(user_id,request_id,kind,title,body)
    values(assigned,req_id,'APPROVAL_REQUIRED','Approval required',left(trim(p_title),180));
  end if;
  return req_id;
end;
$$;

update public.office_request_type_catalog set requester_permission='data.export.request' where code='DATA_EXPORT';
update public.office_request_type_catalog set requester_permission='data.import.request' where code='DATA_IMPORT';

revoke all on function public.office_create_request(uuid,text,text,text,jsonb,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_create_request(uuid,text,text,text,jsonb,text,uuid,text,text) to service_role;
