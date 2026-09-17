-- Recruitment and pre-onboarding control plane.
-- Selection, compensation, document requests and Office access provisioning remain
-- separately governed. Candidate acceptance never silently creates privileged access.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('hiring.requisition.read','HIRING','READ_REQUISITION','Read hiring requisitions','Read authorised headcount and requisition records.','STANDARD',false,false,true),
 ('hiring.requisition.manage','HIRING','MANAGE_REQUISITION','Manage hiring requisitions','Create and update hiring requisitions without self-approving budget or headcount.','HIGH',false,true,true),
 ('hiring.candidate.manage','HIRING','MANAGE_CANDIDATE','Manage candidates','Create and transition candidate records and required-document checklists.','SENSITIVE',false,true,true),
 ('hiring.interview.manage','HIRING','MANAGE_INTERVIEW','Manage interviews','Schedule interviews and record interviewer feedback in assigned scope.','SENSITIVE',false,true,true),
 ('hiring.offer.prepare','HIRING','PREPARE_OFFER','Prepare employment offer','Prepare a candidate offer package and route it for independent approval.','CRITICAL',true,true,true),
 ('hiring.offer.review','HIRING','REVIEW_OFFER','Review employment offer','Independently review a proposed candidate offer package.','CRITICAL',true,true,true),
 ('hiring.onboarding.manage','HIRING','MANAGE_ONBOARDING','Manage pre-onboarding','Coordinate accepted-offer document and access-readiness requests without directly bypassing access administration.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','hiring.requisition.read','ALLOW','COMPANY'),
 ('HR_MANAGER','hiring.requisition.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','hiring.candidate.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','hiring.interview.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','hiring.offer.prepare','ALLOW','COMPANY'),
 ('HR_MANAGER','hiring.offer.review','ALLOW','COMPANY'),
 ('HR_MANAGER','hiring.onboarding.manage','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','hiring.requisition.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','hiring.offer.review','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_request_type_catalog(code,label,module,description,requester_permission,fulfillment_permission,default_priority,default_due_hours,high_risk,active) values
 ('HEADCOUNT_APPROVAL','Headcount Approval','HIRING','Approve a real hiring need and budget envelope before recruiting against the requisition.','hiring.requisition.manage',null,'NORMAL',72,true,true),
 ('EMPLOYMENT_OFFER_APPROVAL','Employment Offer Approval','HIRING','Review a candidate offer package before an offer document is generated or sent.','hiring.offer.prepare',null,'HIGH',48,true,true),
 ('PRE_ONBOARDING_ACCESS','Pre-Onboarding Access','HIRING','Coordinate creation of a controlled Office identity after an offer is accepted. Approval does not itself create provider accounts.','hiring.onboarding.manage',null,'HIGH',48,true,true)
on conflict(code) do update set label=excluded.label,module=excluded.module,description=excluded.description,requester_permission=excluded.requester_permission,fulfillment_permission=excluded.fulfillment_permission,default_priority=excluded.default_priority,default_due_hours=excluded.default_due_hours,high_risk=excluded.high_risk,active=true;

insert into public.office_workflow_templates(code,request_type_code,version,label,description,active) values
 ('HEADCOUNT_APPROVAL_V1','HEADCOUNT_APPROVAL',1,'Headcount approval','Finance/budget review and owner approval before the requisition opens.',true),
 ('EMPLOYMENT_OFFER_APPROVAL_V1','EMPLOYMENT_OFFER_APPROVAL',1,'Employment offer approval','Independent offer review, finance review and owner approval.',true),
 ('PRE_ONBOARDING_ACCESS_V1','PRE_ONBOARDING_ACCESS',1,'Pre-onboarding access','People readiness and access-admin readiness after accepted offer.',true)
on conflict(code,version) do update set request_type_code=excluded.request_type_code,label=excluded.label,description=excluded.description,active=true;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'FINANCE_REVIEW','Budget review','PERMISSION','finance.read','finance.read',1,false,'{}'::jsonb from public.office_workflow_templates where code='HEADCOUNT_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'OWNER_APPROVAL','Owner approval','OWNER',null,null,1,false,'{}'::jsonb from public.office_workflow_templates where code='HEADCOUNT_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'OFFER_REVIEW','Offer review','PERMISSION','hiring.offer.review','hiring.offer.review',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYMENT_OFFER_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'FINANCE_REVIEW','Compensation budget review','PERMISSION','payroll.run.review','payroll.run.review',1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYMENT_OFFER_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,3,'OWNER_APPROVAL','Owner approval','OWNER',null,null,1,false,'{}'::jsonb from public.office_workflow_templates where code='EMPLOYMENT_OFFER_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'PEOPLE_READINESS','People readiness','PERMISSION','hiring.onboarding.manage','hiring.onboarding.manage',1,false,'{}'::jsonb from public.office_workflow_templates where code='PRE_ONBOARDING_ACCESS_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'ACCESS_READINESS','Access-admin readiness','PERMISSION','access.user.invite','access.user.invite',1,false,'{}'::jsonb from public.office_workflow_templates where code='PRE_ONBOARDING_ACCESS_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;

create sequence if not exists public.office_hiring_requisition_seq;
create sequence if not exists public.office_candidate_seq;
create sequence if not exists public.office_offer_seq;
grant usage on sequence public.office_hiring_requisition_seq,public.office_candidate_seq,public.office_offer_seq to service_role;

create table if not exists public.office_hiring_requisitions(
 id uuid primary key default gen_random_uuid(),
 requisition_code text not null unique default ('KR-HR-'||lpad(nextval('public.office_hiring_requisition_seq')::text,6,'0')),
 position_code text not null,
 department_code text not null,
 hiring_manager_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 openings integer not null default 1 check(openings>0 and openings<=1000),
 employment_type text not null check(employment_type in ('EMPLOYEE','CONTRACTOR','INTERN','TRAINEE','PROFESSIONAL')),
 work_mode text not null default 'OFFICE' check(work_mode in ('OFFICE','REMOTE','HYBRID','FIELD')),
 location_text text,
 budget_min_minor bigint check(budget_min_minor is null or budget_min_minor>=0),
 budget_max_minor bigint check(budget_max_minor is null or budget_max_minor>=0),
 currency text check(currency is null or char_length(currency)=3),
 business_reason text not null check(char_length(trim(business_reason))>=3),
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','APPROVED','OPEN','ON_HOLD','FILLED','REJECTED','CANCELLED','CLOSED')),
 approval_request_id uuid references public.office_requests(id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 opened_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(budget_max_minor is null or budget_min_minor is null or budget_max_minor>=budget_min_minor)
);
create index if not exists office_hiring_req_department_idx on public.office_hiring_requisitions(department_code,status,created_at desc);

create table if not exists public.office_candidates(
 id uuid primary key default gen_random_uuid(),
 candidate_code text not null unique default ('KR-CAN-'||lpad(nextval('public.office_candidate_seq')::text,7,'0')),
 requisition_id uuid not null references public.office_hiring_requisitions(id) on delete restrict,
 full_name text not null check(char_length(trim(full_name)) between 2 and 220),
 email text not null,
 phone text,
 location_text text,
 source_channel text not null default 'DIRECT',
 source_reference text,
 resume_storage_reference text,
 status text not null default 'APPLIED' check(status in ('APPLIED','SCREENING','INTERVIEW','SELECTED','OFFER_PENDING','OFFERED','ACCEPTED','DECLINED','REJECTED','WITHDRAWN','ONBOARDING','HIRED')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(requisition_id,email)
);
create index if not exists office_candidates_req_idx on public.office_candidates(requisition_id,status,updated_at desc);

create table if not exists public.office_candidate_interviews(
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.office_candidates(id) on delete cascade,
 stage_code text not null,
 title text not null,
 interviewer_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 scheduled_start timestamptz not null,
 scheduled_end timestamptz,
 location_or_link text,
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(scheduled_end is null or scheduled_end>scheduled_start)
);

create table if not exists public.office_candidate_interview_feedback(
 id uuid primary key default gen_random_uuid(),
 interview_id uuid not null references public.office_candidate_interviews(id) on delete cascade,
 interviewer_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 outcome text not null check(outcome in ('STRONG_YES','YES','MIXED','NO','STRONG_NO')),
 evidence_note text not null check(char_length(trim(evidence_note))>=3),
 strengths text,
 concerns text,
 submitted_at timestamptz not null default now(),
 unique(interview_id,interviewer_user_id)
);

create table if not exists public.office_offer_proposals(
 id uuid primary key default gen_random_uuid(),
 offer_code text not null unique default ('KR-OFR-'||lpad(nextval('public.office_offer_seq')::text,7,'0')),
 candidate_id uuid not null unique references public.office_candidates(id) on delete restrict,
 requisition_id uuid not null references public.office_hiring_requisitions(id) on delete restrict,
 position_code text not null,
 department_code text not null,
 reporting_manager_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 employment_type text not null,
 work_mode text not null,
 work_location text,
 joining_date date not null,
 grade_code text,
 annual_ctc_minor bigint not null check(annual_ctc_minor>=0),
 monthly_gross_minor bigint not null check(monthly_gross_minor>=0),
 currency text not null check(char_length(currency)=3),
 compensation_components jsonb not null default '[]'::jsonb,
 probation_months integer check(probation_months is null or probation_months between 0 and 36),
 variable_pay_note text,
 special_condition_note text,
 valid_until timestamptz,
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','APPROVED','DOCUMENT_READY','OFFERED','ACCEPTED','DECLINED','WITHDRAWN','EXPIRED','ONBOARDING','HIRED')),
 approval_request_id uuid references public.office_requests(id) on delete restrict,
 offer_document_instance_id uuid references public.office_document_instances(id) on delete restrict,
 pre_onboarding_request_id uuid references public.office_requests(id) on delete restrict,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 offered_at timestamptz,
 accepted_at timestamptz,
 declined_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(compensation_components)='array')
);

create table if not exists public.office_candidate_document_requests(
 id uuid primary key default gen_random_uuid(),
 candidate_id uuid not null references public.office_candidates(id) on delete cascade,
 document_type text not null,
 label text not null,
 required boolean not null default true,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','RECEIVED','UNDER_REVIEW','VERIFIED','REJECTED','WAIVED')),
 storage_reference text,
 source_reference text,
 verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 verified_at timestamptz,
 note text,
 requested_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(candidate_id,document_type)
);

create table if not exists public.office_recruitment_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 requisition_id uuid references public.office_hiring_requisitions(id) on delete cascade,
 candidate_id uuid references public.office_candidates(id) on delete cascade,
 offer_id uuid references public.office_offer_proposals(id) on delete cascade,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_hiring_requisitions enable row level security;
alter table public.office_candidates enable row level security;
alter table public.office_candidate_interviews enable row level security;
alter table public.office_candidate_interview_feedback enable row level security;
alter table public.office_offer_proposals enable row level security;
alter table public.office_candidate_document_requests enable row level security;
alter table public.office_recruitment_events enable row level security;
revoke all on public.office_hiring_requisitions,public.office_candidates,public.office_candidate_interviews,public.office_candidate_interview_feedback,public.office_offer_proposals,public.office_candidate_document_requests,public.office_recruitment_events from anon,authenticated;
grant select,insert,update on public.office_hiring_requisitions,public.office_candidates,public.office_candidate_interviews,public.office_offer_proposals,public.office_candidate_document_requests to service_role;
grant select,insert on public.office_candidate_interview_feedback,public.office_recruitment_events to service_role;

create or replace function public.office_hiring_requisition_create(p_actor uuid,p_position text,p_department text,p_manager uuid,p_openings integer,p_employment_type text,p_work_mode text,p_location text,p_budget_min bigint,p_budget_max bigint,p_currency text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'hiring.requisition.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.requisition.manage','DEPARTMENT',p_department,null) then raise exception 'Hiring requisition permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_manager and status='ACTIVE') then raise exception 'Active hiring manager is required'; end if;
 insert into public.office_hiring_requisitions(position_code,department_code,hiring_manager_user_id,openings,employment_type,work_mode,location_text,budget_min_minor,budget_max_minor,currency,business_reason,created_by)
 values(upper(trim(p_position)),upper(trim(p_department)),p_manager,p_openings,upper(trim(p_employment_type)),upper(trim(p_work_mode)),nullif(trim(coalesce(p_location,'')),''),p_budget_min,p_budget_max,case when p_currency is null then null else upper(trim(p_currency)) end,trim(p_reason),p_actor) returning id into v_id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,event_type,new_status,note) values(p_actor,v_id,'REQUISITION_DRAFT_CREATED','DRAFT',trim(p_reason));
 return v_id;
end; $$;

create or replace function public.office_hiring_requisition_submit(p_actor uuid,p_requisition uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_hiring_requisitions%rowtype; approval uuid;
begin
 select * into r from public.office_hiring_requisitions where id=p_requisition for update;
 if r.id is null or r.status not in ('DRAFT','REJECTED') then raise exception 'Hiring requisition is not submittable'; end if;
 if r.created_by<>p_actor and r.hiring_manager_user_id<>p_actor then raise exception 'Requisition creator or hiring manager must submit'; end if;
 approval:=public.office_create_request(p_actor,'HEADCOUNT_APPROVAL','Headcount approval · '||r.requisition_code,r.position_code||' · '||r.department_code||' · '||r.openings::text||' opening(s)',jsonb_build_object('requisition_id',r.id,'position_code',r.position_code,'department_code',r.department_code,'openings',r.openings,'budget_min_minor',r.budget_min_minor,'budget_max_minor',r.budget_max_minor,'currency',r.currency),'NORMAL',r.hiring_manager_user_id,'HIRING_REQUISITION',r.id::text);
 update public.office_hiring_requisitions set status='PENDING_APPROVAL',approval_request_id=approval,updated_at=now() where id=r.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,event_type,previous_status,new_status,metadata) values(p_actor,r.id,'REQUISITION_SUBMITTED',r.status,'PENDING_APPROVAL',jsonb_build_object('approval_request_id',approval));
 return approval;
end; $$;

create or replace function public.office_hiring_requisition_sync(p_actor uuid,p_requisition uuid)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_hiring_requisitions%rowtype; a public.office_requests%rowtype; state text;
begin
 select * into r from public.office_hiring_requisitions where id=p_requisition for update;
 if r.id is null or r.approval_request_id is null then raise exception 'Headcount approval request is missing'; end if;
 select * into a from public.office_requests where id=r.approval_request_id;
 if a.id is null then raise exception 'Headcount approval workflow not found'; end if;
 state:=case when a.status='APPROVED' then 'APPROVED' when a.status='REJECTED' then 'REJECTED' when a.status in ('CANCELLED','EXPIRED') then 'CANCELLED' else 'PENDING_APPROVAL' end;
 if state='APPROVED' then update public.office_hiring_requisitions set status='OPEN',approved_at=coalesce(approved_at,now()),opened_at=coalesce(opened_at,now()),updated_at=now() where id=r.id;
 elsif state<>r.status then update public.office_hiring_requisitions set status=state,updated_at=now() where id=r.id; end if;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,event_type,previous_status,new_status,metadata) values(p_actor,r.id,'REQUISITION_APPROVAL_SYNCED',r.status,case when state='APPROVED' then 'OPEN' else state end,jsonb_build_object('workflow_status',a.status));
 return case when state='APPROVED' then 'OPEN' else state end;
