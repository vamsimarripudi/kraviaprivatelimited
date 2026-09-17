-- Operational assurance foundations for Support, Privacy, Data Movement and Security.
-- The migration adds governed records and request workflows only. It does not
-- autonomously refund money, export/import data, satisfy legal obligations or
-- declare regulatory compliance.

insert into public.office_permission_catalog(
  code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active
) values
  ('support.case.read','SUPPORT','READ','Read support cases','Read support cases inside the assigned company or department scope.','SENSITIVE',false,false,true),
  ('support.case.manage','SUPPORT','MANAGE','Manage support cases','Create and transition support cases inside assigned scope. Refunds remain separate approval workflows.','SENSITIVE',false,false,true),
  ('privacy.case.read','PRIVACY','READ','Read privacy cases','Read governed privacy/data-subject cases and their evidence metadata.','HIGH',false,false,true),
  ('privacy.case.manage','PRIVACY','MANAGE','Manage privacy cases','Create and transition privacy/data-subject cases without treating the workflow as a legal conclusion.','HIGH',true,true,true),
  ('privacy.retention.read','PRIVACY','READ_RETENTION','Read retention register','Read professionally reviewed retention rules and legal-hold metadata.','HIGH',false,false,true),
  ('data.export.request','DATA','REQUEST_EXPORT','Request data export','Request a scoped data export. Approval does not itself release data.','HIGH',true,true,true),
  ('data.import.request','DATA','REQUEST_IMPORT','Request data import','Request a staged data import. Approval does not itself mutate canonical records.','HIGH',true,true,true),
  ('data.movement.approve','DATA','APPROVE_MOVEMENT','Approve data movement','Review governed data movement requests. Execution remains a separate controlled operation.','CRITICAL',true,true,true),
  ('security.overview.read','SECURITY','READ_OVERVIEW','Read security overview','Read authentication, device, incident and access-control posture without exposing credentials.','HIGH',false,true,true),
  ('readiness.overview.read','ASSURANCE','READ_READINESS','Read operational readiness','Read evidence-backed readiness exceptions without producing a fabricated compliance score.','HIGH',false,false,true)
