-- KRAVIA Office OS — project and portfolio management.
-- Project health is explicitly reported by accountable humans; task activity is not converted into an automatic project/performance score.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('portfolio.read','PORTFOLIO','READ','Read portfolio','Read projects, workstreams, milestones and dependencies in authorised scope.','STANDARD',false,false,true),
 ('portfolio.manage','PORTFOLIO','MANAGE','Manage portfolio','Create and operate department projects without independently approving own project.','HIGH',true,true,true),
 ('portfolio.review','PORTFOLIO','REVIEW','Review portfolio','Independently approve/reject/complete governed projects.','HIGH',true,true,true),
 ('portfolio.milestone.manage','PORTFOLIO','MANAGE_MILESTONE','Manage milestones','Create and update workstreams, milestones and dependencies in authorised projects.','HIGH',true,true,true),
 ('portfolio.team.manage','PORTFOLIO','MANAGE_TEAM','Manage project team','Assign project membership metadata without granting authorization capabilities.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('PRODUCT_MANAGER','portfolio.read','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','portfolio.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','portfolio.review','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','portfolio.milestone.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','portfolio.team.manage','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','portfolio.read','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','portfolio.manage','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','portfolio.review','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','portfolio.milestone.manage','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','portfolio.team.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','portfolio.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','portfolio.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','portfolio.review','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','portfolio.milestone.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','portfolio.team.manage','ALLOW','DEPARTMENT'),
 ('FINANCE_MANAGER','portfolio.read','ALLOW','COMPANY'),
 ('RISK_MANAGER','portfolio.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','portfolio.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_portfolio_project_seq;
create sequence if not exists public.office_portfolio_workstream_seq;
create sequence if not exists public.office_portfolio_milestone_seq;
grant usage,select on sequence public.office_portfolio_project_seq,public.office_portfolio_workstream_seq,public.office_portfolio_milestone_seq to service_role;

create table if not exists public.office_portfolio_projects(
 id uuid primary key default gen_random_uuid(),
 project_code text not null unique default ('KR-PRJ-'||lpad(nextval('public.office_portfolio_project_seq')::text,6,'0')),
 program_name text,
 title text not null check(char_length(trim(title)) between 3 and 220),
 description text not null check(char_length(trim(description)) between 3 and 12000),
 department_code text not null,
 product_id varchar,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 sponsor_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 priority text not null default 'MEDIUM' check(priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
 starts_on date,
 target_end_on date,
 budget_reference text,
 reported_health text not null default 'UNKNOWN' check(reported_health in ('UNKNOWN','ON_TRACK','AT_RISK','OFF_TRACK')),
 health_note text,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','ACTIVE','PAUSED','REJECTED','COMPLETED','CANCELLED')),
 completion_evidence_reference text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(target_end_on is null or starts_on is null or target_end_on>=starts_on)
);
create index if not exists office_portfolio_projects_department_idx on public.office_portfolio_projects(department_code,status,target_end_on);
create index if not exists office_portfolio_projects_owner_idx on public.office_portfolio_projects(owner_user_id,status,target_end_on);

create table if not exists public.office_portfolio_workstreams(
 id uuid primary key default gen_random_uuid(),
 workstream_code text not null unique default ('KR-WS-'||lpad(nextval('public.office_portfolio_workstream_seq')::text,7,'0')),
 project_id uuid not null references public.office_portfolio_projects(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 2 and 180),
 description text,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 starts_on date,
 target_end_on date,
 status text not null default 'PLANNED' check(status in ('PLANNED','ACTIVE','PAUSED','DONE','CANCELLED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(target_end_on is null or starts_on is null or target_end_on>=starts_on)
);
create index if not exists office_portfolio_workstreams_project_idx on public.office_portfolio_workstreams(project_id,status,target_end_on);

create table if not exists public.office_portfolio_milestones(
 id uuid primary key default gen_random_uuid(),
 milestone_code text not null unique default ('KR-MIL-'||lpad(nextval('public.office_portfolio_milestone_seq')::text,7,'0')),
 project_id uuid not null references public.office_portfolio_projects(id) on delete restrict,
 workstream_id uuid references public.office_portfolio_workstreams(id) on delete restrict,
 title text not null check(char_length(trim(title)) between 2 and 220),
 description text,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 due_on date,
 status text not null default 'PLANNED' check(status in ('PLANNED','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
 blocked_reason text,
 deliverable_reference text,
 completion_evidence_reference text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_portfolio_milestones_project_idx on public.office_portfolio_milestones(project_id,status,due_on);
create index if not exists office_portfolio_milestones_owner_idx on public.office_portfolio_milestones(owner_user_id,status,due_on);

create table if not exists public.office_portfolio_dependencies(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.office_portfolio_projects(id) on delete restrict,
 predecessor_milestone_id uuid not null references public.office_portfolio_milestones(id) on delete restrict,
 successor_milestone_id uuid not null references public.office_portfolio_milestones(id) on delete restrict,
 note text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(predecessor_milestone_id,successor_milestone_id),
 check(predecessor_milestone_id<>successor_milestone_id)
);
create index if not exists office_portfolio_dependencies_project_idx on public.office_portfolio_dependencies(project_id);

create table if not exists public.office_portfolio_members(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.office_portfolio_projects(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 project_role text not null check(char_length(trim(project_role)) between 2 and 120),
 workstream_id uuid references public.office_portfolio_workstreams(id) on delete restrict,
 active boolean not null default true,
 assigned_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(project_id,user_id,project_role)
);

create table if not exists public.office_portfolio_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 project_id uuid not null references public.office_portfolio_projects(id) on delete restrict,
 workstream_id uuid references public.office_portfolio_workstreams(id) on delete restrict,
 milestone_id uuid references public.office_portfolio_milestones(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_portfolio_projects enable row level security;
alter table public.office_portfolio_workstreams enable row level security;
alter table public.office_portfolio_milestones enable row level security;
alter table public.office_portfolio_dependencies enable row level security;
alter table public.office_portfolio_members enable row level security;
alter table public.office_portfolio_events enable row level security;
revoke all on public.office_portfolio_projects,public.office_portfolio_workstreams,public.office_portfolio_milestones,public.office_portfolio_dependencies,public.office_portfolio_members,public.office_portfolio_events from public,anon,authenticated;
grant select,insert,update on public.office_portfolio_projects,public.office_portfolio_workstreams,public.office_portfolio_milestones,public.office_portfolio_members to service_role;
grant select,insert on public.office_portfolio_dependencies,public.office_portfolio_events to service_role;

create or replace function public.office_portfolio_project_create(
 p_actor uuid,p_program text,p_title text,p_description text,p_department text,p_product varchar,p_owner uuid,p_sponsor uuid,p_priority text,p_start date,p_target date,p_budget text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text:=upper(trim(p_department));
begin
 if not public.office_effective_permission(p_actor,'portfolio.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.manage','DEPARTMENT',dept,null) then raise exception 'Portfolio management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active project owner is required'; end if;
 if p_sponsor is not null and not exists(select 1 from public.office_identity_users where user_id=p_sponsor and status='ACTIVE') then raise exception 'Active project sponsor is required'; end if;
 insert into public.office_portfolio_projects(program_name,title,description,department_code,product_id,owner_user_id,sponsor_user_id,priority,starts_on,target_end_on,budget_reference,created_by)
 values(nullif(trim(coalesce(p_program,'')),''),trim(p_title),trim(p_description),dept,p_product,p_owner,p_sponsor,upper(trim(p_priority)),p_start,p_target,nullif(trim(coalesce(p_budget,'')),''),p_actor)
 returning id into v_id;
 insert into public.office_portfolio_events(actor_user_id,project_id,event_type,new_status) values(p_actor,v_id,'PROJECT_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_portfolio_project_transition(
 p_actor uuid,p_project uuid,p_status text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into p from public.office_portfolio_projects where id=p_project for update;
 if p.id is null then raise exception 'Project not found'; end if;
 review:=target in ('APPROVED','REJECTED','COMPLETED','CANCELLED');
 if review then
  if not public.office_effective_permission(p_actor,'portfolio.review','COMPANY',null,null)
     and not public.office_effective_permission(p_actor,'portfolio.review','DEPARTMENT',p.department_code,null) then raise exception 'Independent portfolio review permission is required'; end if;
  if p_actor=p.owner_user_id or p_actor=p.created_by then raise exception 'Project owner/creator cannot independently review the same project'; end if;
 else
  if not public.office_effective_permission(p_actor,'portfolio.manage','COMPANY',null,null)
     and not public.office_effective_permission(p_actor,'portfolio.manage','DEPARTMENT',p.department_code,null)
     and p_actor<>p.owner_user_id then raise exception 'Portfolio management permission is required'; end if;
 end if;
 if p.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft project must be submitted first'; end if;
 if p.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted project must be approved or rejected'; end if;
 if p.status='APPROVED' and target not in ('ACTIVE','CANCELLED') then raise exception 'Approved project must become active or be cancelled'; end if;
 if p.status='ACTIVE' and target not in ('PAUSED','COMPLETED','CANCELLED') then raise exception 'Active project may be paused, completed or cancelled'; end if;
 if p.status='PAUSED' and target not in ('ACTIVE','CANCELLED') then raise exception 'Paused project may resume or be cancelled'; end if;
 if p.status in ('REJECTED','COMPLETED','CANCELLED') then raise exception 'Finalized project cannot be transitioned'; end if;
 if target='COMPLETED' then
  if exists(select 1 from public.office_portfolio_milestones where project_id=p.id and status not in ('DONE','CANCELLED')) then raise exception 'All open milestones must be completed or cancelled before project completion'; end if;
  if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Project completion evidence is required'; end if;
 end if;
 update public.office_portfolio_projects set status=target,completion_evidence_reference=case when target='COMPLETED' then trim(p_evidence) else completion_evidence_reference end,reviewed_by=case when review then p_actor else reviewed_by end,reviewed_at=case when review then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=p.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,event_type,previous_status,new_status,note) values(p_actor,p.id,'PROJECT_TRANSITION',p.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_portfolio_project_health(
 p_actor uuid,p_project uuid,p_health text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; health text:=upper(trim(p_health));
begin
 select * into p from public.office_portfolio_projects where id=p_project for update;
 if p.id is null then raise exception 'Project not found'; end if;
 if not public.office_effective_permission(p_actor,'portfolio.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.manage','DEPARTMENT',p.department_code,null)
    and p_actor<>p.owner_user_id then raise exception 'Project health update permission is required'; end if;
 if health not in ('UNKNOWN','ON_TRACK','AT_RISK','OFF_TRACK') then raise exception 'Invalid project health'; end if;
 if health in ('AT_RISK','OFF_TRACK') and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Health note is required for at-risk/off-track status'; end if;
 update public.office_portfolio_projects set reported_health=health,health_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=p.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,event_type,note,metadata) values(p_actor,p.id,'PROJECT_HEALTH_REPORTED',left(p_note,2000),jsonb_build_object('health',health));
 return health;
end; $$;

create or replace function public.office_portfolio_workstream_create(
 p_actor uuid,p_project uuid,p_title text,p_description text,p_owner uuid,p_start date,p_target date
) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; v_id uuid;
begin
 select * into p from public.office_portfolio_projects where id=p_project;
 if p.id is null or p.status in ('REJECTED','COMPLETED','CANCELLED') then raise exception 'Open project is required'; end if;
 if not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then raise exception 'Workstream management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active workstream owner is required'; end if;
 insert into public.office_portfolio_workstreams(project_id,title,description,owner_user_id,starts_on,target_end_on,created_by)
 values(p.id,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_owner,p_start,p_target,p_actor) returning id into v_id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,event_type,new_status) values(p_actor,p.id,v_id,'WORKSTREAM_CREATED','PLANNED');
 return v_id;
end; $$;

create or replace function public.office_portfolio_milestone_create(
 p_actor uuid,p_project uuid,p_workstream uuid,p_title text,p_description text,p_owner uuid,p_due date,p_deliverable text
) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; v_id uuid;
begin
 select * into p from public.office_portfolio_projects where id=p_project;
 if p.id is null or p.status in ('REJECTED','COMPLETED','CANCELLED') then raise exception 'Open project is required'; end if;
 if not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then raise exception 'Milestone management permission is required'; end if;
 if p_workstream is not null and not exists(select 1 from public.office_portfolio_workstreams where id=p_workstream and project_id=p.id and status<>'CANCELLED') then raise exception 'Project workstream not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active milestone owner is required'; end if;
 insert into public.office_portfolio_milestones(project_id,workstream_id,title,description,owner_user_id,due_on,deliverable_reference,created_by)
 values(p.id,p_workstream,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_owner,p_due,nullif(trim(coalesce(p_deliverable,'')),''),p_actor) returning id into v_id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,milestone_id,event_type,new_status) values(p_actor,p.id,p_workstream,v_id,'MILESTONE_CREATED','PLANNED');
 return v_id;
end; $$;

create or replace function public.office_portfolio_dependency_create(
 p_actor uuid,p_project uuid,p_predecessor uuid,p_successor uuid,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; v_id uuid;
begin
 select * into p from public.office_portfolio_projects where id=p_project;
 if p.id is null then raise exception 'Project not found'; end if;
 if not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then raise exception 'Milestone management permission is required'; end if;
 if p_predecessor=p_successor then raise exception 'Milestone cannot depend on itself'; end if;
 if not exists(select 1 from public.office_portfolio_milestones where id=p_predecessor and project_id=p.id)
    or not exists(select 1 from public.office_portfolio_milestones where id=p_successor and project_id=p.id) then raise exception 'Both milestones must belong to the project'; end if;
 insert into public.office_portfolio_dependencies(project_id,predecessor_milestone_id,successor_milestone_id,note,created_by)
 values(p.id,p_predecessor,p_successor,nullif(trim(coalesce(p_note,'')),''),p_actor) returning id into v_id;
 insert into public.office_portfolio_events(actor_user_id,project_id,milestone_id,event_type,metadata) values(p_actor,p.id,p_successor,'MILESTONE_DEPENDENCY_CREATED',jsonb_build_object('predecessor_milestone_id',p_predecessor));
 return v_id;
end; $$;

create or replace function public.office_portfolio_milestone_transition(
 p_actor uuid,p_milestone uuid,p_status text,p_blocked_reason text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare m public.office_portfolio_milestones%rowtype; p public.office_portfolio_projects%rowtype; target text:=upper(trim(p_status));
begin
 select * into m from public.office_portfolio_milestones where id=p_milestone for update;
 if m.id is null then raise exception 'Milestone not found'; end if;
 select * into p from public.office_portfolio_projects where id=m.project_id;
 if p_actor<>m.owner_user_id
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then raise exception 'Milestone ownership or management permission is required'; end if;
 if target='IN_PROGRESS' and exists(
   select 1 from public.office_portfolio_dependencies d
   join public.office_portfolio_milestones predecessor on predecessor.id=d.predecessor_milestone_id
   where d.successor_milestone_id=m.id and predecessor.status<>'DONE'
 ) then raise exception 'Milestone dependencies must be completed before work starts'; end if;
 if target='BLOCKED' and nullif(trim(coalesce(p_blocked_reason,'')),'') is null then raise exception 'Blocked reason is required'; end if;
 if target='DONE' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Milestone completion evidence is required'; end if;
 if target not in ('PLANNED','IN_PROGRESS','BLOCKED','DONE','CANCELLED') then raise exception 'Invalid milestone status'; end if;
 if m.status in ('DONE','CANCELLED') then raise exception 'Finalized milestone cannot be transitioned'; end if;
 update public.office_portfolio_milestones set status=target,blocked_reason=case when target='BLOCKED' then trim(p_blocked_reason) else null end,completion_evidence_reference=case when target='DONE' then trim(p_evidence) else completion_evidence_reference end,completed_at=case when target='DONE' then now() else null end,updated_at=now() where id=m.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,milestone_id,event_type,previous_status,new_status,note) values(p_actor,m.project_id,m.workstream_id,m.id,'MILESTONE_TRANSITION',m.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_portfolio_member_assign(
 p_actor uuid,p_project uuid,p_user uuid,p_role text,p_workstream uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; v_id uuid;
begin
 select * into p from public.office_portfolio_projects where id=p_project;
 if p.id is null then raise exception 'Project not found'; end if;
 if not public.office_effective_permission(p_actor,'portfolio.team.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.team.manage','DEPARTMENT',p.department_code,null) then raise exception 'Project team management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_user and status='ACTIVE') then raise exception 'Active project member is required'; end if;
 if p_workstream is not null and not exists(select 1 from public.office_portfolio_workstreams where id=p_workstream and project_id=p.id) then raise exception 'Project workstream not found'; end if;
 insert into public.office_portfolio_members(project_id,user_id,project_role,workstream_id,assigned_by)
 values(p.id,p_user,trim(p_role),p_workstream,p_actor)
 on conflict(project_id,user_id,project_role) do update set workstream_id=excluded.workstream_id,active=true,assigned_by=excluded.assigned_by,updated_at=now()
 returning id into v_id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,event_type,metadata) values(p_actor,p.id,p_workstream,'PROJECT_MEMBER_ASSIGNED',jsonb_build_object('user_id',p_user,'project_role',trim(p_role)));
 return v_id;
end; $$;

revoke all on function public.office_portfolio_project_create(uuid,text,text,text,text,varchar,uuid,uuid,text,date,date,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_project_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_project_health(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_workstream_create(uuid,uuid,text,text,uuid,date,date) from public,anon,authenticated;
revoke all on function public.office_portfolio_milestone_create(uuid,uuid,uuid,text,text,uuid,date,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_dependency_create(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_milestone_transition(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_member_assign(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;

grant execute on function public.office_portfolio_project_create(uuid,text,text,text,text,varchar,uuid,uuid,text,date,date,text) to service_role;
grant execute on function public.office_portfolio_project_transition(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_portfolio_project_health(uuid,uuid,text,text) to service_role;
grant execute on function public.office_portfolio_workstream_create(uuid,uuid,text,text,uuid,date,date) to service_role;
grant execute on function public.office_portfolio_milestone_create(uuid,uuid,uuid,text,text,uuid,date,text) to service_role;
grant execute on function public.office_portfolio_dependency_create(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.office_portfolio_milestone_transition(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_portfolio_member_assign(uuid,uuid,uuid,text,uuid) to service_role;