end; $$;

create or replace function public.office_candidate_create(p_actor uuid,p_requisition uuid,p_name text,p_email text,p_phone text,p_location text,p_source_channel text,p_source_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_hiring_requisitions%rowtype; v_id uuid;
begin
 select * into r from public.office_hiring_requisitions where id=p_requisition;
 if r.id is null or r.status<>'OPEN' then raise exception 'Open hiring requisition is required'; end if;
 if not public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,null) then raise exception 'Candidate management permission is required'; end if;
 insert into public.office_candidates(requisition_id,full_name,email,phone,location_text,source_channel,source_reference,owner_user_id,created_by)
 values(r.id,trim(p_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),nullif(trim(coalesce(p_location,'')),''),upper(trim(coalesce(p_source_channel,'DIRECT'))),nullif(trim(coalesce(p_source_reference,'')),''),p_actor,p_actor) returning id into v_id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,new_status) values(p_actor,r.id,v_id,'CANDIDATE_CREATED','APPLIED');
 return v_id;
end; $$;

create or replace function public.office_candidate_transition(p_actor uuid,p_candidate uuid,p_status text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.office_candidates%rowtype; r public.office_hiring_requisitions%rowtype; target text:=upper(trim(p_status));
begin
 select * into c from public.office_candidates where id=p_candidate for update; if c.id is null then raise exception 'Candidate not found'; end if;
 select * into r from public.office_hiring_requisitions where id=c.requisition_id;
 if not public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,null) then raise exception 'Candidate management permission is required'; end if;
 if target not in ('APPLIED','SCREENING','INTERVIEW','SELECTED','OFFER_PENDING','OFFERED','ACCEPTED','DECLINED','REJECTED','WITHDRAWN','ONBOARDING','HIRED') then raise exception 'Invalid candidate status'; end if;
 update public.office_candidates set status=target,updated_at=now() where id=c.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,previous_status,new_status,note) values(p_actor,c.requisition_id,c.id,'CANDIDATE_STATUS_CHANGED',c.status,target,left(trim(coalesce(p_note,'')),2000));
 return target;
