-- KRAVIA enterprise risk, decision and controlled-change registers.
-- These registers provide accountable evidence. They do not replace specialized
-- legal, finance, security, board or production approval workflows.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('governance.risk.read','GOVERNANCE','READ_RISK','Read risk register','Read risks, treatments and mitigation actions inside assigned scope.','SENSITIVE',false,true,true),
 ('governance.risk.manage','GOVERNANCE','MANAGE_RISK','Manage risk register','Create and maintain risk assessments and mitigation actions without independently accepting or closing owned risks.','HIGH',true,true,true),
 ('governance.risk.review','GOVERNANCE','REVIEW_RISK','Review risk treatment','Independently accept or close risks after evidence review.','CRITICAL',true,true,true),
 ('governance.decision.read','GOVERNANCE','READ_DECISION','Read decision register','Read authorised executive decision evidence.','SENSITIVE',false,true,true),
 ('governance.decision.record','GOVERNANCE','RECORD_DECISION','Record executive decision','Record a decision made by an authorised owner/director with authority basis and immutable historical evidence.','CRITICAL',true,true,true),
 ('governance.change.read','GOVERNANCE','READ_CHANGE','Read controlled changes','Read organisation, policy, legal, security, data, process and other company change records.','SENSITIVE',false,true,true),
 ('governance.change.manage','GOVERNANCE','MANAGE_CHANGE','Manage controlled changes','Create and execute approved change records without independently verifying own change.','HIGH',true,true,true),
 ('governance.change.review','GOVERNANCE','REVIEW_CHANGE','Review controlled changes','Independently approve, reject, verify or close controlled company changes.','CRITICAL',true,true,true)