on conflict(code) do update set
  module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,
  sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,
  requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
  ('SUPPORT_USER','support.case.read','ALLOW','DEPARTMENT'),
  ('SUPPORT_USER','support.case.manage','ALLOW','DEPARTMENT'),
  ('SUPPORT_MANAGER','support.case.read','ALLOW','DEPARTMENT'),
  ('SUPPORT_MANAGER','support.case.manage','ALLOW','DEPARTMENT'),
  ('OPERATIONS_MANAGER','support.case.read','ALLOW','DEPARTMENT'),
  ('OPERATIONS_MANAGER','support.case.manage','ALLOW','DEPARTMENT'),
  ('LEGAL_COUNSEL','privacy.case.read','ALLOW','COMPANY'),
  ('LEGAL_COUNSEL','privacy.case.manage','ALLOW','COMPANY'),
  ('LEGAL_COUNSEL','privacy.retention.read','ALLOW','COMPANY'),
  ('CS_SECRETARIAL','privacy.retention.read','ALLOW','COMPANY'),
  ('AUDITOR_READONLY','privacy.retention.read','ALLOW','COMPANY'),
  ('OPERATIONS_MANAGER','data.export.request','ALLOW','DEPARTMENT'),
  ('OPERATIONS_MANAGER','data.import.request','ALLOW','DEPARTMENT'),
  ('PRODUCT_MANAGER','data.export.request','ALLOW','PRODUCT'),
  ('PRODUCT_MANAGER','data.import.request','ALLOW','PRODUCT'),
  ('SECURITY_OPERATOR','data.movement.approve','ALLOW','COMPANY'),
  ('SECURITY_OPERATOR','security.overview.read','ALLOW','COMPANY'),
  ('DEVOPS_OPERATOR','security.overview.read','ALLOW','COMPANY'),
  ('ENGINEERING_MANAGER','security.overview.read','ALLOW','DEPARTMENT'),
  ('OPERATIONS_MANAGER','readiness.overview.read','ALLOW','COMPANY'),
  ('SECURITY_OPERATOR','readiness.overview.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set
  effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_support_case_seq;
create sequence if not exists public.office_privacy_case_seq;
create sequence if not exists public.office_legal_hold_seq;

grant usage on sequence public.office_support_case_seq to service_role;
grant usage on sequence public.office_privacy_case_seq to service_role;
grant usage on sequence public.office_legal_hold_seq to service_role;

create table if not exists public.office_support_cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique default ('KR-SUP-' || lpad(nextval('public.office_support_case_seq')::text,6,'0')),
  customer_id varchar,
  product_id varchar,
  subject text not null check (char_length(trim(subject)) between 3 and 180),
  description text not null check (char_length(trim(description)) between 3 and 8000),
  category text not null default 'GENERAL',
  source text not null default 'INTERNAL' check (source in ('EMAIL','PHONE','WEB','INTERNAL','OTHER')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED')),
  owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  resolution text,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_support_cases_owner_idx on public.office_support_cases(owner_user_id,status,updated_at desc);
create index if not exists office_support_cases_customer_idx on public.office_support_cases(customer_id,status,updated_at desc);

create table if not exists public.office_support_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.office_support_cases(id) on delete cascade,
  actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  event_type text not null,
  previous_status text,
  new_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_support_case_events_case_idx on public.office_support_case_events(case_id,created_at desc);

create table if not exists public.office_privacy_cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique default ('KR-PRV-' || lpad(nextval('public.office_privacy_case_seq')::text,6,'0')),
  case_type text not null check (case_type in ('ACCESS','CORRECTION','ERASURE','CONSENT_WITHDRAWAL','GRIEVANCE','OTHER')),
  subject_type text not null check (subject_type in ('CUSTOMER','EMPLOYEE','PROSPECT','VENDOR','OTHER')),
  subject_reference text not null check (char_length(trim(subject_reference)) between 2 and 240),
  jurisdiction text not null default 'IN' check (char_length(jurisdiction) between 2 and 24),
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text not null check (char_length(trim(description)) between 3 and 8000),
  source_channel text not null default 'INTERNAL',
  status text not null default 'OPEN' check (status in ('OPEN','VERIFY_IDENTITY','IN_REVIEW','ACTION_REQUIRED','COMPLETED','REJECTED')),
  owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  source_reference text,
  deadline_at timestamptz,
  outcome_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_privacy_cases_owner_idx on public.office_privacy_cases(owner_user_id,status,updated_at desc);

create table if not exists public.office_privacy_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.office_privacy_cases(id) on delete cascade,
  actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  event_type text not null,
  previous_status text,
  new_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_privacy_case_events_case_idx on public.office_privacy_case_events(case_id,created_at desc);

create table if not exists public.office_retention_rules (
  code text primary key,
  record_class text not null,
  title text not null,
  jurisdiction text not null,
  retention_period_text text not null,
  retention_basis text not null,
  source_reference text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','RETIRED')),
  reviewed_by uuid references public.office_identity_users(user_id) on delete set null,
  reviewed_at timestamptz,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_legal_holds (
  id uuid primary key default gen_random_uuid(),
  hold_code text not null unique default ('KR-HOLD-' || lpad(nextval('public.office_legal_hold_seq')::text,6,'0')),
  title text not null,
  scope_type text not null,
  scope_key text not null,
  reason text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED')),
  placed_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  placed_at timestamptz not null default now(),
  released_by uuid references public.office_identity_users(user_id) on delete restrict,
  released_at timestamptz,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.office_support_cases enable row level security;
alter table public.office_support_case_events enable row level security;
alter table public.office_privacy_cases enable row level security;
alter table public.office_privacy_case_events enable row level security;
alter table public.office_retention_rules enable row level security;
alter table public.office_legal_holds enable row level security;

revoke all on public.office_support_cases,public.office_support_case_events,public.office_privacy_cases,public.office_privacy_case_events,public.office_retention_rules,public.office_legal_holds from anon,authenticated;
grant select,insert,update on public.office_support_cases to service_role;
grant select,insert on public.office_support_case_events to service_role;
grant select,insert,update on public.office_privacy_cases to service_role;
grant select,insert on public.office_privacy_case_events to service_role;
grant select,insert,update on public.office_retention_rules to service_role;
grant select,insert,update on public.office_legal_holds to service_role;

create or replace function public.office_support_create_case(
  p_actor uuid,p_owner uuid,p_customer varchar,p_product varchar,p_subject text,p_description text,
  p_category text,p_source text,p_priority text,p_due_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  owner_dept text;
  v_id uuid;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Active Office identity required'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active support owner required'; end if;
  select department_code into owner_dept from public.office_job_assignments where user_id=p_owner and status in ('ACTIVE','ON_LEAVE') limit 1;
  if not (
    public.office_effective_permission(p_actor,'support.case.manage','OWN',null,p_owner)
    or (owner_dept is not null and public.office_effective_permission(p_actor,'support.case.manage','DEPARTMENT',owner_dept,null))
    or public.office_effective_permission(p_actor,'support.case.manage','COMPANY',null,null)
  ) then raise exception 'Support case management permission is required'; end if;
  if p_customer is not null and not exists(select 1 from public.customers where id=p_customer) then raise exception 'Canonical customer not found'; end if;
  if p_product is not null and not exists(select 1 from public.products where id=p_product) then raise exception 'Canonical product not found'; end if;

  insert into public.office_support_cases(customer_id,product_id,subject,description,category,source,priority,owner_user_id,created_by,due_at)
  values(p_customer,p_product,trim(p_subject),trim(p_description),upper(coalesce(nullif(trim(p_category),''),'GENERAL')),upper(coalesce(nullif(trim(p_source),''),'INTERNAL')),upper(coalesce(nullif(trim(p_priority),''),'NORMAL')),p_owner,p_actor,p_due_at)
  returning id into v_id;
  insert into public.office_support_case_events(case_id,actor_user_id,event_type,new_status,metadata)
  values(v_id,p_actor,'CASE_CREATED','OPEN',jsonb_build_object('priority',upper(coalesce(nullif(trim(p_priority),''),'NORMAL'))));
  return v_id;
end;
$$;

create or replace function public.office_support_transition_case(
  p_actor uuid,p_case uuid,p_status text,p_note text default null
)
returns text
language plpgsql security definer set search_path=''
as $$
declare
  c public.office_support_cases%rowtype;
  owner_dept text;
  next_status text:=upper(trim(coalesce(p_status,'')));
begin
  select * into c from public.office_support_cases where id=p_case for update;
  if c.id is null then raise exception 'Support case not found'; end if;
  select department_code into owner_dept from public.office_job_assignments where user_id=c.owner_user_id and status in ('ACTIVE','ON_LEAVE') limit 1;
  if not (
    public.office_effective_permission(p_actor,'support.case.manage','OWN',null,c.owner_user_id)
    or (owner_dept is not null and public.office_effective_permission(p_actor,'support.case.manage','DEPARTMENT',owner_dept,null))
    or public.office_effective_permission(p_actor,'support.case.manage','COMPANY',null,null)
  ) then raise exception 'Support case management permission is required'; end if;
  if next_status not in ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED') then raise exception 'Invalid support status'; end if;
  if c.status='CLOSED' then raise exception 'Closed support cases are immutable'; end if;
  if next_status='CLOSED' and c.status<>'RESOLVED' then raise exception 'Resolve the support case before closing it'; end if;
  if next_status='RESOLVED' and char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Resolution note is required'; end if;

  update public.office_support_cases set
    status=next_status,
    resolution=case when next_status='RESOLVED' then left(trim(p_note),4000) else resolution end,
    resolved_at=case when next_status='RESOLVED' then now() when c.status='RESOLVED' and next_status<>'CLOSED' then null else resolved_at end,
    closed_at=case when next_status='CLOSED' then now() else closed_at end,
    updated_at=now()
  where id=p_case;
  insert into public.office_support_case_events(case_id,actor_user_id,event_type,previous_status,new_status,note)
  values(p_case,p_actor,'STATUS_CHANGED',c.status,next_status,left(trim(coalesce(p_note,'')),4000));
  return next_status;
end;
$$;

create or replace function public.office_privacy_create_case(
  p_actor uuid,p_owner uuid,p_case_type text,p_subject_type text,p_subject_reference text,
  p_jurisdiction text,p_title text,p_description text,p_source_channel text,p_source_reference text default null,p_deadline_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  owner_dept text;
  v_id uuid;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Active Office identity required'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active privacy owner required'; end if;
  select department_code into owner_dept from public.office_job_assignments where user_id=p_owner and status in ('ACTIVE','ON_LEAVE') limit 1;
  if not (
    public.office_effective_permission(p_actor,'privacy.case.manage','OWN',null,p_owner)
    or (owner_dept is not null and public.office_effective_permission(p_actor,'privacy.case.manage','DEPARTMENT',owner_dept,null))
    or public.office_effective_permission(p_actor,'privacy.case.manage','COMPANY',null,null)
  ) then raise exception 'Privacy case management permission is required'; end if;

  insert into public.office_privacy_cases(case_type,subject_type,subject_reference,jurisdiction,title,description,source_channel,owner_user_id,created_by,source_reference,deadline_at)
  values(upper(trim(p_case_type)),upper(trim(p_subject_type)),trim(p_subject_reference),upper(coalesce(nullif(trim(p_jurisdiction),''),'IN')),trim(p_title),trim(p_description),upper(coalesce(nullif(trim(p_source_channel),''),'INTERNAL')),p_owner,p_actor,nullif(trim(coalesce(p_source_reference,'')),''),p_deadline_at)
  returning id into v_id;
  insert into public.office_privacy_case_events(case_id,actor_user_id,event_type,new_status,metadata)
  values(v_id,p_actor,'CASE_CREATED','OPEN',jsonb_build_object('case_type',upper(trim(p_case_type)),'jurisdiction',upper(coalesce(nullif(trim(p_jurisdiction),''),'IN'))));
  return v_id;
end;
$$;

create or replace function public.office_privacy_transition_case(
  p_actor uuid,p_case uuid,p_status text,p_note text default null
)
returns text
language plpgsql security definer set search_path=''
as $$
declare
  c public.office_privacy_cases%rowtype;
  owner_dept text;
  next_status text:=upper(trim(coalesce(p_status,'')));
begin
  select * into c from public.office_privacy_cases where id=p_case for update;
  if c.id is null then raise exception 'Privacy case not found'; end if;
  select department_code into owner_dept from public.office_job_assignments where user_id=c.owner_user_id and status in ('ACTIVE','ON_LEAVE') limit 1;
  if not (
    public.office_effective_permission(p_actor,'privacy.case.manage','OWN',null,c.owner_user_id)
    or (owner_dept is not null and public.office_effective_permission(p_actor,'privacy.case.manage','DEPARTMENT',owner_dept,null))
    or public.office_effective_permission(p_actor,'privacy.case.manage','COMPANY',null,null)
  ) then raise exception 'Privacy case management permission is required'; end if;
  if next_status not in ('OPEN','VERIFY_IDENTITY','IN_REVIEW','ACTION_REQUIRED','COMPLETED','REJECTED') then raise exception 'Invalid privacy status'; end if;
  if c.status in ('COMPLETED','REJECTED') then raise exception 'Closed privacy cases are immutable'; end if;
  if next_status in ('COMPLETED','REJECTED') and char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Outcome note is required'; end if;

  update public.office_privacy_cases set
    status=next_status,
    outcome_note=case when next_status in ('COMPLETED','REJECTED') then left(trim(p_note),4000) else outcome_note end,
    completed_at=case when next_status in ('COMPLETED','REJECTED') then now() else completed_at end,
    updated_at=now()
  where id=p_case;
  insert into public.office_privacy_case_events(case_id,actor_user_id,event_type,previous_status,new_status,note)
  values(p_case,p_actor,'STATUS_CHANGED',c.status,next_status,left(trim(coalesce(p_note,'')),4000));
  return next_status;
end;
$$;

revoke all on function public.office_support_create_case(uuid,uuid,varchar,varchar,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_support_transition_case(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_privacy_create_case(uuid,uuid,text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_privacy_transition_case(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_support_create_case(uuid,uuid,varchar,varchar,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.office_support_transition_case(uuid,uuid,text,text) to service_role;
grant execute on function public.office_privacy_create_case(uuid,uuid,text,text,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.office_privacy_transition_case(uuid,uuid,text,text) to service_role;

insert into public.office_request_type_catalog(
  code,label,module,description,requester_permission,fulfillment_permission,default_priority,default_due_hours,high_risk,active
) values
  ('DATA_EXPORT','Data Export Request','DATA','Request a scoped data export. Approval records authority only; it does not release files automatically.','request.create','data.movement.approve','HIGH',24,true,true),
  ('DATA_IMPORT','Data Import Request','DATA','Request a staged data import. Approval records authority only; it does not mutate canonical data automatically.','request.create','data.movement.approve','HIGH',48,true,true)
on conflict(code) do update set
  label=excluded.label,module=excluded.module,description=excluded.description,requester_permission=excluded.requester_permission,
  fulfillment_permission=excluded.fulfillment_permission,default_priority=excluded.default_priority,
  default_due_hours=excluded.default_due_hours,high_risk=excluded.high_risk,active=true;

insert into public.office_workflow_templates(code,request_type_code,version,label,description,active) values
  ('DATA_EXPORT_V1','DATA_EXPORT',1,'Data export approval','Independent data-movement approval before any export execution.',true),
  ('DATA_IMPORT_V1','DATA_IMPORT',1,'Data import approval','Independent data-movement approval before any canonical import execution.',true)
on conflict(code,version) do update set
  request_type_code=excluded.request_type_code,label=excluded.label,description=excluded.description,active=true;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'DATA_APPROVAL','Data movement approval','PERMISSION','data.movement.approve','data.movement.approve',1,false,'{}'::jsonb
from public.office_workflow_templates where code='DATA_EXPORT_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'DATA_APPROVAL','Data movement approval','PERMISSION','data.movement.approve','data.movement.approve',1,false,'{}'::jsonb
from public.office_workflow_templates where code='DATA_IMPORT_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=excluded.allow_self_approval,condition_json=excluded.condition_json;