end; $$;

create or replace function public.office_candidate_document_request(p_actor uuid,p_candidate uuid,p_type text,p_label text,p_required boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_candidates%rowtype; r public.office_hiring_requisitions%rowtype; v_id uuid;
begin
 select * into c from public.office_candidates where id=p_candidate; if c.id is null then raise exception 'Candidate not found'; end if;
 select * into r from public.office_hiring_requisitions where id=c.requisition_id;
 if not public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,null) then raise exception 'Candidate management permission is required'; end if;
 insert into public.office_candidate_document_requests(candidate_id,document_type,label,required,requested_by) values(c.id,upper(trim(p_type)),trim(p_label),coalesce(p_required,true),p_actor)
 on conflict(candidate_id,document_type) do update set label=excluded.label,required=excluded.required,status=case when public.office_candidate_document_requests.status in ('VERIFIED','WAIVED') then public.office_candidate_document_requests.status else 'REQUESTED' end,requested_by=p_actor,requested_at=now(),updated_at=now() returning id into v_id;
 return v_id;
end; $$;

create or replace function public.office_offer_create_draft(p_actor uuid,p_candidate uuid,p_manager uuid,p_joining date,p_grade text,p_annual bigint,p_monthly bigint,p_currency text,p_components jsonb,p_probation integer,p_variable_note text,p_special_note text,p_valid_until timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_candidates%rowtype; r public.office_hiring_requisitions%rowtype; v_id uuid;
begin
 select * into c from public.office_candidates where id=p_candidate for update; if c.id is null or c.status not in ('SELECTED','OFFER_PENDING') then raise exception 'Selected candidate is required'; end if;
 select * into r from public.office_hiring_requisitions where id=c.requisition_id; if r.id is null or r.status not in ('OPEN','FILLED') then raise exception 'Active requisition is required'; end if;
 if not public.office_effective_permission(p_actor,'hiring.offer.prepare','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.offer.prepare','DEPARTMENT',r.department_code,null) then raise exception 'Offer preparation permission is required'; end if;
 if jsonb_typeof(coalesce(p_components,'[]'::jsonb))<>'array' then raise exception 'Offer compensation components must be an array'; end if;
 insert into public.office_offer_proposals(candidate_id,requisition_id,position_code,department_code,reporting_manager_user_id,employment_type,work_mode,work_location,joining_date,grade_code,annual_ctc_minor,monthly_gross_minor,currency,compensation_components,probation_months,variable_pay_note,special_condition_note,valid_until,created_by)
 values(c.id,r.id,r.position_code,r.department_code,p_manager,r.employment_type,r.work_mode,r.location_text,p_joining,nullif(trim(coalesce(p_grade,'')),''),p_annual,p_monthly,upper(trim(p_currency)),coalesce(p_components,'[]'::jsonb),p_probation,nullif(trim(coalesce(p_variable_note,'')),''),nullif(trim(coalesce(p_special_note,'')),''),p_valid_until,p_actor) returning id into v_id;
 update public.office_candidates set status='OFFER_PENDING',updated_at=now() where id=c.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,offer_id,event_type,new_status) values(p_actor,r.id,c.id,v_id,'OFFER_DRAFT_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_offer_submit(p_actor uuid,p_offer uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.office_offer_proposals%rowtype; c public.office_candidates%rowtype; approval uuid;
begin
 select * into o from public.office_offer_proposals where id=p_offer for update; if o.id is null or o.status<>'DRAFT' then raise exception 'Offer proposal is not submittable'; end if;
 select * into c from public.office_candidates where id=o.candidate_id;
 if o.created_by<>p_actor and not public.office_effective_permission(p_actor,'hiring.offer.prepare','COMPANY',null,null) then raise exception 'Offer preparation permission is required'; end if;
 approval:=public.office_create_request(p_actor,'EMPLOYMENT_OFFER_APPROVAL','Offer approval · '||o.offer_code,c.full_name||' · '||o.position_code||' · joining '||o.joining_date::text,jsonb_build_object('offer_id',o.id,'candidate_id',o.candidate_id,'requisition_id',o.requisition_id,'annual_ctc_minor',o.annual_ctc_minor,'monthly_gross_minor',o.monthly_gross_minor,'currency',o.currency,'joining_date',o.joining_date,'position_code',o.position_code,'department_code',o.department_code),'HIGH',o.reporting_manager_user_id,'OFFER_PROPOSAL',o.id::text);
 update public.office_offer_proposals set status='PENDING_APPROVAL',approval_request_id=approval,updated_at=now() where id=o.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,offer_id,event_type,previous_status,new_status,metadata) values(p_actor,o.requisition_id,o.candidate_id,o.id,'OFFER_SUBMITTED',o.status,'PENDING_APPROVAL',jsonb_build_object('approval_request_id',approval));
 return approval;
