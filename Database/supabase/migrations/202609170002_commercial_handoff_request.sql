-- Transactional request creation for the commercial handoff.
-- Each stage creates an approval workflow; it does not execute the downstream business action.

create or replace function public.office_commercial_create_stage_request(
  p_actor uuid,
  p_handoff uuid,
  p_kind text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  h public.office_commercial_handoffs%rowtype;
  opp public.office_crm_opportunities%rowtype;
  prior public.office_requests%rowtype;
  v_kind text:=upper(trim(coalesce(p_kind,'')));
  v_request_type text;
  v_title text;
  v_description text;
  v_priority text;
  v_request uuid;
  owner_dept text;
begin
  select * into h from public.office_commercial_handoffs where id=p_handoff for update;
  if h.id is null then raise exception 'Commercial handoff not found'; end if;
  select * into opp from public.office_crm_opportunities where id=h.opportunity_id;
  if opp.id is null or opp.stage<>'WON' then raise exception 'Commercial handoff requires a won opportunity'; end if;

  select department_code into owner_dept
  from public.office_job_assignments
  where user_id=h.owner_user_id and status in ('ACTIVE','ON_LEAVE')
  limit 1;

  if not (
    public.office_effective_permission(p_actor,'sales.crm.write','OWN',null,h.owner_user_id)
    or (owner_dept is not null and public.office_effective_permission(p_actor,'sales.crm.write','DEPARTMENT',owner_dept,null))
    or public.office_effective_permission(p_actor,'sales.crm.write','COMPANY',null,null)
  ) then raise exception 'Commercial handoff authority required'; end if;

  if v_kind='CONTRACT' then
    if h.contract_request_id is not null then return h.contract_request_id; end if;
    v_request_type:='COMMERCIAL_CONTRACT';
    v_title:='Contract handoff · '||opp.opportunity_code;
    v_description:='Prepare, review and separately authorise the customer contract for '||opp.title||'. Approval does not itself create or sign a contract record.';
    v_priority:='HIGH';
  elsif v_kind='SUBSCRIPTION' then
    if h.subscription_request_id is not null then return h.subscription_request_id; end if;
    if h.contract_request_id is null then raise exception 'Contract handoff must be completed first'; end if;
    select * into prior from public.office_requests where id=h.contract_request_id;
    if prior.id is null or prior.status<>'APPROVED' then raise exception 'Contract handoff approval is required first'; end if;
    v_request_type:='SUBSCRIPTION_ACTIVATION';
    v_title:='Subscription activation handoff · '||opp.opportunity_code;
    v_description:='Prepare commercial and finance readiness for subscription activation. Approval does not activate a provider subscription.';
    v_priority:='HIGH';
  elsif v_kind='INVOICE' then
    if h.invoice_request_id is not null then return h.invoice_request_id; end if;
    if h.subscription_request_id is null then raise exception 'Subscription handoff must be completed first'; end if;
    select * into prior from public.office_requests where id=h.subscription_request_id;
    if prior.id is null or prior.status<>'APPROVED' then raise exception 'Subscription handoff approval is required first'; end if;
    v_request_type:='INVOICE_PREPARATION';
    v_title:='Invoice preparation handoff · '||opp.opportunity_code;
    v_description:='Prepare governed billing inputs for '||opp.title||'. Approval does not issue, send or mark an invoice paid.';
    v_priority:='NORMAL';
  else
    raise exception 'Invalid commercial handoff stage';
  end if;

  v_request:=public.office_create_request(
    p_actor,
    v_request_type,
    v_title,
    v_description,
    jsonb_build_object(
      'handoff_id',h.id,
      'opportunity_id',h.opportunity_id,
      'customer_id',h.customer_id,
      'product_id',h.product_id,
      'commercial_stage',v_kind
    ),
    v_priority,
    null,
    'COMMERCIAL_HANDOFF',
    h.id::text
  );

  if v_kind='CONTRACT' then
    update public.office_commercial_handoffs set contract_request_id=v_request,updated_by=p_actor,updated_at=now() where id=h.id;
  elsif v_kind='SUBSCRIPTION' then
    update public.office_commercial_handoffs set subscription_request_id=v_request,updated_by=p_actor,updated_at=now() where id=h.id;
  else
    update public.office_commercial_handoffs set invoice_request_id=v_request,updated_by=p_actor,updated_at=now() where id=h.id;
  end if;

  insert into public.office_commercial_handoff_events(handoff_id,actor_user_id,event_type,metadata)
  values(h.id,p_actor,v_kind||'_REQUEST_CREATED',jsonb_build_object('request_id',v_request,'request_type',v_request_type));

  return v_request;
end;
$$;

revoke all on function public.office_commercial_create_stage_request(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_commercial_create_stage_request(uuid,uuid,text) to service_role;