on conflict(code) do update set
 module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,
 sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_catalog(
 code,label,category,description,max_active_devices,requires_managed_device_for_high_risk,assignable_by_admin,owner_managed_only,active
) values (
 'RISK_MANAGER','Risk & Control Manager','GOVERNANCE',
 'Enterprise risk and controlled-change stewardship. Decision-making authority remains separate from register administration.',
 2,true,true,false,true
)
on conflict(code) do update set
 label=excluded.label,category=excluded.category,description=excluded.description,
 max_active_devices=excluded.max_active_devices,
 requires_managed_device_for_high_risk=excluded.requires_managed_device_for_high_risk,
 assignable_by_admin=excluded.assignable_by_admin,owner_managed_only=excluded.owner_managed_only,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('RISK_MANAGER','governance.risk.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','governance.risk.manage','ALLOW','COMPANY'),
 ('RISK_MANAGER','governance.risk.review','ALLOW','COMPANY'),
 ('RISK_MANAGER','governance.decision.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','governance.change.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','governance.change.manage','ALLOW','COMPANY'),
 ('RISK_MANAGER','governance.change.review','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','governance.risk.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','governance.decision.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','governance.decision.record','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','governance.change.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','governance.risk.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','governance.decision.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','governance.change.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','governance.risk.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','governance.decision.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','governance.risk.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','governance.risk.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','governance.change.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','governance.risk.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','governance.risk.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','governance.change.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','governance.change.manage','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','governance.risk.read','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','governance.risk.manage','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','governance.change.read','ALLOW','DEPARTMENT'),
 ('AUDITOR_READONLY','governance.risk.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','governance.decision.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','governance.change.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_risk_seq;
create sequence if not exists public.office_risk_action_seq;
create sequence if not exists public.office_decision_seq;
create sequence if not exists public.office_change_seq;
grant usage on sequence public.office_risk_seq,public.office_risk_action_seq,public.office_decision_seq,public.office_change_seq to service_role;

create table if not exists public.office_risks(
 id uuid primary key default gen_random_uuid(),
 risk_code text not null unique default ('KR-RSK-'||lpad(nextval('public.office_risk_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 category text not null check(category in ('FINANCIAL','OPERATIONAL','SECURITY','LEGAL','COMPLIANCE','PEOPLE','VENDOR','PRODUCT','CUSTOMER','INFRASTRUCTURE','PRIVACY','STRATEGIC','OTHER')),
 description text not null check(char_length(trim(description))>=3),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 likelihood smallint not null check(likelihood between 1 and 5),
 impact smallint not null check(impact between 1 and 5),
 treatment text not null default 'MITIGATE' check(treatment in ('AVOID','MITIGATE','TRANSFER','ACCEPT')),
 residual_likelihood smallint check(residual_likelihood is null or residual_likelihood between 1 and 5),
 residual_impact smallint check(residual_impact is null or residual_impact between 1 and 5),
 status text not null default 'IDENTIFIED' check(status in ('IDENTIFIED','ASSESSING','MITIGATING','MONITORING','ACCEPTED','CLOSED')),
 review_on date,
 source_reference text,
 acceptance_basis text,
 closure_evidence_reference text,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_risks_owner_idx on public.office_risks(owner_user_id,status,review_on);
create index if not exists office_risks_department_idx on public.office_risks(department_code,status,review_on);
create index if not exists office_risks_category_idx on public.office_risks(category,status);

create table if not exists public.office_risk_actions(
 id uuid primary key default gen_random_uuid(),
 action_code text not null unique default ('KR-RSA-'||lpad(nextval('public.office_risk_action_seq')::text,6,'0')),
 risk_id uuid not null references public.office_risks(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 3 and 220),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 due_on date,
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
 evidence_reference text,
 note text,
 completed_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_risk_actions_due_idx on public.office_risk_actions(status,due_on);
create index if not exists office_risk_actions_risk_idx on public.office_risk_actions(risk_id,status);

create table if not exists public.office_decisions(
 id uuid primary key default gen_random_uuid(),
 decision_code text not null unique default ('KR-DEC-'||lpad(nextval('public.office_decision_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 240),
 category text not null check(category in ('STRATEGY','PRODUCT','FINANCE','PEOPLE','LEGAL','SECURITY','OPERATIONS','CUSTOMER','VENDOR','GOVERNANCE','OTHER')),
 context text not null check(char_length(trim(context))>=3),
 decision_text text not null check(char_length(trim(decision_text))>=3),
 decision_maker_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 decision_at timestamptz not null,
 authority_basis text not null check(char_length(trim(authority_basis))>=3),
 approval_reference text,
 effective_from date,
 review_on date,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','SUPERSEDED','REVOKED')),
 supersedes_decision_id uuid references public.office_decisions(id) on delete restrict,
 superseded_by_decision_id uuid references public.office_decisions(id) on delete restrict,
 change_reason text,
 source_reference text,
 recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 recorded_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(supersedes_decision_id is null or supersedes_decision_id<>id),
 check(superseded_by_decision_id is null or superseded_by_decision_id<>id)
);
create index if not exists office_decisions_status_idx on public.office_decisions(status,decision_at desc);
create index if not exists office_decisions_review_idx on public.office_decisions(status,review_on);

create table if not exists public.office_controlled_changes(
 id uuid primary key default gen_random_uuid(),
 change_code text not null unique default ('KR-CHG-'||lpad(nextval('public.office_change_seq')::text,6,'0')),
 change_kind text not null check(change_kind in ('ORGANISATION','POLICY','COMPENSATION','FINANCE','INFRASTRUCTURE','LEGAL','PROCESS','SECURITY','DATA','PRODUCT','CUSTOMER','VENDOR','OTHER')),
 title text not null check(char_length(trim(title)) between 3 and 240),
 description text not null check(char_length(trim(description))>=3),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 risk_summary text,
 implementation_plan text not null check(char_length(trim(implementation_plan))>=3),
 rollback_plan text,
 approval_reference text,
 effective_at timestamptz,
 status text not null default 'PROPOSED' check(status in ('PROPOSED','APPROVED','REJECTED','IN_PROGRESS','VERIFIED','ROLLED_BACK','CLOSED')),
 verification_evidence_reference text,
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_changes_department_idx on public.office_controlled_changes(department_code,status,effective_at);
create index if not exists office_changes_owner_idx on public.office_controlled_changes(owner_user_id,status,effective_at);

create table if not exists public.office_control_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 risk_id uuid references public.office_risks(id) on delete restrict,
 risk_action_id uuid references public.office_risk_actions(id) on delete restrict,
 decision_id uuid references public.office_decisions(id) on delete restrict,
 change_id uuid references public.office_controlled_changes(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists office_control_events_risk_idx on public.office_control_events(risk_id,created_at desc);
create index if not exists office_control_events_decision_idx on public.office_control_events(decision_id,created_at desc);
create index if not exists office_control_events_change_idx on public.office_control_events(change_id,created_at desc);

alter table public.office_risks enable row level security;
alter table public.office_risk_actions enable row level security;
alter table public.office_decisions enable row level security;
alter table public.office_controlled_changes enable row level security;
alter table public.office_control_events enable row level security;
revoke all on public.office_risks,public.office_risk_actions,public.office_decisions,public.office_controlled_changes,public.office_control_events from public,anon,authenticated;
grant select on public.office_risks,public.office_risk_actions,public.office_decisions,public.office_controlled_changes,public.office_control_events to service_role;

create or replace function public.office_risk_create(
 p_actor uuid,p_title text,p_category text,p_description text,p_owner uuid,p_department text,p_likelihood smallint,p_impact smallint,p_treatment text,p_review_on date,p_source text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_department text:=nullif(trim(coalesce(p_department,'')),'');
begin
 if not public.office_effective_permission(p_actor,'governance.risk.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'governance.risk.manage','DEPARTMENT',v_department,null) then
   raise exception 'Risk management permission is required';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active risk owner is required'; end if;
 insert into public.office_risks(title,category,description,owner_user_id,department_code,likelihood,impact,treatment,review_on,source_reference,created_by)
 values(trim(p_title),upper(trim(p_category)),trim(p_description),p_owner,v_department,p_likelihood,p_impact,upper(trim(p_treatment)),p_review_on,nullif(trim(coalesce(p_source,'')),''),p_actor)
 returning id into v_id;
 insert into public.office_control_events(actor_user_id,risk_id,event_type,new_status,metadata)
 values(p_actor,v_id,'RISK_CREATED','IDENTIFIED',jsonb_build_object('likelihood',p_likelihood,'impact',p_impact,'treatment',upper(trim(p_treatment))));
 return v_id;
end; $$;

create or replace function public.office_risk_update(
 p_actor uuid,p_risk uuid,p_likelihood smallint,p_impact smallint,p_treatment text,p_residual_likelihood smallint,p_residual_impact smallint,p_status text,p_review_on date,p_acceptance_basis text,p_closure_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare r public.office_risks%rowtype; next_status text:=upper(trim(p_status)); review_required boolean;
begin
 select * into r from public.office_risks where id=p_risk for update;
 if r.id is null then raise exception 'Risk not found'; end if;
 if not public.office_effective_permission(p_actor,'governance.risk.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'governance.risk.manage','DEPARTMENT',r.department_code,null) then
   raise exception 'Risk management permission is required';
 end if;
 review_required:=next_status in ('ACCEPTED','CLOSED');
 if review_required then
   if p_actor=r.owner_user_id then raise exception 'Risk owner cannot independently accept or close the same risk'; end if;
   if not public.office_effective_permission(p_actor,'governance.risk.review','COMPANY',null,null)
      and not public.office_effective_permission(p_actor,'governance.risk.review','DEPARTMENT',r.department_code,null) then
     raise exception 'Independent risk review permission is required';
   end if;
 end if;
 if next_status='ACCEPTED' and nullif(trim(coalesce(p_acceptance_basis,'')),'') is null then raise exception 'Risk acceptance basis is required'; end if;
 if next_status='CLOSED' and nullif(trim(coalesce(p_closure_evidence,'')),'') is null then raise exception 'Risk closure evidence is required'; end if;
 update public.office_risks set
   likelihood=coalesce(p_likelihood,likelihood),impact=coalesce(p_impact,impact),
   treatment=coalesce(nullif(upper(trim(coalesce(p_treatment,''))),''),treatment),
   residual_likelihood=p_residual_likelihood,residual_impact=p_residual_impact,status=next_status,review_on=p_review_on,
   acceptance_basis=case when next_status='ACCEPTED' then trim(p_acceptance_basis) else acceptance_basis end,
   closure_evidence_reference=case when next_status='CLOSED' then trim(p_closure_evidence) else closure_evidence_reference end,
   reviewed_by=case when review_required then p_actor else reviewed_by end,
   reviewed_at=case when review_required then now() else reviewed_at end,
   updated_at=now()
 where id=r.id;
 insert into public.office_control_events(actor_user_id,risk_id,event_type,previous_status,new_status,note,metadata)
 values(p_actor,r.id,'RISK_UPDATED',r.status,next_status,left(p_note,2000),
   jsonb_build_object('likelihood',coalesce(p_likelihood,r.likelihood),'impact',coalesce(p_impact,r.impact),'residual_likelihood',p_residual_likelihood,'residual_impact',p_residual_impact));
 return next_status;
end; $$;

create or replace function public.office_risk_action_create(
 p_actor uuid,p_risk uuid,p_title text,p_owner uuid,p_due date,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_risks%rowtype; v_id uuid;
begin
 select * into r from public.office_risks where id=p_risk;
 if r.id is null or r.status='CLOSED' then raise exception 'Open risk is required'; end if;
 if not public.office_effective_permission(p_actor,'governance.risk.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'governance.risk.manage','DEPARTMENT',r.department_code,null) then
   raise exception 'Risk management permission is required';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active action owner is required'; end if;
 insert into public.office_risk_actions(risk_id,title,owner_user_id,due_on,note,created_by)
 values(r.id,trim(p_title),p_owner,p_due,nullif(trim(coalesce(p_note,'')),''),p_actor) returning id into v_id;
 insert into public.office_control_events(actor_user_id,risk_id,risk_action_id,event_type,new_status)
 values(p_actor,r.id,v_id,'RISK_ACTION_CREATED','OPEN');
 return v_id;
end; $$;

create or replace function public.office_risk_action_transition(
 p_actor uuid,p_action uuid,p_status text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare a public.office_risk_actions%rowtype; r public.office_risks%rowtype; next_status text:=upper(trim(p_status));
begin
 select * into a from public.office_risk_actions where id=p_action for update;
 if a.id is null then raise exception 'Risk action not found'; end if;
 select * into r from public.office_risks where id=a.risk_id;
 if p_actor<>a.owner_user_id
    and not public.office_effective_permission(p_actor,'governance.risk.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'governance.risk.manage','DEPARTMENT',r.department_code,null) then
   raise exception 'Risk action ownership or management permission is required';
 end if;
 if next_status='DONE' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Completion evidence is required'; end if;
 update public.office_risk_actions set status=next_status,
   evidence_reference=case when next_status='DONE' then trim(p_evidence) else evidence_reference end,
   note=coalesce(nullif(trim(coalesce(p_note,'')),''),note),
   completed_at=case when next_status='DONE' then now() else null end,updated_at=now()
 where id=a.id;
 insert into public.office_control_events(actor_user_id,risk_id,risk_action_id,event_type,previous_status,new_status,note)
 values(p_actor,r.id,a.id,'RISK_ACTION_UPDATED',a.status,next_status,left(p_note,2000));
 return next_status;
end; $$;

create or replace function public.office_decision_record(
 p_actor uuid,p_title text,p_category text,p_context text,p_decision text,p_decision_maker uuid,p_decision_at timestamptz,p_authority_basis text,p_approval_reference text,p_effective_from date,p_review_on date,p_source text,p_supersedes uuid,p_change_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; prior public.office_decisions%rowtype;
begin
 if not public.office_effective_permission(p_actor,'governance.decision.record','COMPANY',null,null) then raise exception 'Decision recording permission is required'; end if;
 if not exists(
   select 1 from public.office_user_roles where user_id=p_decision_maker and role in ('OWNER','DIRECTOR') and (expires_at is null or expires_at>now())
 ) then raise exception 'Decision maker must have active owner or director authority'; end if;
 if p_supersedes is not null then
   select * into prior from public.office_decisions where id=p_supersedes for update;
   if prior.id is null or prior.status<>'ACTIVE' then raise exception 'Only an active decision may be superseded'; end if;
   if nullif(trim(coalesce(p_change_reason,'')),'') is null then raise exception 'Supersession reason is required'; end if;
 end if;
 insert into public.office_decisions(title,category,context,decision_text,decision_maker_user_id,decision_at,authority_basis,approval_reference,effective_from,review_on,supersedes_decision_id,change_reason,source_reference,recorded_by)
 values(trim(p_title),upper(trim(p_category)),trim(p_context),trim(p_decision),p_decision_maker,p_decision_at,trim(p_authority_basis),nullif(trim(coalesce(p_approval_reference,'')),''),p_effective_from,p_review_on,p_supersedes,nullif(trim(coalesce(p_change_reason,'')),''),nullif(trim(coalesce(p_source,'')),''),p_actor)
 returning id into v_id;
 if prior.id is not null then
   update public.office_decisions set status='SUPERSEDED',superseded_by_decision_id=v_id,updated_at=now() where id=prior.id;
   insert into public.office_control_events(actor_user_id,decision_id,event_type,previous_status,new_status,note,metadata)
   values(p_actor,prior.id,'DECISION_SUPERSEDED','ACTIVE','SUPERSEDED',left(p_change_reason,2000),jsonb_build_object('superseded_by',v_id));
 end if;
 insert into public.office_control_events(actor_user_id,decision_id,event_type,new_status,metadata)
 values(p_actor,v_id,'DECISION_RECORDED','ACTIVE',jsonb_build_object('decision_maker_user_id',p_decision_maker,'supersedes',p_supersedes));
 return v_id;
end; $$;

create or replace function public.office_decision_revoke(
 p_actor uuid,p_decision uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $$
declare d public.office_decisions%rowtype;
begin
 if not public.office_effective_permission(p_actor,'governance.decision.record','COMPANY',null,null) then raise exception 'Decision recording permission is required'; end if;
 select * into d from public.office_decisions where id=p_decision for update;
 if d.id is null or d.status<>'ACTIVE' then raise exception 'Active decision is required'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Revocation reason is required'; end if;
 update public.office_decisions set status='REVOKED',change_reason=trim(p_reason),updated_at=now() where id=d.id;
 insert into public.office_control_events(actor_user_id,decision_id,event_type,previous_status,new_status,note)
 values(p_actor,d.id,'DECISION_REVOKED',d.status,'REVOKED',left(p_reason,2000));
 return true;
end; $$;

create or replace function public.office_change_create(
 p_actor uuid,p_kind text,p_title text,p_description text,p_owner uuid,p_department text,p_risk_summary text,p_implementation text,p_rollback text,p_effective_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_department text:=nullif(trim(coalesce(p_department,'')),'');
begin
 if not public.office_effective_permission(p_actor,'governance.change.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'governance.change.manage','DEPARTMENT',v_department,null) then
   raise exception 'Controlled-change permission is required';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active change owner is required'; end if;
 insert into public.office_controlled_changes(change_kind,title,description,owner_user_id,department_code,risk_summary,implementation_plan,rollback_plan,effective_at,created_by)
 values(upper(trim(p_kind)),trim(p_title),trim(p_description),p_owner,v_department,nullif(trim(coalesce(p_risk_summary,'')),''),trim(p_implementation),nullif(trim(coalesce(p_rollback,'')),''),p_effective_at,p_actor)
 returning id into v_id;
 insert into public.office_control_events(actor_user_id,change_id,event_type,new_status) values(p_actor,v_id,'CHANGE_PROPOSED','PROPOSED');
 return v_id;
end; $$;

create or replace function public.office_change_transition(
 p_actor uuid,p_change uuid,p_status text,p_approval_reference text,p_verification_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_controlled_changes%rowtype; next_status text:=upper(trim(p_status)); can_manage boolean; can_review boolean;
begin
 select * into c from public.office_controlled_changes where id=p_change for update;
 if c.id is null then raise exception 'Controlled change not found'; end if;
 can_manage:=public.office_effective_permission(p_actor,'governance.change.manage','COMPANY',null,null)
   or public.office_effective_permission(p_actor,'governance.change.manage','DEPARTMENT',c.department_code,null);
 can_review:=public.office_effective_permission(p_actor,'governance.change.review','COMPANY',null,null)
   or public.office_effective_permission(p_actor,'governance.change.review','DEPARTMENT',c.department_code,null);
 if next_status in ('APPROVED','REJECTED','VERIFIED','CLOSED') then
   if not can_review then raise exception 'Independent change review permission is required'; end if;
   if p_actor=c.owner_user_id or p_actor=c.created_by then raise exception 'Change owner/creator cannot independently review the same change'; end if;
 else
   if not can_manage and p_actor<>c.owner_user_id then raise exception 'Controlled-change management permission is required'; end if;
 end if;
 if c.status='PROPOSED' and next_status not in ('APPROVED','REJECTED') then raise exception 'Proposed change must be approved or rejected first'; end if;
 if c.status='APPROVED' and next_status not in ('IN_PROGRESS','ROLLED_BACK') then raise exception 'Approved change must enter execution or rollback'; end if;
 if c.status='IN_PROGRESS' and next_status not in ('VERIFIED','ROLLED_BACK') then raise exception 'In-progress change must be verified or rolled back'; end if;
 if c.status='VERIFIED' and next_status<>'CLOSED' then raise exception 'Verified change may only be closed'; end if;
 if c.status in ('REJECTED','ROLLED_BACK','CLOSED') then raise exception 'Finalized change cannot be transitioned'; end if;
 if next_status='APPROVED' and nullif(trim(coalesce(p_approval_reference,'')),'') is null then raise exception 'Approval reference is required'; end if;
 if next_status in ('VERIFIED','CLOSED') and nullif(trim(coalesce(coalesce(p_verification_evidence,c.verification_evidence_reference),'')),'') is null then raise exception 'Verification evidence is required'; end if;
 update public.office_controlled_changes set
   status=next_status,
   approval_reference=case when next_status='APPROVED' then trim(p_approval_reference) else approval_reference end,
   verification_evidence_reference=case when next_status in ('VERIFIED','CLOSED') then coalesce(nullif(trim(coalesce(p_verification_evidence,'')),''),verification_evidence_reference) else verification_evidence_reference end,
   reviewer_user_id=case when next_status in ('APPROVED','REJECTED','VERIFIED','CLOSED') then p_actor else reviewer_user_id end,
   reviewed_at=case when next_status in ('APPROVED','REJECTED','VERIFIED','CLOSED') then now() else reviewed_at end,
   updated_at=now()
 where id=c.id;
 insert into public.office_control_events(actor_user_id,change_id,event_type,previous_status,new_status,note,metadata)
 values(p_actor,c.id,'CHANGE_TRANSITIONED',c.status,next_status,left(p_note,2000),
   jsonb_build_object('approval_reference',nullif(trim(coalesce(p_approval_reference,'')),''),'verification_evidence',nullif(trim(coalesce(p_verification_evidence,'')),'')));
 return next_status;
end; $$;

revoke all on function public.office_risk_create(uuid,text,text,text,uuid,text,smallint,smallint,text,date,text) from public,anon,authenticated;
revoke all on function public.office_risk_update(uuid,uuid,smallint,smallint,text,smallint,smallint,text,date,text,text,text) from public,anon,authenticated;
revoke all on function public.office_risk_action_create(uuid,uuid,text,uuid,date,text) from public,anon,authenticated;
revoke all on function public.office_risk_action_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_decision_record(uuid,text,text,text,text,uuid,timestamptz,text,text,date,date,text,uuid,text) from public,anon,authenticated;
revoke all on function public.office_decision_revoke(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_change_create(uuid,text,text,text,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_change_transition(uuid,uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.office_risk_create(uuid,text,text,text,uuid,text,smallint,smallint,text,date,text) to service_role;
grant execute on function public.office_risk_update(uuid,uuid,smallint,smallint,text,smallint,smallint,text,date,text,text,text) to service_role;
grant execute on function public.office_risk_action_create(uuid,uuid,text,uuid,date,text) to service_role;
grant execute on function public.office_risk_action_transition(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_decision_record(uuid,text,text,text,text,uuid,timestamptz,text,text,date,date,text,uuid,text) to service_role;
grant execute on function public.office_decision_revoke(uuid,uuid,text) to service_role;
grant execute on function public.office_change_create(uuid,text,text,text,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.office_change_transition(uuid,uuid,text,text,text,text) to service_role;