end; $$;

create or replace function public.office_offer_sync(p_actor uuid,p_offer uuid)
returns text language plpgsql security definer set search_path='' as $$
declare o public.office_offer_proposals%rowtype; r public.office_requests%rowtype; final_approver uuid; state text;
begin
 select * into o from public.office_offer_proposals where id=p_offer for update; if o.id is null or o.approval_request_id is null then raise exception 'Offer approval request is missing'; end if;
 select * into r from public.office_requests where id=o.approval_request_id; if r.id is null then raise exception 'Offer approval workflow not found'; end if;
 if r.status='APPROVED' then select decision_by into final_approver from public.office_request_steps where request_id=r.id and status='APPROVED' order by step_order desc limit 1; update public.office_offer_proposals set status='APPROVED',approved_by=final_approver,approved_at=now(),updated_at=now() where id=o.id; state:='APPROVED';
 elsif r.status='REJECTED' then update public.office_offer_proposals set status='DRAFT',approval_request_id=null,updated_at=now() where id=o.id; state:='REJECTED'; else state:='PENDING_APPROVAL'; end if;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,offer_id,event_type,metadata) values(p_actor,o.requisition_id,o.candidate_id,o.id,'OFFER_APPROVAL_SYNCED',jsonb_build_object('workflow_status',r.status,'offer_state',state));
 return state;
