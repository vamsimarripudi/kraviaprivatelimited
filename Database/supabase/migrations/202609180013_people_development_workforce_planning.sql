-- KRAVIA Office OS — people development and workforce planning.
-- Human performance decisions are explicit reviewer judgements. No telemetry-derived performance score exists in this schema.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('people.skills.read','PEOPLE','READ_SKILLS','Read skills','Read verified/self-declared skills within authorised scope.','STANDARD',false,false,true),
 ('people.skills.declare','PEOPLE','DECLARE_SKILL','Declare own skill','Create or update the actor''s own self-declared skill record.','STANDARD',false,false,true),
 ('people.skills.verify','PEOPLE','VERIFY_SKILL','Verify skills','Verify another person''s skill evidence within authorised scope.','SENSITIVE',false,true,true),
 ('people.training.read','PEOPLE','READ_TRAINING','Read training','Read assigned training and completion evidence within authorised scope.','STANDARD',false,false,true),
 ('people.training.manage','PEOPLE','MANAGE_TRAINING','Manage training catalog','Create and maintain controlled training requirements.','HIGH',true,true,true),
 ('people.training.assign','PEOPLE','ASSIGN_TRAINING','Assign training','Assign approved training to people in authorised scope.','SENSITIVE',false,true,true),
 ('people.performance.read','PEOPLE','READ_PERFORMANCE','Read performance cycle','Read performance records in authorised scope.','SENSITIVE',false,true,true),
 ('people.performance.manage','PEOPLE','MANAGE_PERFORMANCE','Manage performance cycle','Create performance reviews with an explicit human reviewer.','HIGH',true,true,true),
 ('people.performance.review','PEOPLE','REVIEW_PERFORMANCE','Review performance','Submit manager review and final human judgement; self-review is prohibited.','HIGH',true,true,true),
 ('people.workforce_plan.read','PEOPLE','READ_WORKFORCE_PLAN','Read workforce plan','Read department workforce and headcount plans.','SENSITIVE',false,true,true),
 ('people.workforce_plan.manage','PEOPLE','MANAGE_WORKFORCE_PLAN','Manage workforce plan','Create and submit department headcount plans.','HIGH',true,true,true),
 ('people.workforce_plan.review','PEOPLE','REVIEW_WORKFORCE_PLAN','Review workforce plan','Independently approve or reject submitted headcount plans.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'people.skills.read','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'people.skills.declare','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'people.training.read','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'people.performance.read','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','people.skills.read','ALLOW','COMPANY'),
 ('HR_MANAGER','people.skills.verify','ALLOW','COMPANY'),
 ('HR_MANAGER','people.training.read','ALLOW','COMPANY'),
 ('HR_MANAGER','people.training.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','people.training.assign','ALLOW','COMPANY'),
 ('HR_MANAGER','people.performance.read','ALLOW','COMPANY'),
 ('HR_MANAGER','people.performance.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','people.performance.review','ALLOW','COMPANY'),
 ('HR_MANAGER','people.workforce_plan.read','ALLOW','COMPANY'),
 ('HR_MANAGER','people.workforce_plan.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','people.workforce_plan.review','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','people.skills.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.skills.verify','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.training.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.training.assign','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.performance.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.performance.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.performance.review','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.workforce_plan.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','people.workforce_plan.manage','ALLOW','DEPARTMENT'),
 ('AUDITOR_READONLY','people.workforce_plan.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_training_seq;
create sequence if not exists public.office_performance_seq;
create sequence if not exists public.office_workforce_plan_seq;
grant usage,select on sequence public.office_training_seq,public.office_performance_seq,public.office_workforce_plan_seq to service_role;

create table if not exists public.office_person_skills(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 skill_name text not null check(char_length(trim(skill_name)) between 2 and 120),
 level text not null check(level in ('AWARENESS','FOUNDATIONAL','INTERMEDIATE','ADVANCED','EXPERT')),
 verification_status text not null default 'SELF_DECLARED' check(verification_status in ('SELF_DECLARED','VERIFIED','EXPIRED')),
 evidence_reference text,
 declared_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 verified_at timestamptz,
 last_validated_on date,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,skill_name)
);
create index if not exists office_person_skills_user_idx on public.office_person_skills(user_id,active,verification_status);

