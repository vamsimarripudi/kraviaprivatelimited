-- Governed CRM -> contract -> subscription -> billing handoff.
-- This migration orchestrates preparation/approval work only. It does not execute
-- contracts, activate subscriptions or issue invoices automatically.

create table if not exists public.office_commercial_handoffs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.office_crm_opportunities(id) on delete restrict,
  customer_id varchar not null references public.customers(id) on delete restrict,
  product_id varchar not null references public.products(id) on delete restrict,
  owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  status text not null default 'OPEN' check (status in ('OPEN','BLOCKED','COMPLETE')),
  contract_request_id uuid references public.office_requests(id) on delete set null,
  subscription_request_id uuid references public.office_requests(id) on delete set null,
  invoice_request_id uuid references public.office_requests(id) on delete set null,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  updated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_commercial_handoffs_customer_idx
  on public.office_commercial_handoffs(customer_id, product_id, status);
create index if not exists office_commercial_handoffs_owner_idx
  on public.office_commercial_handoffs(owner_user_id, status);

create table if not exists public.office_commercial_handoff_events (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.office_commercial_handoffs(id) on delete cascade,
  actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists office_commercial_handoff_events_handoff_idx
  on public.office_commercial_handoff_events(handoff_id, created_at desc);

alter table public.office_commercial_handoffs enable row level security;
alter table public.office_commercial_handoff_events enable row level security;
revoke all on public.office_commercial_handoffs from anon, authenticated;
revoke all on public.office_commercial_handoff_events from anon, authenticated;
grant select, insert, update on public.office_commercial_handoffs to service_role;
grant select, insert on public.office_commercial_handoff_events to service_role;

insert into public.office_request_type_catalog(
  code,label,module,description,requester_permission,fulfillment_permission,
  default_priority,default_due_hours,high_risk,active
) values
  ('COMMERCIAL_CONTRACT','Commercial Contract Handoff','LEGAL','Prepare, review and execute a customer contract after a CRM opportunity is won.',null,null,'HIGH',72,true,true),
  ('SUBSCRIPTION_ACTIVATION','Subscription Activation Handoff','COMMERCIAL','Prepare and approve subscription activation after commercial terms are ready.',null,null,'HIGH',48,true,true),
  ('INVOICE_PREPARATION','Invoice Preparation Handoff','FINANCE','Prepare billing inputs after a won opportunity without issuing an invoice automatically.',null,null,'NORMAL',48,false,true)
on conflict (code) do update set
  label=excluded.label,
  module=excluded.module,
  description=excluded.description,
  requester_permission=excluded.requester_permission,
  fulfillment_permission=excluded.fulfillment_permission,
  default_priority=excluded.default_priority,
  default_due_hours=excluded.default_due_hours,
  high_risk=excluded.high_risk,
  active=true;

insert into public.office_workflow_templates(code,request_type_code,version,label,description,active)
values
  ('COMMERCIAL_CONTRACT_V1','COMMERCIAL_CONTRACT',1,'Commercial contract handoff','Legal review followed by separately authorised execution.',true),
  ('SUBSCRIPTION_ACTIVATION_V1','SUBSCRIPTION_ACTIVATION',1,'Subscription activation handoff','Commercial review followed by finance readiness review.',true),
  ('INVOICE_PREPARATION_V1','INVOICE_PREPARATION',1,'Invoice preparation handoff','Finance prepares billing inputs; approval does not issue an invoice.',true)
on conflict (code,version) do update set
  request_type_code=excluded.request_type_code,
  label=excluded.label,
  description=excluded.description,
  active=true;

insert into public.office_workflow_template_steps(
  template_id,step_order,step_code,label,approver_selector,approver_value,
  required_permission,min_approvals,allow_self_approval,condition_json
)
select id,1,'LEGAL_REVIEW','Legal contract review','PERMISSION','legal.contract.review','legal.contract.review',1,false,'{}'::jsonb
from public.office_workflow_templates where code='COMMERCIAL_CONTRACT_V1' and version=1
on conflict (template_id,step_order) do update set
  step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,
  approver_value=excluded.approver_value,required_permission=excluded.required_permission,
  min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(
  template_id,step_order,step_code,label,approver_selector,approver_value,
  required_permission,min_approvals,allow_self_approval,condition_json
)
select id,2,'CONTRACT_EXECUTION','Authorised contract execution','PERMISSION','legal.contract.execute','legal.contract.execute',1,false,'{}'::jsonb
from public.office_workflow_templates where code='COMMERCIAL_CONTRACT_V1' and version=1
on conflict (template_id,step_order) do update set
  step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,
  approver_value=excluded.approver_value,required_permission=excluded.required_permission,
  min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(
  template_id,step_order,step_code,label,approver_selector,approver_value,
  required_permission,min_approvals,allow_self_approval,condition_json
)
select id,1,'COMMERCIAL_REVIEW','Commercial readiness review','PERMISSION','sales.crm.write','sales.crm.write',1,false,'{}'::jsonb
from public.office_workflow_templates where code='SUBSCRIPTION_ACTIVATION_V1' and version=1
on conflict (template_id,step_order) do update set
  step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,
  approver_value=excluded.approver_value,required_permission=excluded.required_permission,
  min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(
  template_id,step_order,step_code,label,approver_selector,approver_value,
  required_permission,min_approvals,allow_self_approval,condition_json
)
select id,2,'FINANCE_READINESS','Finance readiness review','PERMISSION','finance.read','finance.read',1,false,'{}'::jsonb
from public.office_workflow_templates where code='SUBSCRIPTION_ACTIVATION_V1' and version=1
on conflict (template_id,step_order) do update set
  step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,
  approver_value=excluded.approver_value,required_permission=excluded.required_permission,
  min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(
  template_id,step_order,step_code,label,approver_selector,approver_value,
  required_permission,min_approvals,allow_self_approval,condition_json
)
select id,1,'FINANCE_PREPARATION','Finance billing preparation','PERMISSION','finance.master.write','finance.master.write',1,false,'{}'::jsonb
from public.office_workflow_templates where code='INVOICE_PREPARATION_V1' and version=1
on conflict (template_id,step_order) do update set
  step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,
  approver_value=excluded.approver_value,required_permission=excluded.required_permission,
  min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

create or replace function public.office_commercial_initialize_handoff(p_actor uuid,p_opportunity uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  opp public.office_crm_opportunities%rowtype;
  handoff_id uuid;
  owner_dept text;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then
    raise exception 'Active Office identity required';
  end if;
  select * into opp from public.office_crm_opportunities where id=p_opportunity for update;
  if opp.id is null then raise exception 'Opportunity not found'; end if;
  if opp.stage <> 'WON' then raise exception 'Only won opportunities can enter commercial handoff'; end if;
  if opp.customer_id is null or opp.product_id is null then raise exception 'Won opportunity requires canonical customer and product'; end if;
  select department_code into owner_dept from public.office_job_assignments where user_id=opp.owner_user_id and status in ('ACTIVE','ON_LEAVE') limit 1;
  if not (
    public.office_effective_permission(p_actor,'sales.crm.write','OWN',null,opp.owner_user_id)
    or (owner_dept is not null and public.office_effective_permission(p_actor,'sales.crm.write','DEPARTMENT',owner_dept,null))
    or public.office_effective_permission(p_actor,'sales.crm.write','COMPANY',null,null)
  ) then raise exception 'Commercial handoff authority required'; end if;

  insert into public.office_commercial_handoffs(
    opportunity_id,customer_id,product_id,owner_user_id,created_by,updated_by
  ) values(opp.id,opp.customer_id,opp.product_id,opp.owner_user_id,p_actor,p_actor)
  on conflict(opportunity_id) do update set updated_by=excluded.updated_by,updated_at=now()
  returning id into handoff_id;

  if not exists(select 1 from public.office_commercial_handoff_events where handoff_id=handoff_id and event_type='HANDOFF_INITIALIZED') then
    insert into public.office_commercial_handoff_events(handoff_id,actor_user_id,event_type,metadata)
    values(handoff_id,p_actor,'HANDOFF_INITIALIZED',jsonb_build_object('opportunity_id',p_opportunity));
  end if;
  return handoff_id;
end;
$$;

create or replace function public.office_commercial_link_request(
  p_actor uuid,p_handoff uuid,p_kind text,p_request uuid
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  h public.office_commercial_handoffs%rowtype;
  r public.office_requests%rowtype;
  expected_type text;
  normalized_kind text:=upper(trim(coalesce(p_kind,'')));
begin
  select * into h from public.office_commercial_handoffs where id=p_handoff for update;
  if h.id is null then raise exception 'Commercial handoff not found'; end if;
  if not public.office_effective_permission(p_actor,'sales.crm.write','OWN',null,h.owner_user_id)
     and not public.office_effective_permission(p_actor,'sales.crm.write','COMPANY',null,null) then
    raise exception 'Commercial handoff authority required';
  end if;
  expected_type:=case normalized_kind
    when 'CONTRACT' then 'COMMERCIAL_CONTRACT'
    when 'SUBSCRIPTION' then 'SUBSCRIPTION_ACTIVATION'
    when 'INVOICE' then 'INVOICE_PREPARATION'
    else null end;
  if expected_type is null then raise exception 'Invalid commercial handoff request kind'; end if;
  select * into r from public.office_requests where id=p_request;
  if r.id is null or r.request_type_code<>expected_type then raise exception 'Request type does not match handoff stage'; end if;
  if r.resource_type<>'COMMERCIAL_HANDOFF' or r.resource_key<>p_handoff::text then raise exception 'Request is not bound to this handoff'; end if;

  if normalized_kind='CONTRACT' then
    update public.office_commercial_handoffs set contract_request_id=p_request,updated_by=p_actor,updated_at=now() where id=p_handoff;
  elsif normalized_kind='SUBSCRIPTION' then
    update public.office_commercial_handoffs set subscription_request_id=p_request,updated_by=p_actor,updated_at=now() where id=p_handoff;
  else
    update public.office_commercial_handoffs set invoice_request_id=p_request,updated_by=p_actor,updated_at=now() where id=p_handoff;
  end if;
  insert into public.office_commercial_handoff_events(handoff_id,actor_user_id,event_type,metadata)
  values(p_handoff,p_actor,normalized_kind||'_REQUEST_LINKED',jsonb_build_object('request_id',p_request,'request_type',expected_type));
  return normalized_kind;
end;
$$;

revoke all on function public.office_commercial_initialize_handoff(uuid,uuid) from public, anon, authenticated;
revoke all on function public.office_commercial_link_request(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.office_commercial_initialize_handoff(uuid,uuid) to service_role;
grant execute on function public.office_commercial_link_request(uuid,uuid,text,uuid) to service_role;