end; $$;

create or replace function public.office_offer_mark_accepted(p_actor uuid,p_offer uuid,p_evidence_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.office_offer_proposals%rowtype; c public.office_candidates%rowtype; req uuid;
begin
 select * into o from public.office_offer_proposals where id=p_offer for update; if o.id is null or o.status not in ('APPROVED','DOCUMENT_READY','OFFERED') then raise exception 'Approved offered proposal is required'; end if;
 if not public.office_effective_permission(p_actor,'hiring.onboarding.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.onboarding.manage','DEPARTMENT',o.department_code,null) then raise exception 'Pre-onboarding permission is required'; end if;
 select * into c from public.office_candidates where id=o.candidate_id for update;
 req:=public.office_create_request(p_actor,'PRE_ONBOARDING_ACCESS','Pre-onboarding access · '||o.offer_code,c.full_name||' accepted · evidence '||left(trim(p_evidence_reference),300),jsonb_build_object('offer_id',o.id,'candidate_id',c.id,'candidate_email',c.email,'position_code',o.position_code,'department_code',o.department_code,'reporting_manager_user_id',o.reporting_manager_user_id,'joining_date',o.joining_date,'employment_type',o.employment_type,'acceptance_evidence_reference',trim(p_evidence_reference)),'HIGH',o.reporting_manager_user_id,'CANDIDATE',c.id::text);
 update public.office_offer_proposals set status='ONBOARDING',accepted_at=now(),pre_onboarding_request_id=req,updated_at=now() where id=o.id;
 update public.office_candidates set status='ONBOARDING',updated_at=now() where id=c.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,offer_id,event_type,previous_status,new_status,metadata) values(p_actor,o.requisition_id,c.id,o.id,'OFFER_ACCEPTANCE_RECORDED',o.status,'ONBOARDING',jsonb_build_object('evidence_reference',trim(p_evidence_reference),'pre_onboarding_request_id',req,'provider_accounts_created',false));
 return req;