create table if not exists public.office_training_catalog(
 id uuid primary key default gen_random_uuid(),
 training_code text not null unique default ('KR-TRN-'||lpad(nextval('public.office_training_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 180),
 category text not null check(category in ('SECURITY','PRIVACY','COMPLIANCE','TECHNICAL','PRODUCT','LEADERSHIP','SAFETY','HR','OTHER')),
 description text not null,
 validity_months integer check(validity_months is null or validity_months between 1 and 120),
 evidence_required boolean not null default true,
 active boolean not null default true,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.office_training_assignments(
 id uuid primary key default gen_random_uuid(),
 training_id uuid not null references public.office_training_catalog(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 assigned_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 due_on date,
 status text not null default 'ASSIGNED' check(status in ('ASSIGNED','IN_PROGRESS','COMPLETED','WAIVED','EXPIRED')),
 completion_evidence_reference text,
 completed_at timestamptz,
 expires_on date,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(training_id,user_id,status) deferrable initially immediate
);
create index if not exists office_training_assignments_user_idx on public.office_training_assignments(user_id,status,due_on);

create table if not exists public.office_performance_reviews(
 id uuid primary key default gen_random_uuid(),
 review_code text not null unique default ('KR-PRF-'||lpad(nextval('public.office_performance_seq')::text,6,'0')),
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewer_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 period_start date not null,
 period_end date not null,
 goals jsonb not null default '[]'::jsonb,
 employee_summary text,
 reviewer_summary text,
 outcome text check(outcome is null or outcome in ('EXCEEDS_EXPECTATIONS','MEETS_EXPECTATIONS','DEVELOPMENT_REQUIRED','NOT_RATED')),
 development_plan text,
 status text not null default 'DRAFT' check(status in ('DRAFT','EMPLOYEE_INPUT','MANAGER_REVIEW','FINAL','CANCELLED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 finalized_by uuid references public.office_identity_users(user_id) on delete restrict,
 finalized_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(period_end>=period_start),
 check(user_id<>reviewer_user_id)
);
create index if not exists office_performance_reviews_user_idx on public.office_performance_reviews(user_id,period_end desc,status);
create index if not exists office_performance_reviews_reviewer_idx on public.office_performance_reviews(reviewer_user_id,status,period_end desc);

create table if not exists public.office_workforce_plans(
 id uuid primary key default gen_random_uuid(),
 plan_code text not null unique default ('KR-WFP-'||lpad(nextval('public.office_workforce_plan_seq')::text,6,'0')),
 department_code text not null,
 period_start date not null,
 period_end date not null,
 current_headcount integer not null check(current_headcount>=0),
 target_headcount integer not null check(target_headcount>=0),
 approved_headcount integer check(approved_headcount is null or approved_headcount>=0),
 rationale text not null,
 budget_reference text,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','CLOSED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(period_end>=period_start)
);
create index if not exists office_workforce_plans_department_idx on public.office_workforce_plans(department_code,period_end desc,status);

create table if not exists public.office_people_development_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 target_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 skill_id uuid references public.office_person_skills(id) on delete restrict,
 training_assignment_id uuid references public.office_training_assignments(id) on delete restrict,
 performance_review_id uuid references public.office_performance_reviews(id) on delete restrict,
 workforce_plan_id uuid references public.office_workforce_plans(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_person_skills enable row level security;
alter table public.office_training_catalog enable row level security;
alter table public.office_training_assignments enable row level security;
alter table public.office_performance_reviews enable row level security;
alter table public.office_workforce_plans enable row level security;
alter table public.office_people_development_events enable row level security;

revoke all on public.office_person_skills,public.office_training_catalog,public.office_training_assignments,public.office_performance_reviews,public.office_workforce_plans,public.office_people_development_events from public,anon,authenticated;
grant select,insert,update on public.office_person_skills,public.office_training_catalog,public.office_training_assignments,public.office_performance_reviews,public.office_workforce_plans to service_role;
grant select,insert on public.office_people_development_events to service_role;

create or replace function public.office_skill_declare(p_actor uuid,p_skill text,p_level text,p_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_level text:=upper(trim(p_level)); prior public.office_person_skills%rowtype;
begin
 if not public.office_effective_permission(p_actor,'people.skills.declare','OWN',p_actor::text,null) then raise exception 'Own skill declaration permission is required'; end if;
 if v_level not in ('AWARENESS','FOUNDATIONAL','INTERMEDIATE','ADVANCED','EXPERT') then raise exception 'Invalid skill level'; end if;
 select * into prior from public.office_person_skills where user_id=p_actor and lower(skill_name)=lower(trim(p_skill)) for update;
 if prior.id is null then
  insert into public.office_person_skills(user_id,skill_name,level,evidence_reference,declared_by)
  values(p_actor,trim(p_skill),v_level,nullif(trim(coalesce(p_evidence,'')),''),p_actor) returning id into v_id;
 else
  update public.office_person_skills set level=v_level,evidence_reference=nullif(trim(coalesce(p_evidence,'')),''),verification_status='SELF_DECLARED',verified_by=null,verified_at=null,last_validated_on=null,active=true,updated_at=now() where id=prior.id returning id into v_id;
 end if;
 insert into public.office_people_development_events(actor_user_id,target_user_id,skill_id,event_type,new_status,metadata)
 values(p_actor,p_actor,v_id,'SKILL_DECLARED','SELF_DECLARED',jsonb_build_object('level',v_level));
 return v_id;
end; $$;

create or replace function public.office_skill_verify(p_actor uuid,p_skill uuid,p_status text,p_evidence text)
returns text language plpgsql security definer set search_path='' as $$
declare s public.office_person_skills%rowtype; target text:=upper(trim(p_status)); dept text;
begin
 select * into s from public.office_person_skills where id=p_skill for update;
 if s.id is null then raise exception 'Skill record not found'; end if;
 select primary_department into dept from public.office_identity_users where user_id=s.user_id;
 if not public.office_effective_permission(p_actor,'people.skills.verify','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'people.skills.verify','DEPARTMENT',dept,null) then raise exception 'Skill verification permission is required'; end if;
 if p_actor=s.user_id then raise exception 'Self-verification is not allowed'; end if;
 if target not in ('VERIFIED','EXPIRED') then raise exception 'Invalid verification state'; end if;
 if target='VERIFIED' and nullif(trim(coalesce(p_evidence,s.evidence_reference,'')),'') is null then raise exception 'Verification evidence is required'; end if;
 update public.office_person_skills set verification_status=target,evidence_reference=coalesce(nullif(trim(coalesce(p_evidence,'')),''),evidence_reference),verified_by=p_actor,verified_at=now(),last_validated_on=current_date,updated_at=now() where id=s.id;
 insert into public.office_people_development_events(actor_user_id,target_user_id,skill_id,event_type,previous_status,new_status)
 values(p_actor,s.user_id,s.id,'SKILL_VERIFIED',s.verification_status,target);
 return target;
end; $$;

create or replace function public.office_training_create(p_actor uuid,p_title text,p_category text,p_description text,p_validity integer,p_evidence boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; cat text:=upper(trim(p_category));
begin
 if not public.office_effective_permission(p_actor,'people.training.manage','COMPANY',null,null) then raise exception 'Training catalog management permission is required'; end if;
 insert into public.office_training_catalog(title,category,description,validity_months,evidence_required,created_by)
 values(trim(p_title),cat,trim(p_description),p_validity,coalesce(p_evidence,true),p_actor) returning id into v_id;
 insert into public.office_people_development_events(actor_user_id,event_type,metadata) values(p_actor,'TRAINING_CREATED',jsonb_build_object('training_id',v_id,'category',cat));
 return v_id;
end; $$;

create or replace function public.office_training_assign(p_actor uuid,p_training uuid,p_user uuid,p_due date,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text;
begin
 select primary_department into dept from public.office_identity_users where user_id=p_user and status='ACTIVE';
 if dept is null and not exists(select 1 from public.office_identity_users where user_id=p_user and status='ACTIVE') then raise exception 'Active person is required'; end if;
 if not public.office_effective_permission(p_actor,'people.training.assign','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'people.training.assign','DEPARTMENT',dept,null) then raise exception 'Training assignment permission is required'; end if;
 if not exists(select 1 from public.office_training_catalog where id=p_training and active=true) then raise exception 'Active training is required'; end if;
 insert into public.office_training_assignments(training_id,user_id,assigned_by,due_on,note)
 values(p_training,p_user,p_actor,p_due,nullif(trim(coalesce(p_note,'')),'')) returning id into v_id;
 insert into public.office_people_development_events(actor_user_id,target_user_id,training_assignment_id,event_type,new_status)
 values(p_actor,p_user,v_id,'TRAINING_ASSIGNED','ASSIGNED');
 return v_id;
end; $$;

create or replace function public.office_training_transition(p_actor uuid,p_assignment uuid,p_status text,p_evidence text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_training_assignments%rowtype; t public.office_training_catalog%rowtype; target text:=upper(trim(p_status)); dept text;
begin
 select * into a from public.office_training_assignments where id=p_assignment for update;
 if a.id is null then raise exception 'Training assignment not found'; end if;
 select * into t from public.office_training_catalog where id=a.training_id;
 select primary_department into dept from public.office_identity_users where user_id=a.user_id;
 if p_actor<>a.user_id
    and not public.office_effective_permission(p_actor,'people.training.assign','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'people.training.assign','DEPARTMENT',dept,null) then raise exception 'Training ownership or assignment permission is required'; end if;
 if target not in ('IN_PROGRESS','COMPLETED','WAIVED','EXPIRED') then raise exception 'Invalid training transition'; end if;
 if target in ('WAIVED','EXPIRED') and p_actor=a.user_id then raise exception 'Employee cannot waive or expire their own assigned training'; end if;
 if target='COMPLETED' and t.evidence_required and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Completion evidence is required'; end if;
 update public.office_training_assignments set status=target,completion_evidence_reference=case when target='COMPLETED' then nullif(trim(coalesce(p_evidence,'')),'') else completion_evidence_reference end,completed_at=case when target='COMPLETED' then now() else completed_at end,expires_on=case when target='COMPLETED' and t.validity_months is not null then current_date+(t.validity_months||' months')::interval else expires_on end,note=coalesce(nullif(trim(coalesce(p_note,'')),''),note),updated_at=now() where id=a.id;
 insert into public.office_people_development_events(actor_user_id,target_user_id,training_assignment_id,event_type,previous_status,new_status)
 values(p_actor,a.user_id,a.id,'TRAINING_UPDATED',a.status,target);
 return target;
end; $$;

create or replace function public.office_performance_create(p_actor uuid,p_user uuid,p_reviewer uuid,p_start date,p_end date,p_goals jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text;
begin
 select primary_department into dept from public.office_identity_users where user_id=p_user and status='ACTIVE';
 if p_user=p_reviewer then raise exception 'Performance reviewer cannot be the review subject'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_reviewer and status='ACTIVE') then raise exception 'Active reviewer is required'; end if;
 if not public.office_effective_permission(p_actor,'people.performance.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'people.performance.manage','DEPARTMENT',dept,null) then raise exception 'Performance management permission is required'; end if;
 insert into public.office_performance_reviews(user_id,reviewer_user_id,department_code,period_start,period_end,goals,created_by)
 values(p_user,p_reviewer,dept,p_start,p_end,coalesce(p_goals,'[]'::jsonb),p_actor) returning id into v_id;
 insert into public.office_people_development_events(actor_user_id,target_user_id,performance_review_id,event_type,new_status)
 values(p_actor,p_user,v_id,'PERFORMANCE_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_performance_transition(p_actor uuid,p_review uuid,p_status text,p_employee_summary text,p_reviewer_summary text,p_outcome text,p_development text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_performance_reviews%rowtype; target text:=upper(trim(p_status)); can_review boolean;
begin
 select * into r from public.office_performance_reviews where id=p_review for update;
 if r.id is null then raise exception 'Performance review not found'; end if;
 can_review:=public.office_effective_permission(p_actor,'people.performance.review','COMPANY',null,null)
   or public.office_effective_permission(p_actor,'people.performance.review','DEPARTMENT',r.department_code,null);
 if target='EMPLOYEE_INPUT' then
  if p_actor<>r.user_id then raise exception 'Only the review subject can submit employee input'; end if;
  if nullif(trim(coalesce(p_employee_summary,'')),'') is null then raise exception 'Employee summary is required'; end if;
 elsif target in ('MANAGER_REVIEW','FINAL') then
  if p_actor<>r.reviewer_user_id or not can_review then raise exception 'Assigned human reviewer authority is required'; end if;
  if p_actor=r.user_id then raise exception 'Self-review is not allowed'; end if;
  if target='FINAL' and (nullif(trim(coalesce(p_reviewer_summary,r.reviewer_summary,'')),'') is null or nullif(trim(coalesce(p_outcome,r.outcome,'')),'') is null) then raise exception 'Reviewer summary and human outcome are required'; end if;
 else
  raise exception 'Invalid performance transition';
 end if;
 update public.office_performance_reviews set status=target,
  employee_summary=case when target='EMPLOYEE_INPUT' then trim(p_employee_summary) else employee_summary end,
  reviewer_summary=case when target in ('MANAGER_REVIEW','FINAL') then coalesce(nullif(trim(coalesce(p_reviewer_summary,'')),''),reviewer_summary) else reviewer_summary end,
  outcome=case when target='FINAL' then upper(trim(p_outcome)) else outcome end,
  development_plan=case when target in ('MANAGER_REVIEW','FINAL') then coalesce(nullif(trim(coalesce(p_development,'')),''),development_plan) else development_plan end,
  finalized_by=case when target='FINAL' then p_actor else finalized_by end,finalized_at=case when target='FINAL' then now() else finalized_at end,updated_at=now()
 where id=r.id;
 insert into public.office_people_development_events(actor_user_id,target_user_id,performance_review_id,event_type,previous_status,new_status)
 values(p_actor,r.user_id,r.id,'PERFORMANCE_UPDATED',r.status,target);
 return target;
end; $$;

create or replace function public.office_workforce_plan_create(p_actor uuid,p_department text,p_start date,p_end date,p_current integer,p_target integer,p_rationale text,p_budget text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text:=upper(trim(p_department));
begin
 if not public.office_effective_permission(p_actor,'people.workforce_plan.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'people.workforce_plan.manage','DEPARTMENT',dept,null) then raise exception 'Workforce planning permission is required'; end if;
 insert into public.office_workforce_plans(department_code,period_start,period_end,current_headcount,target_headcount,rationale,budget_reference,created_by)
 values(dept,p_start,p_end,p_current,p_target,trim(p_rationale),nullif(trim(coalesce(p_budget,'')),''),p_actor) returning id into v_id;
 insert into public.office_people_development_events(actor_user_id,workforce_plan_id,event_type,new_status) values(p_actor,v_id,'WORKFORCE_PLAN_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_workforce_plan_transition(p_actor uuid,p_plan uuid,p_status text,p_approved integer,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare w public.office_workforce_plans%rowtype; target text:=upper(trim(p_status)); can_manage boolean; can_review boolean;
begin
 select * into w from public.office_workforce_plans where id=p_plan for update;
 if w.id is null then raise exception 'Workforce plan not found'; end if;
 can_manage:=public.office_effective_permission(p_actor,'people.workforce_plan.manage','COMPANY',null,null)
   or public.office_effective_permission(p_actor,'people.workforce_plan.manage','DEPARTMENT',w.department_code,null);
 can_review:=public.office_effective_permission(p_actor,'people.workforce_plan.review','COMPANY',null,null)
   or public.office_effective_permission(p_actor,'people.workforce_plan.review','DEPARTMENT',w.department_code,null);
 if target='SUBMITTED' then
  if not can_manage then raise exception 'Workforce plan management permission is required'; end if;
  if w.status<>'DRAFT' then raise exception 'Only draft plan can be submitted'; end if;
 elsif target in ('APPROVED','REJECTED') then
  if not can_review then raise exception 'Independent workforce plan review permission is required'; end if;
  if p_actor=w.created_by then raise exception 'Workforce plan creator cannot approve their own plan'; end if;
  if w.status<>'SUBMITTED' then raise exception 'Submitted plan is required'; end if;
  if target='APPROVED' and p_approved is null then raise exception 'Approved headcount is required'; end if;
 elsif target='CLOSED' then
  if not can_review or w.status<>'APPROVED' then raise exception 'Approved plan and review authority are required'; end if;
 else raise exception 'Invalid workforce plan transition';
 end if;
 update public.office_workforce_plans set status=target,approved_headcount=case when target='APPROVED' then p_approved else approved_headcount end,reviewed_by=case when target in ('APPROVED','REJECTED','CLOSED') then p_actor else reviewed_by end,reviewed_at=case when target in ('APPROVED','REJECTED','CLOSED') then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=w.id;
 insert into public.office_people_development_events(actor_user_id,workforce_plan_id,event_type,previous_status,new_status,note) values(p_actor,w.id,'WORKFORCE_PLAN_UPDATED',w.status,target,left(p_note,2000));
 return target;
end; $$;

revoke all on function public.office_skill_declare(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_skill_verify(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_training_create(uuid,text,text,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.office_training_assign(uuid,uuid,uuid,date,text) from public,anon,authenticated;
revoke all on function public.office_training_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_performance_create(uuid,uuid,uuid,date,date,jsonb) from public,anon,authenticated;
revoke all on function public.office_performance_transition(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_workforce_plan_create(uuid,text,date,date,integer,integer,text,text) from public,anon,authenticated;
revoke all on function public.office_workforce_plan_transition(uuid,uuid,text,integer,text) from public,anon,authenticated;

grant execute on function public.office_skill_declare(uuid,text,text,text) to service_role;
grant execute on function public.office_skill_verify(uuid,uuid,text,text) to service_role;
grant execute on function public.office_training_create(uuid,text,text,text,integer,boolean) to service_role;
grant execute on function public.office_training_assign(uuid,uuid,uuid,date,text) to service_role;
grant execute on function public.office_training_transition(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_performance_create(uuid,uuid,uuid,date,date,jsonb) to service_role;
grant execute on function public.office_performance_transition(uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.office_workforce_plan_create(uuid,text,date,date,integer,integer,text,text) to service_role;
grant execute on function public.office_workforce_plan_transition(uuid,uuid,text,integer,text) to service_role;
