-- Workforce lifecycle requests plus a fail-closed access revocation primitive.
-- Provider/account provisioning remains separate and must be performed by an authorised integration or administrator.

insert into public.office_request_type_catalog(code,label,module,description,requester_permission,fulfillment_permission,default_priority,default_due_hours,high_risk,active) values
('EMPLOYEE_ONBOARDING','Employee Onboarding','PEOPLE','Coordinate people, access and asset readiness for a provisioned Office identity. Approval does not create external provider accounts automatically.','request.create',null,'NORMAL',72,true,true),
('EMPLOYEE_OFFBOARDING','Employee Offboarding','PEOPLE','Coordinate people, asset-return and access-revocation decisions before workforce access is revoked.','request.create',null,'HIGH',24,true,true)
on conflict(code) do update set label=excluded.label,module=excluded.module,description=excluded.description,requester_permission=excluded.requester_permission,fulfillment_permission=excluded.fulfillment_permission,default_priority=excluded.default_priority,default_due_hours=excluded.default_due_hours,high_risk=excluded.high_risk,active=true;

insert into public.office_workflow_templates(code,request_type_code,version,label,description,active) values
('EMPLOYEE_ONBOARDING_V1','EMPLOYEE_ONBOARDING',1,'Employee onboarding','People readiness, access assignment and asset readiness are approved separately.',true),
('EMPLOYEE_OFFBOARDING_V1','EMPLOYEE_OFFBOARDING',1,'Employee offboarding','People decision, asset return and access revocation are approved separately.',true)
on conflict(code,version) do update set request_type_code=excluded.request_type_code,label=excluded.label,description=excluded.description,active=true;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'PEOPLE_READINESS','People readiness','PERMISSION','people.update','people.update',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYEE_ONBOARDING_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'ACCESS_READINESS','Access profile readiness','PERMISSION','access.profile.assign','access.profile.assign',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYEE_ONBOARDING_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,3,'ASSET_READINESS','Asset readiness','PERMISSION','operations.asset.assign','operations.asset.assign',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYEE_ONBOARDING_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'PEOPLE_EXIT','People exit decision','PERMISSION','people.update','people.update',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYEE_OFFBOARDING_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'ASSET_RETURN','Asset return review','PERMISSION','operations.asset.assign','operations.asset.assign',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYEE_OFFBOARDING_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,3,'ACCESS_REVOCATION','Access revocation approval','PERMISSION','access.profile.assign','access.profile.assign',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYEE_OFFBOARDING_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

create or replace function public.office_revoke_workforce_access(p_actor uuid,p_target uuid,p_reason text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_roles text[];
  target_roles text[];
  now_at timestamptz:=now();
begin
  if p_actor=p_target then raise exception 'Self-revocation is not allowed'; end if;
  select coalesce(array_agg(role order by role),'{}'::text[]) into actor_roles
  from public.office_user_roles where user_id=p_actor and (expires_at is null or expires_at>now_at);
  if not ('OWNER'=any(actor_roles) or 'ADMIN'=any(actor_roles)) then raise exception 'OWNER or ADMIN authority is required'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Active administrator identity required'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_target) then raise exception 'Target identity not found'; end if;
  select coalesce(array_agg(role order by role),'{}'::text[]) into target_roles
  from public.office_user_roles where user_id=p_target and (expires_at is null or expires_at>now_at);
  if 'OWNER'=any(target_roles) then raise exception 'OWNER access cannot be revoked through workforce offboarding'; end if;
  if ('DIRECTOR'=any(target_roles) or 'ADMIN'=any(target_roles)) and not ('OWNER'=any(actor_roles)) then raise exception 'Only OWNER may revoke director or administrator access'; end if;

  update public.office_identity_users set status='REVOKED',authorization_version=authorization_version+1,updated_at=now_at where user_id=p_target;
  update public.office_job_assignments set status='ENDED',end_date=coalesce(end_date,current_date),updated_at=now_at where user_id=p_target and status<>'ENDED';
  update public.office_user_access_profiles set status='REVOKED',updated_at=now_at where user_id=p_target and status in ('ACTIVE','SUSPENDED');
  update public.office_user_permission_overrides set expires_at=now_at,updated_at=now_at where user_id=p_target and (expires_at is null or expires_at>now_at);
  update public.office_device_registry set trust_state='REVOKED',revoked_at=coalesce(revoked_at,now_at),binding_token_hash=null,updated_at=now_at where user_id=p_target and trust_state<>'REVOKED';
  update public.office_auth_sessions set status='REVOKED',ended_at=now_at,end_reason='WORKFORCE_OFFBOARDING',updated_at=now_at where user_id=p_target and status='ACTIVE';
  update public.office_user_roles set expires_at=now_at,updated_at=now_at where user_id=p_target and (expires_at is null or expires_at>now_at);

  insert into public.office_workforce_events(client_event_id,actor_user_id,actor_roles,target_user_id,event_type,entity_type,entity_id,metadata)
  values(gen_random_uuid(),p_actor,actor_roles,p_target,'WORKFORCE_ACCESS_REVOKED','IDENTITY',p_target,jsonb_build_object('reason',left(trim(coalesce(p_reason,'')),500)));
  return true;
end;
$$;

revoke all on function public.office_revoke_workforce_access(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_revoke_workforce_access(uuid,uuid,text) to service_role;
