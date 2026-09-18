-- KRAVIA Office OS — resilience, continuity, emergency and insurance controls.
-- Plans, tests, incidents and claims are evidence-backed company records. No automatic legal/insurance conclusion is made.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('resilience.read','RESILIENCE','READ','Read resilience records','Read authorised continuity, recovery, emergency and test records.','SENSITIVE',false,true,true),
 ('resilience.plan.manage','RESILIENCE','MANAGE_PLAN','Manage continuity plan','Create and maintain business-continuity and disaster-recovery plans.','HIGH',true,true,true),
 ('resilience.plan.review','RESILIENCE','REVIEW_PLAN','Review continuity plan','Independently approve or retire continuity/recovery plans.','CRITICAL',true,true,true),
 ('resilience.test.manage','RESILIENCE','MANAGE_TEST','Manage resilience tests','Schedule and execute tabletop, restore, failover, communication and evacuation tests.','HIGH',true,true,true),
 ('resilience.test.review','RESILIENCE','REVIEW_TEST','Review resilience test','Independently verify resilience-test outcome evidence.','CRITICAL',true,true,true),
 ('resilience.incident.report','RESILIENCE','REPORT_INCIDENT','Report emergency incident','Report safety, security, medical, power, network, weather or other emergency incidents.','STANDARD',false,false,true),
 ('resilience.incident.read','RESILIENCE','READ_INCIDENT','Read emergency incident','Read own or authorised emergency incident records.','SENSITIVE',false,true,true),
 ('resilience.incident.manage','RESILIENCE','MANAGE_INCIDENT','Manage emergency incident','Assign incident command and manage containment/recovery lifecycle.','CRITICAL',true,true,true),
 ('insurance.read','INSURANCE','READ','Read insurance','Read authorised insurance policies and claims.','SENSITIVE',false,true,true),
 ('insurance.manage','INSURANCE','MANAGE','Manage insurance','Create and maintain company insurance policies and claim evidence.','HIGH',true,true,true),
 ('insurance.review','INSURANCE','REVIEW','Review insurance claim','Independently review insurance claim decisions and closure evidence.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'resilience.incident.report','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'resilience.incident.read','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OPERATIONS_MANAGER','resilience.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','resilience.plan.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','resilience.test.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','resilience.incident.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','resilience.incident.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','resilience.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','resilience.plan.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','resilience.test.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','resilience.incident.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','resilience.incident.manage','ALLOW','COMPANY'),
 ('RISK_MANAGER','resilience.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','resilience.plan.review','ALLOW','COMPANY'),
 ('RISK_MANAGER','resilience.test.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','resilience.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','resilience.incident.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','insurance.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','insurance.manage','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','insurance.review','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','insurance.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','insurance.review','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','insurance.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','insurance.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','insurance.read','ALLOW','COMPANY'),
 ('HR_MANAGER','insurance.manage','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','insurance.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_continuity_plan_seq;
create sequence if not exists public.office_resilience_test_seq;
create sequence if not exists public.office_emergency_incident_seq;
create sequence if not exists public.office_insurance_policy_seq;
create sequence if not exists public.office_insurance_claim_seq;
grant usage,select on sequence public.office_continuity_plan_seq,public.office_resilience_test_seq,public.office_emergency_incident_seq,public.office_insurance_policy_seq,public.office_insurance_claim_seq to service_role;

create table if not exists public.office_continuity_plans(
 id uuid primary key default gen_random_uuid(),
 plan_code text not null unique default ('KR-BCP-'||lpad(nextval('public.office_continuity_plan_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 plan_type text not null check(plan_type in ('BUSINESS_CONTINUITY','DISASTER_RECOVERY','EMERGENCY_RESPONSE','DEPENDENCY_RECOVERY','OTHER')),
 criticality text not null default 'HIGH' check(criticality in ('LOW','MEDIUM','HIGH','CRITICAL')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 scope_text text not null,
 recovery_order text not null,
 fallback_procedure text not null,
 communication_plan text,
 rto_minutes integer check(rto_minutes is null or rto_minutes between 0 and 525600),
 rpo_minutes integer check(rpo_minutes is null or rpo_minutes between 0 and 525600),
 next_test_on date,
 version integer not null default 1 check(version>0),
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','ACTIVE','RETIRED','REJECTED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_continuity_plan_status_idx on public.office_continuity_plans(status,next_test_on,criticality);

create table if not exists public.office_resilience_tests(
 id uuid primary key default gen_random_uuid(),
 test_code text not null unique default ('KR-RST-'||lpad(nextval('public.office_resilience_test_seq')::text,6,'0')),
 plan_id uuid not null references public.office_continuity_plans(id) on delete restrict,
 test_type text not null check(test_type in ('TABLETOP','RESTORE','FAILOVER','COMMUNICATION','EVACUATION','BACKUP_RECOVERY','OTHER')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 scheduled_on date not null,
 conducted_at timestamptz,
 status text not null default 'PLANNED' check(status in ('PLANNED','IN_PROGRESS','AWAITING_REVIEW','VERIFIED_PASS','VERIFIED_FAIL','CANCELLED')),
 result_summary text,
 evidence_reference text,
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_resilience_tests_plan_idx on public.office_resilience_tests(plan_id,status,scheduled_on);

create table if not exists public.office_emergency_incidents(
 id uuid primary key default gen_random_uuid(),
 incident_code text not null unique default ('KR-EMR-'||lpad(nextval('public.office_emergency_incident_seq')::text,6,'0')),
 reporter_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 site_id uuid references public.office_facility_sites(id) on delete restrict,
 category text not null check(category in ('FIRE','MEDICAL','SECURITY','POWER','NETWORK','WEATHER','SAFETY','FACILITY','OTHER')),
 severity text not null check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 description text not null,
 status text not null default 'OPEN' check(status in ('OPEN','ACTIVE','CONTAINED','RECOVERING','RESOLVED','CLOSED','CANCELLED')),
 incident_commander_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 containment_summary text,
 recovery_summary text,
 evidence_reference text,
 opened_at timestamptz not null default now(),
 contained_at timestamptz,
 resolved_at timestamptz,
 closed_at timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists office_emergency_incidents_status_idx on public.office_emergency_incidents(status,severity,opened_at desc);
create index if not exists office_emergency_incidents_reporter_idx on public.office_emergency_incidents(reporter_user_id,opened_at desc);

create table if not exists public.office_insurance_policies(
 id uuid primary key default gen_random_uuid(),
 policy_code text not null unique default ('KR-INS-'||lpad(nextval('public.office_insurance_policy_seq')::text,6,'0')),
 insurance_type text not null check(insurance_type in ('EMPLOYEE','CYBER','DIRECTORS_OFFICERS','EQUIPMENT','PROPERTY','LIABILITY','TRAVEL','OTHER')),
 provider_name text not null,
 provider_policy_reference text not null,
 coverage_summary text not null,
 premium_paise bigint check(premium_paise is null or premium_paise>=0),
 currency text not null default 'INR' check(char_length(currency)=3),
 effective_on date not null,
 expires_on date not null,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 document_reference text not null,
 status text not null default 'ACTIVE' check(status in ('DRAFT','ACTIVE','EXPIRED','CANCELLED','RENEWED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_on>=effective_on)
);
create index if not exists office_insurance_policies_expiry_idx on public.office_insurance_policies(status,expires_on);

create table if not exists public.office_insurance_claims(
 id uuid primary key default gen_random_uuid(),
 claim_code text not null unique default ('KR-ICL-'||lpad(nextval('public.office_insurance_claim_seq')::text,6,'0')),
 policy_id uuid not null references public.office_insurance_policies(id) on delete restrict,
 emergency_incident_id uuid references public.office_emergency_incidents(id) on delete restrict,
 reported_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 claim_amount_paise bigint check(claim_amount_paise is null or claim_amount_paise>=0),
 currency text not null default 'INR' check(char_length(currency)=3),
 description text not null,
 evidence_reference text not null,
 insurer_reference text,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID','CLOSED')),
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 payment_reference text,
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_insurance_claims_policy_idx on public.office_insurance_claims(policy_id,status,created_at desc);

create table if not exists public.office_resilience_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 plan_id uuid references public.office_continuity_plans(id) on delete restrict,
 test_id uuid references public.office_resilience_tests(id) on delete restrict,
 incident_id uuid references public.office_emergency_incidents(id) on delete restrict,
 policy_id uuid references public.office_insurance_policies(id) on delete restrict,
 claim_id uuid references public.office_insurance_claims(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_continuity_plans enable row level security;
alter table public.office_resilience_tests enable row level security;
alter table public.office_emergency_incidents enable row level security;
alter table public.office_insurance_policies enable row level security;
alter table public.office_insurance_claims enable row level security;
alter table public.office_resilience_events enable row level security;
revoke all on public.office_continuity_plans,public.office_resilience_tests,public.office_emergency_incidents,public.office_insurance_policies,public.office_insurance_claims,public.office_resilience_events from public,anon,authenticated;
grant select,insert,update on public.office_continuity_plans,public.office_resilience_tests,public.office_emergency_incidents,public.office_insurance_policies,public.office_insurance_claims to service_role;
grant select,insert on public.office_resilience_events to service_role;

create or replace function public.office_continuity_plan_create(
 p_actor uuid,p_title text,p_type text,p_criticality text,p_owner uuid,p_scope text,p_recovery_order text,p_fallback text,p_communication text,p_rto integer,p_rpo integer,p_next_test date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'resilience.plan.manage','COMPANY',null,null) then raise exception 'Continuity-plan management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active continuity-plan owner is required'; end if;
 insert into public.office_continuity_plans(title,plan_type,criticality,owner_user_id,scope_text,recovery_order,fallback_procedure,communication_plan,rto_minutes,rpo_minutes,next_test_on,created_by)
 values(trim(p_title),upper(trim(p_type)),upper(trim(p_criticality)),p_owner,trim(p_scope),trim(p_recovery_order),trim(p_fallback),nullif(trim(coalesce(p_communication,'')),''),p_rto,p_rpo,p_next_test,p_actor)
 returning id into v_id;
 insert into public.office_resilience_events(actor_user_id,plan_id,event_type,new_status) values(p_actor,v_id,'PLAN_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_continuity_plan_transition(p_actor uuid,p_plan uuid,p_status text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare p public.office_continuity_plans%rowtype; target text:=upper(trim(p_status)); reviewer boolean;
begin
 select * into p from public.office_continuity_plans where id=p_plan for update;
 if p.id is null then raise exception 'Continuity plan not found'; end if;
 reviewer:=target in ('APPROVED','REJECTED','RETIRED');
 if reviewer then
  if not public.office_effective_permission(p_actor,'resilience.plan.review','COMPANY',null,null) then raise exception 'Independent plan-review permission is required'; end if;
  if p_actor=p.owner_user_id or p_actor=p.created_by then raise exception 'Plan owner/creator cannot independently review the same plan'; end if;
 else
  if not public.office_effective_permission(p_actor,'resilience.plan.manage','COMPANY',null,null) and p_actor<>p.owner_user_id then raise exception 'Continuity-plan management permission is required'; end if;
 end if;
 if p.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft plan must be submitted first'; end if;
 if p.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted plan must be approved or rejected'; end if;
 if p.status='APPROVED' and target not in ('ACTIVE','RETIRED') then raise exception 'Approved plan must be activated or retired'; end if;
 if p.status='ACTIVE' and target<>'RETIRED' then raise exception 'Active plan may only be retired'; end if;
 if p.status in ('REJECTED','RETIRED') then raise exception 'Finalized plan cannot be transitioned'; end if;
 update public.office_continuity_plans set status=target,reviewed_by=case when reviewer then p_actor else reviewed_by end,reviewed_at=case when reviewer then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=p.id;
 insert into public.office_resilience_events(actor_user_id,plan_id,event_type,previous_status,new_status,note) values(p_actor,p.id,'PLAN_TRANSITION',p.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_resilience_test_create(p_actor uuid,p_plan uuid,p_type text,p_owner uuid,p_scheduled date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'resilience.test.manage','COMPANY',null,null) then raise exception 'Resilience-test management permission is required'; end if;
 if not exists(select 1 from public.office_continuity_plans where id=p_plan and status in ('APPROVED','ACTIVE')) then raise exception 'Approved or active continuity plan is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active test owner is required'; end if;
 insert into public.office_resilience_tests(plan_id,test_type,owner_user_id,scheduled_on,created_by)
 values(p_plan,upper(trim(p_type)),p_owner,p_scheduled,p_actor) returning id into v_id;
 insert into public.office_resilience_events(actor_user_id,plan_id,test_id,event_type,new_status) values(p_actor,p_plan,v_id,'TEST_CREATED','PLANNED');
 return v_id;
end; $$;

create or replace function public.office_resilience_test_transition(p_actor uuid,p_test uuid,p_status text,p_summary text,p_evidence text)
returns text language plpgsql security definer set search_path='' as $$
declare t public.office_resilience_tests%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into t from public.office_resilience_tests where id=p_test for update;
 if t.id is null then raise exception 'Resilience test not found'; end if;
 review:=target in ('VERIFIED_PASS','VERIFIED_FAIL');
 if review then
  if not public.office_effective_permission(p_actor,'resilience.test.review','COMPANY',null,null) then raise exception 'Independent resilience-test review permission is required'; end if;
  if p_actor=t.owner_user_id or p_actor=t.created_by then raise exception 'Test owner/creator cannot independently verify the same test'; end if;
  if t.status<>'AWAITING_REVIEW' then raise exception 'Completed test awaiting review is required'; end if;
  if nullif(trim(coalesce(p_evidence,t.evidence_reference,'')),'') is null then raise exception 'Verification evidence is required'; end if;
 else
  if p_actor<>t.owner_user_id and not public.office_effective_permission(p_actor,'resilience.test.manage','COMPANY',null,null) then raise exception 'Test ownership or management permission is required'; end if;
  if t.status='PLANNED' and target not in ('IN_PROGRESS','CANCELLED') then raise exception 'Planned test must start or be cancelled'; end if;
  if t.status='IN_PROGRESS' and target<>'AWAITING_REVIEW' then raise exception 'In-progress test must be submitted for review'; end if;
 end if;
 update public.office_resilience_tests set status=target,conducted_at=case when target='AWAITING_REVIEW' then coalesce(conducted_at,now()) else conducted_at end,result_summary=coalesce(nullif(trim(coalesce(p_summary,'')),''),result_summary),evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),reviewer_user_id=case when review then p_actor else reviewer_user_id end,reviewed_at=case when review then now() else reviewed_at end,updated_at=now() where id=t.id;
 insert into public.office_resilience_events(actor_user_id,plan_id,test_id,event_type,previous_status,new_status,note) values(p_actor,t.plan_id,t.id,'TEST_TRANSITION',t.status,target,left(p_summary,2000));
 return target;
end; $$;

create or replace function public.office_emergency_incident_report(p_actor uuid,p_site uuid,p_category text,p_severity text,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'resilience.incident.report','OWN',p_actor::text,null) then raise exception 'Emergency incident reporting permission is required'; end if;
 if p_site is not null and not exists(select 1 from public.office_facility_sites where id=p_site) then raise exception 'Office site not found'; end if;
 insert into public.office_emergency_incidents(reporter_user_id,site_id,category,severity,title,description)
 values(p_actor,p_site,upper(trim(p_category)),upper(trim(p_severity)),trim(p_title),trim(p_description)) returning id into v_id;
 insert into public.office_resilience_events(actor_user_id,incident_id,event_type,new_status) values(p_actor,v_id,'EMERGENCY_REPORTED','OPEN');
 return v_id;
end; $$;

create or replace function public.office_emergency_incident_transition(p_actor uuid,p_incident uuid,p_status text,p_commander uuid,p_containment text,p_recovery text,p_evidence text)
returns text language plpgsql security definer set search_path='' as $$
declare i public.office_emergency_incidents%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'resilience.incident.manage','COMPANY',null,null) then raise exception 'Emergency incident management permission is required'; end if;
 select * into i from public.office_emergency_incidents where id=p_incident for update;
 if i.id is null then raise exception 'Emergency incident not found'; end if;
 if p_commander is not null and not exists(select 1 from public.office_identity_users where user_id=p_commander and status='ACTIVE') then raise exception 'Active incident commander is required'; end if;
 if target not in ('ACTIVE','CONTAINED','RECOVERING','RESOLVED','CLOSED','CANCELLED') then raise exception 'Invalid emergency incident status'; end if;
 if target in ('RESOLVED','CLOSED') and nullif(trim(coalesce(p_recovery,i.recovery_summary,'')),'') is null then raise exception 'Recovery summary is required'; end if;
 if target='CLOSED' and nullif(trim(coalesce(p_evidence,i.evidence_reference,'')),'') is null then raise exception 'Closure evidence is required'; end if;
 update public.office_emergency_incidents set status=target,incident_commander_user_id=coalesce(p_commander,incident_commander_user_id),containment_summary=coalesce(nullif(trim(coalesce(p_containment,'')),''),containment_summary),recovery_summary=coalesce(nullif(trim(coalesce(p_recovery,'')),''),recovery_summary),evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),contained_at=case when target='CONTAINED' then coalesce(contained_at,now()) else contained_at end,resolved_at=case when target='RESOLVED' then coalesce(resolved_at,now()) else resolved_at end,closed_at=case when target='CLOSED' then coalesce(closed_at,now()) else closed_at end,updated_at=now() where id=i.id;
 insert into public.office_resilience_events(actor_user_id,incident_id,event_type,previous_status,new_status) values(p_actor,i.id,'EMERGENCY_TRANSITION',i.status,target);
 return target;
end; $$;

create or replace function public.office_insurance_policy_create(p_actor uuid,p_type text,p_provider text,p_policy_ref text,p_coverage text,p_premium bigint,p_currency text,p_effective date,p_expiry date,p_owner uuid,p_document text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'insurance.manage','COMPANY',null,null) then raise exception 'Insurance management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active insurance owner is required'; end if;
 insert into public.office_insurance_policies(insurance_type,provider_name,provider_policy_reference,coverage_summary,premium_paise,currency,effective_on,expires_on,owner_user_id,document_reference,status,created_by)
 values(upper(trim(p_type)),trim(p_provider),trim(p_policy_ref),trim(p_coverage),p_premium,upper(trim(p_currency)),p_effective,p_expiry,p_owner,trim(p_document),'ACTIVE',p_actor) returning id into v_id;
 insert into public.office_resilience_events(actor_user_id,policy_id,event_type,new_status) values(p_actor,v_id,'INSURANCE_POLICY_CREATED','ACTIVE');
 return v_id;
end; $$;

create or replace function public.office_insurance_claim_create(p_actor uuid,p_policy uuid,p_incident uuid,p_owner uuid,p_amount bigint,p_currency text,p_description text,p_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'insurance.manage','COMPANY',null,null) then raise exception 'Insurance management permission is required'; end if;
 if not exists(select 1 from public.office_insurance_policies where id=p_policy and status='ACTIVE') then raise exception 'Active insurance policy is required'; end if;
 if p_incident is not null and not exists(select 1 from public.office_emergency_incidents where id=p_incident) then raise exception 'Emergency incident not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active claim owner is required'; end if;
 insert into public.office_insurance_claims(policy_id,emergency_incident_id,reported_by,owner_user_id,claim_amount_paise,currency,description,evidence_reference,status)
 values(p_policy,p_incident,p_actor,p_owner,p_amount,upper(trim(p_currency)),trim(p_description),trim(p_evidence),'SUBMITTED') returning id into v_id;
 insert into public.office_resilience_events(actor_user_id,policy_id,claim_id,incident_id,event_type,new_status) values(p_actor,p_policy,v_id,p_incident,'INSURANCE_CLAIM_CREATED','SUBMITTED');
 return v_id;
end; $$;

create or replace function public.office_insurance_claim_transition(p_actor uuid,p_claim uuid,p_status text,p_note text,p_insurer_reference text,p_payment_reference text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.office_insurance_claims%rowtype; target text:=upper(trim(p_status));
begin
 select * into c from public.office_insurance_claims where id=p_claim for update;
 if c.id is null then raise exception 'Insurance claim not found'; end if;
 if not public.office_effective_permission(p_actor,'insurance.review','COMPANY',null,null) then raise exception 'Independent insurance review permission is required'; end if;
 if p_actor=c.owner_user_id or p_actor=c.reported_by then raise exception 'Claim owner/reporter cannot independently review the same claim'; end if;
 if c.status='SUBMITTED' and target not in ('UNDER_REVIEW','REJECTED') then raise exception 'Submitted claim must enter review or be rejected'; end if;
 if c.status='UNDER_REVIEW' and target not in ('APPROVED','REJECTED') then raise exception 'Reviewed claim must be approved or rejected'; end if;
 if c.status='APPROVED' and target not in ('PAID','CLOSED') then raise exception 'Approved claim may be paid or closed'; end if;
 if c.status='PAID' and target<>'CLOSED' then raise exception 'Paid claim may only be closed'; end if;
 if c.status in ('REJECTED','CLOSED') then raise exception 'Finalized claim cannot be transitioned'; end if;
 if target='PAID' and nullif(trim(coalesce(p_payment_reference,'')),'') is null then raise exception 'Insurer payment reference is required'; end if;
 update public.office_insurance_claims set status=target,reviewed_by=p_actor,reviewed_at=now(),review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),insurer_reference=coalesce(nullif(trim(coalesce(p_insurer_reference,'')),''),insurer_reference),payment_reference=case when target='PAID' then trim(p_payment_reference) else payment_reference end,paid_at=case when target='PAID' then now() else paid_at end,updated_at=now() where id=c.id;
 insert into public.office_resilience_events(actor_user_id,policy_id,claim_id,incident_id,event_type,previous_status,new_status,note) values(p_actor,c.policy_id,c.id,c.emergency_incident_id,'INSURANCE_CLAIM_TRANSITION',c.status,target,left(p_note,2000));
 return target;
end; $$;

revoke all on function public.office_continuity_plan_create(uuid,text,text,text,uuid,text,text,text,text,integer,integer,date) from public,anon,authenticated;
revoke all on function public.office_continuity_plan_transition(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_resilience_test_create(uuid,uuid,text,uuid,date) from public,anon,authenticated;
revoke all on function public.office_resilience_test_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_emergency_incident_report(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_emergency_incident_transition(uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_insurance_policy_create(uuid,text,text,text,text,bigint,text,date,date,uuid,text) from public,anon,authenticated;
revoke all on function public.office_insurance_claim_create(uuid,uuid,uuid,uuid,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.office_insurance_claim_transition(uuid,uuid,text,text,text,text) from public,anon,authenticated;

grant execute on function public.office_continuity_plan_create(uuid,text,text,text,uuid,text,text,text,text,integer,integer,date) to service_role;
grant execute on function public.office_continuity_plan_transition(uuid,uuid,text,text) to service_role;
grant execute on function public.office_resilience_test_create(uuid,uuid,text,uuid,date) to service_role;
grant execute on function public.office_resilience_test_transition(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_emergency_incident_report(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_emergency_incident_transition(uuid,uuid,text,uuid,text,text,text) to service_role;
grant execute on function public.office_insurance_policy_create(uuid,text,text,text,text,bigint,text,date,date,uuid,text) to service_role;
grant execute on function public.office_insurance_claim_create(uuid,uuid,uuid,uuid,bigint,text,text,text) to service_role;
grant execute on function public.office_insurance_claim_transition(uuid,uuid,text,text,text,text) to service_role;
