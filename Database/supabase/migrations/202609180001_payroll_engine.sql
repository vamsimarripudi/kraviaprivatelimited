-- KRAVIA Office Payroll OS foundation.
-- Payroll law/tax rates are intentionally not hard-coded here. Compensation,
-- attendance snapshots, adjustments and rule versions are effective-dated and
-- require governed review. Bank execution remains a separate adapter boundary.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('payroll.compensation.read','PAYROLL','READ_COMPENSATION','Read compensation','Read compensation versions inside authorised people/payroll scope.','SENSITIVE',false,true,true),
 ('payroll.compensation.manage','PAYROLL','MANAGE_COMPENSATION','Manage compensation','Create compensation versions and submit changes for independent approval.','CRITICAL',true,true,true),
 ('payroll.compensation.review','PAYROLL','REVIEW_COMPENSATION','Review compensation','Independently review proposed compensation changes.','CRITICAL',true,true,true),
 ('payroll.rules.read','PAYROLL','READ_RULES','Read payroll rules','Read effective-dated company/statutory payroll rule metadata.','HIGH',false,true,true),
 ('payroll.rules.manage','PAYROLL','MANAGE_RULES','Manage payroll rules','Create and approve source-backed payroll rule versions without embedding rates in application code.','CRITICAL',true,true,true),
 ('payroll.run.read','PAYROLL','READ_RUN','Read payroll run','Read payroll periods, attendance snapshots and employee calculation outputs in assigned scope.','SENSITIVE',false,true,true),
 ('payroll.run.prepare','PAYROLL','PREPARE_RUN','Prepare payroll run','Prepare attendance snapshots, adjustments and deterministic payroll calculations.','CRITICAL',true,true,true),
 ('payroll.run.review','PAYROLL','REVIEW_RUN','Review payroll run','Independently review payroll calculations and exception evidence.','CRITICAL',true,true,true),
 ('payroll.run.approve','PAYROLL','APPROVE_RUN','Approve payroll run','Final approval authority for a locked payroll run before payment preparation.','CRITICAL',true,true,true),
 ('payroll.payment.prepare','PAYROLL','PREPARE_PAYMENT','Prepare salary batch','Prepare a salary payment batch after payroll approval. This does not execute a bank transfer.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','payroll.compensation.read','ALLOW','COMPANY'),
 ('HR_MANAGER','payroll.compensation.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','payroll.compensation.review','ALLOW','COMPANY'),
 ('HR_MANAGER','payroll.rules.read','ALLOW','COMPANY'),
 ('HR_MANAGER','payroll.run.read','ALLOW','COMPANY'),
 ('HR_MANAGER','payroll.run.prepare','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','payroll.compensation.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','payroll.rules.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','payroll.run.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','payroll.run.review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','payroll.payment.prepare','ALLOW','COMPANY'),
 ('ACCOUNTANT','payroll.run.read','ALLOW','COMPANY'),
 ('CA_TAX','payroll.rules.read','ALLOW','COMPANY'),
 ('CA_TAX','payroll.run.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','payroll.rules.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','payroll.run.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_request_type_catalog(code,label,module,description,requester_permission,fulfillment_permission,default_priority,default_due_hours,high_risk,active) values
 ('COMPENSATION_CHANGE','Compensation Change','PAYROLL','Review a proposed effective-dated compensation version. Approval does not edit historical compensation or execute payroll.','payroll.compensation.manage',null,'HIGH',72,true,true),
 ('PAYROLL_RUN_APPROVAL','Payroll Run Approval','PAYROLL','Review a deterministic payroll calculation before any salary payment batch is prepared.','payroll.run.prepare',null,'HIGH',24,true,true)
on conflict(code) do update set label=excluded.label,module=excluded.module,description=excluded.description,requester_permission=excluded.requester_permission,fulfillment_permission=excluded.fulfillment_permission,default_priority=excluded.default_priority,default_due_hours=excluded.default_due_hours,high_risk=excluded.high_risk,active=true;

insert into public.office_workflow_templates(code,request_type_code,version,label,description,active) values
 ('COMPENSATION_CHANGE_V1','COMPENSATION_CHANGE',1,'Compensation change','Independent compensation and finance review followed by owner approval.',true),
 ('PAYROLL_RUN_APPROVAL_V1','PAYROLL_RUN_APPROVAL',1,'Payroll run approval','Independent payroll review followed by owner approval before salary batch preparation.',true)
on conflict(code,version) do update set request_type_code=excluded.request_type_code,label=excluded.label,description=excluded.description,active=true;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'COMPENSATION_REVIEW','Compensation review','PERMISSION','payroll.compensation.review','payroll.compensation.review',1,false,'{}'::jsonb from public.office_workflow_templates where code='COMPENSATION_CHANGE_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'FINANCE_REVIEW','Finance review','PERMISSION','payroll.run.review','payroll.run.review',1,false,'{}'::jsonb from public.office_workflow_templates where code='COMPENSATION_CHANGE_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,3,'OWNER_APPROVAL','Owner approval','OWNER',null,null,1,false,'{}'::jsonb from public.office_workflow_templates where code='COMPENSATION_CHANGE_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'PAYROLL_REVIEW','Payroll review','PERMISSION','payroll.run.review','payroll.run.review',1,false,'{}'::jsonb from public.office_workflow_templates where code='PAYROLL_RUN_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'OWNER_APPROVAL','Owner approval','OWNER',null,null,1,false,'{}'::jsonb from public.office_workflow_templates where code='PAYROLL_RUN_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;

create sequence if not exists public.office_payroll_rule_seq;
create sequence if not exists public.office_compensation_seq;
create sequence if not exists public.office_payroll_period_seq;
create sequence if not exists public.office_salary_batch_seq;
grant usage on sequence public.office_payroll_rule_seq,public.office_compensation_seq,public.office_payroll_period_seq,public.office_salary_batch_seq to service_role;

create table if not exists public.office_payroll_rule_versions(
 id uuid primary key default gen_random_uuid(),
 rule_code text not null,
 version integer not null check(version>0),
 rule_kind text not null check(rule_kind in ('COMPANY_POLICY','PRORATION','LEAVE','STATUTORY','TAX','BENEFIT','OTHER')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 jurisdiction text not null default 'IN',
 effective_from date not null,
 effective_to date,
 configuration jsonb not null default '{}'::jsonb,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(rule_code,version),
 check(effective_to is null or effective_to>=effective_from),
 check(jsonb_typeof(configuration)='object')
);
create index if not exists office_payroll_rules_effective_idx on public.office_payroll_rule_versions(rule_code,status,effective_from);

create table if not exists public.office_compensation_versions(
 id uuid primary key default gen_random_uuid(),
 compensation_code text not null unique default ('KR-COMP-'||lpad(nextval('public.office_compensation_seq')::text,6,'0')),
 employment_id uuid not null references public.office_employment_registry(employment_id) on delete restrict,
 employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 grade_code text,
 annual_ctc_minor bigint not null check(annual_ctc_minor>=0),
 monthly_gross_minor bigint not null check(monthly_gross_minor>=0),
 currency text not null check(char_length(currency)=3),
 components jsonb not null default '[]'::jsonb,
 effective_from date not null,
 effective_to date,
 reason text not null check(char_length(trim(reason))>=3),
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED')),
 approval_request_id uuid references public.office_requests(id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(employment_id,effective_from),
 check(effective_to is null or effective_to>=effective_from),
 check(jsonb_typeof(components)='array')
);
create index if not exists office_compensation_effective_idx on public.office_compensation_versions(employment_id,status,effective_from);

create table if not exists public.office_payroll_periods(
 id uuid primary key default gen_random_uuid(),
 period_code text not null unique default ('KR-PAY-'||lpad(nextval('public.office_payroll_period_seq')::text,6,'0')),
 period_kind text not null default 'MONTHLY' check(period_kind in ('MONTHLY','OFF_CYCLE','FINAL_SETTLEMENT')),
 starts_on date not null,
 ends_on date not null,
 attendance_cutoff_at timestamptz,
 pay_date date,
 status text not null default 'DRAFT' check(status in ('DRAFT','ATTENDANCE_READY','CALCULATED','PENDING_REVIEW','APPROVED','PAYMENT_PREPARED','CLOSED','CANCELLED')),
 approval_request_id uuid references public.office_requests(id) on delete restrict,
 calculation_version integer not null default 0,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(starts_on,ends_on,period_kind),
 check(ends_on>=starts_on)
);

create table if not exists public.office_payroll_attendance_snapshots(
 id uuid primary key default gen_random_uuid(),
 period_id uuid not null references public.office_payroll_periods(id) on delete cascade,
 employment_id uuid not null references public.office_employment_registry(employment_id) on delete restrict,
 employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 basis_units numeric(10,3) not null check(basis_units>0),
 payable_units numeric(10,3) not null check(payable_units>=0),
 paid_leave_units numeric(10,3) not null default 0 check(paid_leave_units>=0),
 unpaid_leave_units numeric(10,3) not null default 0 check(unpaid_leave_units>=0),
 absence_units numeric(10,3) not null default 0 check(absence_units>=0),
 unresolved_units numeric(10,3) not null default 0 check(unresolved_units>=0),
 source_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'DRAFT' check(status in ('DRAFT','REVIEWED','LOCKED')),
 prepared_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(period_id,employment_id),
 check(payable_units<=basis_units),
 check(jsonb_typeof(source_snapshot)='object')
);

create table if not exists public.office_payroll_adjustments(
 id uuid primary key default gen_random_uuid(),
 period_id uuid not null references public.office_payroll_periods(id) on delete cascade,
 employment_id uuid not null references public.office_employment_registry(employment_id) on delete restrict,
 employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 adjustment_kind text not null check(adjustment_kind in ('EARNING','DEDUCTION','EMPLOYER_COST')),
 adjustment_code text not null,
 label text not null,
 amount_minor bigint not null check(amount_minor>=0),
 currency text not null check(char_length(currency)=3),
 source_reference text not null check(char_length(trim(source_reference))>=3),
 note text,
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','REJECTED','CANCELLED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_payroll_adjustments_period_idx on public.office_payroll_adjustments(period_id,employment_id,status);

create table if not exists public.office_payroll_results(
 id uuid primary key default gen_random_uuid(),
 period_id uuid not null references public.office_payroll_periods(id) on delete cascade,
 employment_id uuid not null references public.office_employment_registry(employment_id) on delete restrict,
 employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 compensation_version_id uuid not null references public.office_compensation_versions(id) on delete restrict,
 currency text not null check(char_length(currency)=3),
 base_gross_minor bigint not null check(base_gross_minor>=0),
 prorated_gross_minor bigint not null check(prorated_gross_minor>=0),
 additional_earnings_minor bigint not null default 0 check(additional_earnings_minor>=0),
 deductions_minor bigint not null default 0 check(deductions_minor>=0),
 employer_costs_minor bigint not null default 0 check(employer_costs_minor>=0),
 net_pay_minor bigint not null check(net_pay_minor>=0),
 line_items jsonb not null default '[]'::jsonb,
 calculation_snapshot jsonb not null default '{}'::jsonb,
 calculation_hash text not null check(char_length(calculation_hash)=64),
 calculation_version integer not null,
 status text not null default 'CALCULATED' check(status in ('CALCULATED','LOCKED','SUPERSEDED')),
 calculated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 calculated_at timestamptz not null default now(),
 unique(period_id,employment_id,calculation_version),
 check(jsonb_typeof(line_items)='array'),
 check(jsonb_typeof(calculation_snapshot)='object')
);
create index if not exists office_payroll_results_period_idx on public.office_payroll_results(period_id,status,employee_user_id);

create table if not exists public.office_salary_payment_batches(
 id uuid primary key default gen_random_uuid(),
 batch_code text not null unique default ('KR-SAL-'||lpad(nextval('public.office_salary_batch_seq')::text,6,'0')),
 period_id uuid not null references public.office_payroll_periods(id) on delete restrict,
 currency text not null check(char_length(currency)=3),
 total_minor bigint not null check(total_minor>=0),
 employee_count integer not null check(employee_count>=0),
 status text not null default 'PREPARED' check(status in ('PREPARED','SUBMITTED','PARTIAL','CONFIRMED','FAILED','CANCELLED','CLOSED')),
 provider text,
 provider_batch_reference text,
 prepared_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 submitted_by uuid references public.office_identity_users(user_id) on delete restrict,
 submitted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.office_salary_payment_entries(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.office_salary_payment_batches(id) on delete cascade,
 payroll_result_id uuid not null references public.office_payroll_results(id) on delete restrict,
 employment_id uuid not null references public.office_employment_registry(employment_id) on delete restrict,
 employee_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 amount_minor bigint not null check(amount_minor>=0),
 currency text not null check(char_length(currency)=3),
 destination_reference text,
 destination_masked text,
 status text not null default 'DESTINATION_REQUIRED' check(status in ('DESTINATION_REQUIRED','READY','SUBMITTED','SUCCESS','FAILED','CANCELLED')),
 provider_reference text,
 failure_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(batch_id,payroll_result_id)
);

create table if not exists public.office_payroll_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 period_id uuid references public.office_payroll_periods(id) on delete cascade,
 employment_id uuid references public.office_employment_registry(employment_id) on delete restrict,
 compensation_version_id uuid references public.office_compensation_versions(id) on delete restrict,
 batch_id uuid references public.office_salary_payment_batches(id) on delete restrict,
 event_type text not null,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_payroll_rule_versions enable row level security;
alter table public.office_compensation_versions enable row level security;
alter table public.office_payroll_periods enable row level security;
alter table public.office_payroll_attendance_snapshots enable row level security;
alter table public.office_payroll_adjustments enable row level security;
alter table public.office_payroll_results enable row level security;
alter table public.office_salary_payment_batches enable row level security;
alter table public.office_salary_payment_entries enable row level security;
alter table public.office_payroll_events enable row level security;
revoke all on public.office_payroll_rule_versions,public.office_compensation_versions,public.office_payroll_periods,public.office_payroll_attendance_snapshots,public.office_payroll_adjustments,public.office_payroll_results,public.office_salary_payment_batches,public.office_salary_payment_entries,public.office_payroll_events from anon,authenticated;
grant select,insert,update on public.office_payroll_rule_versions,public.office_compensation_versions,public.office_payroll_periods,public.office_payroll_attendance_snapshots,public.office_payroll_adjustments,public.office_salary_payment_batches,public.office_salary_payment_entries to service_role;
grant select,insert,update on public.office_payroll_results to service_role;
grant select,insert on public.office_payroll_events to service_role;

create or replace function public.office_compensation_create_draft(p_actor uuid,p_employment uuid,p_grade text,p_annual_ctc bigint,p_monthly_gross bigint,p_currency text,p_components jsonb,p_effective_from date,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare emp public.office_employment_registry%rowtype; dept text; v_id uuid;
begin
 select * into emp from public.office_employment_registry where employment_id=p_employment;
 if emp.employment_id is null or emp.status not in ('PLANNED','ACTIVE','ON_LEAVE') then raise exception 'Eligible employment record is required'; end if;
 select department_code into dept from public.office_job_assignments where user_id=emp.identity_user_id and status in ('PLANNED','ACTIVE','ON_LEAVE') order by updated_at desc limit 1;
 if not public.office_effective_permission(p_actor,'payroll.compensation.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'payroll.compensation.manage','DEPARTMENT',dept,null) then raise exception 'Compensation management permission is required'; end if;
 if jsonb_typeof(coalesce(p_components,'[]'::jsonb))<>'array' then raise exception 'Compensation components must be an array'; end if;
 if p_monthly_gross<0 or p_annual_ctc<0 then raise exception 'Compensation amounts cannot be negative'; end if;
 insert into public.office_compensation_versions(employment_id,employee_user_id,grade_code,annual_ctc_minor,monthly_gross_minor,currency,components,effective_from,reason,created_by)
 values(emp.employment_id,emp.identity_user_id,nullif(trim(coalesce(p_grade,'')),''),p_annual_ctc,p_monthly_gross,upper(trim(p_currency)),coalesce(p_components,'[]'::jsonb),p_effective_from,trim(p_reason),p_actor) returning id into v_id;
 insert into public.office_payroll_events(actor_user_id,employment_id,compensation_version_id,event_type,note) values(p_actor,emp.employment_id,v_id,'COMPENSATION_DRAFT_CREATED',trim(p_reason));
 return v_id;
end; $$;

create or replace function public.office_compensation_submit(p_actor uuid,p_compensation uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_compensation_versions%rowtype; approval uuid;
begin
 select * into c from public.office_compensation_versions where id=p_compensation for update;
 if c.id is null or c.status not in ('DRAFT','REJECTED') then raise exception 'Compensation version is not submittable'; end if;
 if c.created_by<>p_actor and not public.office_effective_permission(p_actor,'payroll.compensation.manage','COMPANY',null,null) then raise exception 'Compensation management permission is required'; end if;
 approval:=public.office_create_request(p_actor,'COMPENSATION_CHANGE','Compensation approval · '||c.compensation_code,'Effective '||c.effective_from::text||' · '||c.currency||' annual CTC '||c.annual_ctc_minor::text,jsonb_build_object('compensation_version_id',c.id,'employment_id',c.employment_id,'employee_user_id',c.employee_user_id,'annual_ctc_minor',c.annual_ctc_minor,'monthly_gross_minor',c.monthly_gross_minor,'currency',c.currency,'effective_from',c.effective_from),'HIGH',c.employee_user_id,'EMPLOYMENT',c.employment_id::text);
 update public.office_compensation_versions set status='PENDING_APPROVAL',approval_request_id=approval,updated_at=now() where id=c.id;
 insert into public.office_payroll_events(actor_user_id,employment_id,compensation_version_id,event_type,metadata) values(p_actor,c.employment_id,c.id,'COMPENSATION_SUBMITTED',jsonb_build_object('approval_request_id',approval));
 return approval;
end; $$;

create or replace function public.office_compensation_sync_approval(p_actor uuid,p_compensation uuid)
returns text language plpgsql security definer set search_path='' as $$
declare c public.office_compensation_versions%rowtype; r public.office_requests%rowtype; final_approver uuid; new_state text;
begin
 select * into c from public.office_compensation_versions where id=p_compensation for update;
 if c.id is null or c.approval_request_id is null then raise exception 'Compensation approval request is missing'; end if;
 if not public.office_effective_permission(p_actor,'payroll.compensation.read','COMPANY',null,null) and not public.office_effective_permission(p_actor,'payroll.compensation.manage','COMPANY',null,null) then raise exception 'Compensation permission is required'; end if;
 select * into r from public.office_requests where id=c.approval_request_id;
 if r.id is null then raise exception 'Approval workflow record not found'; end if;
 if r.status='APPROVED' then
   select decision_by into final_approver from public.office_request_steps where request_id=r.id and status='APPROVED' order by step_order desc limit 1;
   update public.office_compensation_versions set effective_to=c.effective_from-1,updated_at=now() where employment_id=c.employment_id and id<>c.id and status='APPROVED' and effective_from<c.effective_from and (effective_to is null or effective_to>=c.effective_from);
   update public.office_compensation_versions set status='APPROVED',approved_by=final_approver,approved_at=now(),updated_at=now() where id=c.id;
   new_state:='APPROVED';
 elsif r.status='REJECTED' then
   update public.office_compensation_versions set status='REJECTED',updated_at=now() where id=c.id;
   new_state:='REJECTED';
 else new_state:='PENDING_APPROVAL'; end if;
 insert into public.office_payroll_events(actor_user_id,employment_id,compensation_version_id,event_type,metadata) values(p_actor,c.employment_id,c.id,'COMPENSATION_APPROVAL_SYNCED',jsonb_build_object('workflow_status',r.status,'compensation_status',new_state));
 return new_state;
end; $$;

create or replace function public.office_payroll_open_period(p_actor uuid,p_kind text,p_start date,p_end date,p_cutoff timestamptz,p_pay_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; k text:=upper(trim(p_kind));
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 if k not in ('MONTHLY','OFF_CYCLE','FINAL_SETTLEMENT') then raise exception 'Invalid payroll period kind'; end if;
 if p_end<p_start then raise exception 'Payroll period end must follow start'; end if;
 insert into public.office_payroll_periods(period_kind,starts_on,ends_on,attendance_cutoff_at,pay_date,created_by) values(k,p_start,p_end,p_cutoff,p_pay_date,p_actor) returning id into v_id;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,v_id,'PAYROLL_PERIOD_OPENED',jsonb_build_object('kind',k,'starts_on',p_start,'ends_on',p_end,'pay_date',p_pay_date));
 return v_id;
end; $$;

create or replace function public.office_payroll_set_attendance_snapshot(p_actor uuid,p_period uuid,p_employment uuid,p_basis numeric,p_payable numeric,p_paid_leave numeric,p_unpaid_leave numeric,p_absence numeric,p_unresolved numeric,p_source jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; emp public.office_employment_registry%rowtype; v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then raise exception 'Payroll period is not open for attendance preparation'; end if;
 select * into emp from public.office_employment_registry where employment_id=p_employment;
 if emp.employment_id is null then raise exception 'Employment record not found'; end if;
 if p_basis<=0 or p_payable<0 or p_payable>p_basis or p_unresolved<0 then raise exception 'Invalid payroll attendance units'; end if;
 insert into public.office_payroll_attendance_snapshots(period_id,employment_id,employee_user_id,basis_units,payable_units,paid_leave_units,unpaid_leave_units,absence_units,unresolved_units,source_snapshot,status,prepared_by)
 values(per.id,emp.employment_id,emp.identity_user_id,p_basis,p_payable,coalesce(p_paid_leave,0),coalesce(p_unpaid_leave,0),coalesce(p_absence,0),coalesce(p_unresolved,0),coalesce(p_source,'{}'::jsonb),case when coalesce(p_unresolved,0)=0 then 'REVIEWED' else 'DRAFT' end,p_actor)
 on conflict(period_id,employment_id) do update set basis_units=excluded.basis_units,payable_units=excluded.payable_units,paid_leave_units=excluded.paid_leave_units,unpaid_leave_units=excluded.unpaid_leave_units,absence_units=excluded.absence_units,unresolved_units=excluded.unresolved_units,source_snapshot=excluded.source_snapshot,status=excluded.status,prepared_by=p_actor,reviewed_by=null,reviewed_at=null,updated_at=now() returning id into v_id;
 update public.office_payroll_periods set status='ATTENDANCE_READY',updated_at=now() where id=per.id and status='DRAFT';
 insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata) values(p_actor,per.id,emp.employment_id,'ATTENDANCE_SNAPSHOT_RECORDED',jsonb_build_object('basis_units',p_basis,'payable_units',p_payable,'unresolved_units',coalesce(p_unresolved,0)));
 return v_id;
end; $$;

create or replace function public.office_payroll_add_adjustment(p_actor uuid,p_period uuid,p_employment uuid,p_kind text,p_code text,p_label text,p_amount bigint,p_currency text,p_source text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; emp public.office_employment_registry%rowtype; v_id uuid; k text:=upper(trim(p_kind));
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period;
 if per.id is null or per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then raise exception 'Payroll period is not editable'; end if;
 select * into emp from public.office_employment_registry where employment_id=p_employment;
 if emp.employment_id is null then raise exception 'Employment record not found'; end if;
 if k not in ('EARNING','DEDUCTION','EMPLOYER_COST') or p_amount<0 then raise exception 'Invalid payroll adjustment'; end if;
 insert into public.office_payroll_adjustments(period_id,employment_id,employee_user_id,adjustment_kind,adjustment_code,label,amount_minor,currency,source_reference,note,created_by)
 values(per.id,emp.employment_id,emp.identity_user_id,k,upper(trim(p_code)),trim(p_label),p_amount,upper(trim(p_currency)),trim(p_source),nullif(trim(coalesce(p_note,'')),''),p_actor) returning id into v_id;
 insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata) values(p_actor,per.id,emp.employment_id,'PAYROLL_ADJUSTMENT_CREATED',jsonb_build_object('adjustment_id',v_id,'kind',k,'amount_minor',p_amount,'currency',upper(trim(p_currency))));
 return v_id;
end; $$;

create or replace function public.office_payroll_review_adjustment(p_actor uuid,p_adjustment uuid,p_decision text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_payroll_adjustments%rowtype; d text:=upper(trim(p_decision));
begin
 select * into a from public.office_payroll_adjustments where id=p_adjustment for update;
 if a.id is null or a.status<>'DRAFT' then raise exception 'Payroll adjustment is not awaiting review'; end if;
 if a.created_by=p_actor then raise exception 'Adjustment creator cannot approve the same adjustment'; end if;
 if not public.office_effective_permission(p_actor,'payroll.run.review','COMPANY',null,null) then raise exception 'Payroll review permission is required'; end if;
 if d not in ('APPROVE','REJECT') then raise exception 'Invalid adjustment decision'; end if;
 update public.office_payroll_adjustments set status=case when d='APPROVE' then 'APPROVED' else 'REJECTED' end,approved_by=p_actor,approved_at=now(),updated_at=now() where id=a.id;
 insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata) values(p_actor,a.period_id,a.employment_id,'PAYROLL_ADJUSTMENT_REVIEWED',jsonb_build_object('adjustment_id',a.id,'decision',d));
 return case when d='APPROVE' then 'APPROVED' else 'REJECTED' end;
end; $$;

create or replace function public.office_payroll_calculate(p_actor uuid,p_period uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; snap record; comp public.office_compensation_versions%rowtype; pending_count integer; calc_version integer; earn bigint; deduct bigint; employer bigint; prorated bigint; net bigint; payload jsonb; hash text; result_count integer:=0; midperiod_count integer;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status not in ('ATTENDANCE_READY','CALCULATED') then raise exception 'Payroll attendance must be ready before calculation'; end if;
 select count(*) into pending_count from public.office_payroll_attendance_snapshots where period_id=per.id and unresolved_units>0;
 if pending_count>0 then raise exception 'Payroll contains unresolved attendance units'; end if;
 select count(*) into pending_count from public.office_payroll_adjustments where period_id=per.id and status='DRAFT';
 if pending_count>0 then raise exception 'Payroll contains unreviewed adjustments'; end if;
 calc_version:=per.calculation_version+1;
 update public.office_payroll_results set status='SUPERSEDED' where period_id=per.id and status='CALCULATED';
 for snap in select * from public.office_payroll_attendance_snapshots where period_id=per.id order by employment_id loop
   select count(*) into midperiod_count from public.office_compensation_versions where employment_id=snap.employment_id and status='APPROVED' and effective_from>per.starts_on and effective_from<=per.ends_on;
   if midperiod_count>0 then raise exception 'Mid-period compensation change requires an explicit arrears/off-cycle adjustment before calculation'; end if;
   select * into comp from public.office_compensation_versions where employment_id=snap.employment_id and status='APPROVED' and effective_from<=per.starts_on and (effective_to is null or effective_to>=per.starts_on) order by effective_from desc limit 1;
   if comp.id is null then raise exception 'Approved compensation is missing for payroll employment %',snap.employment_id; end if;
   select coalesce(sum(amount_minor),0) into earn from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='EARNING' and currency=comp.currency;
   select coalesce(sum(amount_minor),0) into deduct from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='DEDUCTION' and currency=comp.currency;
   select coalesce(sum(amount_minor),0) into employer from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='EMPLOYER_COST' and currency=comp.currency;
   if exists(select 1 from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and currency<>comp.currency) then raise exception 'Payroll adjustments must match compensation currency'; end if;
   prorated:=round(comp.monthly_gross_minor::numeric*snap.payable_units/snap.basis_units)::bigint;
   net:=prorated+earn-deduct;
   if net<0 then raise exception 'Payroll deductions exceed payable earnings'; end if;
   payload:=jsonb_build_object('period_id',per.id,'employment_id',snap.employment_id,'compensation_version_id',comp.id,'monthly_gross_minor',comp.monthly_gross_minor,'basis_units',snap.basis_units,'payable_units',snap.payable_units,'paid_leave_units',snap.paid_leave_units,'unpaid_leave_units',snap.unpaid_leave_units,'absence_units',snap.absence_units,'earnings_minor',earn,'deductions_minor',deduct,'employer_costs_minor',employer,'net_pay_minor',net,'currency',comp.currency,'calculation_version',calc_version);
   hash:=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex');
   insert into public.office_payroll_results(period_id,employment_id,employee_user_id,compensation_version_id,currency,base_gross_minor,prorated_gross_minor,additional_earnings_minor,deductions_minor,employer_costs_minor,net_pay_minor,line_items,calculation_snapshot,calculation_hash,calculation_version,calculated_by)
   values(per.id,snap.employment_id,snap.employee_user_id,comp.id,comp.currency,comp.monthly_gross_minor,prorated,earn,deduct,employer,net,jsonb_build_array(jsonb_build_object('code','BASE_GROSS','amount_minor',prorated),jsonb_build_object('code','ADDITIONAL_EARNINGS','amount_minor',earn),jsonb_build_object('code','DEDUCTIONS','amount_minor',deduct),jsonb_build_object('code','EMPLOYER_COSTS','amount_minor',employer)),payload,hash,calc_version,p_actor);
   result_count:=result_count+1;
 end loop;
 if result_count=0 then raise exception 'No payroll attendance snapshots are available'; end if;
 update public.office_payroll_periods set status='CALCULATED',calculation_version=calc_version,approval_request_id=null,updated_at=now() where id=per.id;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,per.id,'PAYROLL_CALCULATED',jsonb_build_object('calculation_version',calc_version,'employee_count',result_count));
 return result_count;
end; $$;

create or replace function public.office_payroll_submit(p_actor uuid,p_period uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; approval uuid; total bigint; employees integer; currencies integer;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status<>'CALCULATED' then raise exception 'Calculated payroll period is required'; end if;
 select count(*),coalesce(sum(net_pay_minor),0),count(distinct currency) into employees,total,currencies from public.office_payroll_results where period_id=per.id and calculation_version=per.calculation_version and status='CALCULATED';
 if employees=0 then raise exception 'Payroll results are missing'; end if;
 if currencies<>1 then raise exception 'A payroll approval request must contain a single currency batch'; end if;
 approval:=public.office_create_request(p_actor,'PAYROLL_RUN_APPROVAL','Payroll approval · '||per.period_code,'Review '||employees::text||' payroll results with total net pay minor units '||total::text,jsonb_build_object('period_id',per.id,'period_code',per.period_code,'calculation_version',per.calculation_version,'employee_count',employees,'net_total_minor',total),'HIGH',null,'PAYROLL_PERIOD',per.id::text);
 update public.office_payroll_periods set status='PENDING_REVIEW',approval_request_id=approval,updated_at=now() where id=per.id;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,per.id,'PAYROLL_SUBMITTED',jsonb_build_object('approval_request_id',approval,'employee_count',employees,'net_total_minor',total));
 return approval;
end; $$;

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

create or replace function public.office_payroll_prepare_payment_batch(p_actor uuid,p_period uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; v_id uuid; c text; total bigint; employees integer;
begin
 if not public.office_effective_permission(p_actor,'payroll.payment.prepare','COMPANY',null,null) then raise exception 'Salary batch preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status<>'APPROVED' then raise exception 'Approved payroll period is required'; end if;
 if exists(select 1 from public.office_salary_payment_batches where period_id=per.id and status not in ('CANCELLED','FAILED')) then raise exception 'Active salary batch already exists for payroll period'; end if;
 select min(currency),coalesce(sum(net_pay_minor),0),count(*) into c,total,employees from public.office_payroll_results where period_id=per.id and calculation_version=per.calculation_version and status='LOCKED';
 if employees=0 then raise exception 'Locked payroll results are missing'; end if;
 if (select count(distinct currency) from public.office_payroll_results where period_id=per.id and calculation_version=per.calculation_version and status='LOCKED')<>1 then raise exception 'Salary batch requires one currency'; end if;
 insert into public.office_salary_payment_batches(period_id,currency,total_minor,employee_count,prepared_by) values(per.id,c,total,employees,p_actor) returning id into v_id;
 insert into public.office_salary_payment_entries(batch_id,payroll_result_id,employment_id,employee_user_id,amount_minor,currency)
 select v_id,id,employment_id,employee_user_id,net_pay_minor,currency from public.office_payroll_results where period_id=per.id and calculation_version=per.calculation_version and status='LOCKED';
 update public.office_payroll_periods set status='PAYMENT_PREPARED',updated_at=now() where id=per.id;
 insert into public.office_payroll_events(actor_user_id,period_id,batch_id,event_type,metadata) values(p_actor,per.id,v_id,'SALARY_BATCH_PREPARED',jsonb_build_object('employee_count',employees,'total_minor',total,'currency',c,'bank_execution',false));
 return v_id;
end; $$;

revoke all on function public.office_compensation_create_draft(uuid,uuid,text,bigint,bigint,text,jsonb,date,text) from public,anon,authenticated;
revoke all on function public.office_compensation_submit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_compensation_sync_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_payroll_open_period(uuid,text,date,date,timestamptz,date) from public,anon,authenticated;
revoke all on function public.office_payroll_set_attendance_snapshot(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,jsonb) from public,anon,authenticated;
revoke all on function public.office_payroll_add_adjustment(uuid,uuid,uuid,text,text,text,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.office_payroll_review_adjustment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_payroll_calculate(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_payroll_submit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_payroll_sync_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_payroll_prepare_payment_batch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_compensation_create_draft(uuid,uuid,text,bigint,bigint,text,jsonb,date,text) to service_role;
grant execute on function public.office_compensation_submit(uuid,uuid) to service_role;
grant execute on function public.office_compensation_sync_approval(uuid,uuid) to service_role;
grant execute on function public.office_payroll_open_period(uuid,text,date,date,timestamptz,date) to service_role;
grant execute on function public.office_payroll_set_attendance_snapshot(uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,jsonb) to service_role;
grant execute on function public.office_payroll_add_adjustment(uuid,uuid,uuid,text,text,text,bigint,text,text,text) to service_role;
grant execute on function public.office_payroll_review_adjustment(uuid,uuid,text) to service_role;
grant execute on function public.office_payroll_calculate(uuid,uuid) to service_role;
grant execute on function public.office_payroll_submit(uuid,uuid) to service_role;
grant execute on function public.office_payroll_sync_approval(uuid,uuid) to service_role;
grant execute on function public.office_payroll_prepare_payment_batch(uuid,uuid) to service_role;