end; $$;

revoke all on function public.office_hiring_requisition_create(uuid,text,text,uuid,integer,text,text,text,bigint,bigint,text,text) from public,anon,authenticated;
revoke all on function public.office_hiring_requisition_submit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_hiring_requisition_sync(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_candidate_create(uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_candidate_transition(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_candidate_document_request(uuid,uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.office_offer_create_draft(uuid,uuid,uuid,date,text,bigint,bigint,text,jsonb,integer,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_offer_submit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_offer_sync(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_offer_mark_accepted(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.office_hiring_requisition_create(uuid,text,text,uuid,integer,text,text,text,bigint,bigint,text,text) to service_role;
grant execute on function public.office_hiring_requisition_submit(uuid,uuid) to service_role;
grant execute on function public.office_hiring_requisition_sync(uuid,uuid) to service_role;
grant execute on function public.office_candidate_create(uuid,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.office_candidate_transition(uuid,uuid,text,text) to service_role;
grant execute on function public.office_candidate_document_request(uuid,uuid,text,text,boolean) to service_role;
grant execute on function public.office_offer_create_draft(uuid,uuid,uuid,date,text,bigint,bigint,text,jsonb,integer,text,text,timestamptz) to service_role;
grant execute on function public.office_offer_submit(uuid,uuid) to service_role;
grant execute on function public.office_offer_sync(uuid,uuid) to service_role;
grant execute on function public.office_offer_mark_accepted(uuid,uuid,text) to service_role;
