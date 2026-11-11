-- Reusable KRAVIA Office role packages: compose EXISTING canonical position,
-- department, access-profile, recruitment/onboarding and payroll capabilities.
-- No templates, people, salaries, bank details or role assignments are seeded.
-- An active package is a versioned prescription, NOT an automatic permission.
-- Applying one calls existing governed Office job/profile RPCs atomically.

create table if not exists public.office_role_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{2,59}$'),
  version integer not null check (version between 1 and 1000000),
  label text not null check (length(btrim(label)) between 3 and 140),
  description text not null default '',
  department_code text not null references public.office_department_catalog(code),
  primary_position_code text not null references public.office_position_catalog(code),
  employment_type text not null default 'EMPLOYEE'
    check (employment_type in ('EMPLOYEE','CONTRACTOR','INTERN','TRAINEE','ADVISOR','PROFESSIONAL')),
  responsibilities jsonb not null default '[]'::jsonb check (jsonb_typeof(responsibilities)='array'),
  additional_roles jsonb not null default '[]'::jsonb check (jsonb_typeof(additional_roles)='array'),
  access_profiles jsonb not null default '[]'::jsonb check (jsonb_typeof(access_profiles)='array'),
  onboarding_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(onboarding_steps)='array'),
  work_pattern jsonb not null default '{"days":["MON","TUE","WED","THU","FRI"],"daily_minutes":360,"weekly_minutes":1800,"flexible":true,"time_zone":"Asia/Kolkata"}'::jsonb check (jsonb_typeof(work_pattern)='object'),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','RETIRED')),
  created_by uuid not null references public.office_identity_users(user_id),
  published_by uuid references public.office_identity_users(user_id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(code,version),
  constraint published_role_package_has_actor check (status<>'ACTIVE' or (published_by is not null and published_at is not null))
);
create unique index if not exists office_role_packages_one_active_version
  on public.office_role_packages(code) where status='ACTIVE';

create table if not exists public.office_employee_role_package_applications (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.office_role_packages(id),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  applied_by uuid not null references public.office_identity_users(user_id),
  applied_at timestamptz not null default now(),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  snapshot_sha256 text not null check (length(snapshot_sha256)=64),
  reason text not null check (length(btrim(reason)) between 12 and 500),
  unique(package_id,employee_user_id)
);
create index if not exists office_role_package_employee_history
  on public.office_employee_role_package_applications(employee_user_id,applied_at desc);

-- Additional functional duties are distinct from the ONE canonical primary job.
-- A functional designation does NOT transfer department ownership and does NOT
-- by itself grant capabilities.
create table if not exists public.office_employee_functional_positions (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  position_code text not null references public.office_position_catalog(code),
  department_code text not null references public.office_department_catalog(code),
  application_id uuid not null references public.office_employee_role_package_applications(id),
  responsibilities jsonb not null default '[]'::jsonb check (jsonb_typeof(responsibilities)='array'),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(employee_user_id,position_code,department_code)
);
create index if not exists office_functional_positions_department
  on public.office_employee_functional_positions(department_code,active);

create table if not exists public.office_role_package_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.office_employee_role_package_applications(id),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  task_code text not null check (task_code ~ '^[A-Z][A-Z0-9_]{2,59}$'),
  label text not null check (length(btrim(label)) between 3 and 180),
  required boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING','SUBMITTED','VERIFIED','WAIVED')),
  evidence_reference text,
  submitted_by uuid references public.office_identity_users(user_id),
  submitted_at timestamptz,
  reviewed_by uuid references public.office_identity_users(user_id),
  reviewed_at timestamptz,
  review_note text,
  unique(application_id,task_code),
  constraint required_onboarding_never_waived check (required=false or status<>'WAIVED'),
  constraint onboarding_verified_evidence check (status<>'VERIFIED' or
    (evidence_reference is not null and reviewed_by is not null and reviewed_at is not null
     and reviewed_by<>employee_user_id and reviewed_by is distinct from submitted_by))
);

create table if not exists public.office_role_package_events (
  id bigint generated always as identity primary key,
  package_id uuid references public.office_role_packages(id),
  application_id uuid references public.office_employee_role_package_applications(id),
  task_id uuid references public.office_role_package_onboarding_tasks(id),
  actor_user_id uuid not null references public.office_identity_users(user_id),
  target_user_id uuid references public.office_identity_users(user_id),
  event_type text not null check (event_type in (
     'PACKAGE_CREATED','PACKAGE_PUBLISHED','PACKAGE_RETIRED',
     'PACKAGE_APPLIED','TASK_SUBMITTED','TASK_VERIFIED','TASK_RETURNED','TASK_WAIVED')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.office_role_packages enable row level security;
alter table public.office_employee_role_package_applications enable row level security;
alter table public.office_employee_functional_positions enable row level security;
alter table public.office_role_package_onboarding_tasks enable row level security;
alter table public.office_role_package_events enable row level security;

revoke all on public.office_role_packages,public.office_employee_role_package_applications,
 public.office_employee_functional_positions,public.office_role_package_onboarding_tasks,
 public.office_role_package_events from public,anon,authenticated;
grant select,insert,update on public.office_role_packages,public.office_employee_functional_positions,
 public.office_role_package_onboarding_tasks to service_role;
grant select,insert on public.office_employee_role_package_applications,public.office_role_package_events
 to service_role;
grant usage,select on sequence public.office_role_package_events_id_seq to service_role;

-- Guard against direct update/delete of versioned applied evidence.
create or replace function public.office_role_package_protect_evidence()
returns trigger language plpgsql security definer set search_path='' as $func$
begin
  raise exception 'Applied role-package evidence is immutable; create a new version';
end; $func$;
drop trigger if exists office_applied_role_package_sealed on public.office_employee_role_package_applications;
create trigger office_applied_role_package_sealed
 before update or delete on public.office_employee_role_package_applications
 for each row execute function public.office_role_package_protect_evidence();

-- Existing corporate access delegation stays with OWNER/ADMIN. A former owner
-- of an explicitly transferred department cannot use the generic package
-- composer to silently recover authority.
create or replace function public.office_role_package_authorised(
  p_actor uuid,p_department text
) returns boolean language plpgsql stable security definer set search_path='' as $func$
declare current_owner uuid; founder boolean;
begin
  if not exists(select 1 from public.office_identity_users
    where user_id=p_actor and status='ACTIVE') then return false; end if;
  select exists(select 1 from public.office_user_roles
    where user_id=p_actor and role='OWNER'
      and (expires_at is null or expires_at>now())) into founder;
  select owner_user_id into current_owner from public.office_department_ownership
    where department_code=p_department;
  -- Transfer is an explicit permanent management delegation: the accepted
  -- department head controls only that department, even with MEMBER base role.
  if current_owner is not null then return current_owner=p_actor; end if;
  -- Before a transfer, all unowned departments remain Founder-managed.
  if not founder then return false; end if;
  return public.office_effective_permission(p_actor,'access.profile.assign','COMPANY',null,null);
end; $func$;

create or replace function public.office_role_package_create(
  p_actor uuid,p_code text,p_label text,p_description text,
  p_department text,p_position text,p_employment text,
  p_responsibilities jsonb,p_additional_roles jsonb,p_profiles jsonb,
  p_steps jsonb,p_work_pattern jsonb
) returns uuid language plpgsql security definer set search_path='' as $func$
declare new_id uuid; next_version integer; item jsonb; rec record;
  parsed_code text:=upper(btrim(coalesce(p_code,'')));
begin
  if not public.office_role_package_authorised(p_actor,p_department) then
    raise exception 'Current Founder or authorised department administrator required'; end if;
  if parsed_code !~ '^[A-Z][A-Z0-9_]{2,59}$' then raise exception 'Invalid reusable package code'; end if;
  if length(btrim(coalesce(p_label,''))) not between 3 and 140 then raise exception 'Invalid title'; end if;
  if not exists(select 1 from public.office_position_catalog where code=p_position and active=true)
     then raise exception 'Active canonical primary position required'; end if;
  if exists(select 1 from public.office_position_catalog where code=p_position
    and (family='EXECUTIVE' or level>=8))
    and not exists(select 1 from public.office_user_roles where user_id=p_actor
      and role='OWNER' and (expires_at is null or expires_at>now())) then
    raise exception 'Executive and department-head positions require Founder authority'; end if;
  if p_employment not in ('EMPLOYEE','CONTRACTOR','INTERN','TRAINEE','ADVISOR','PROFESSIONAL')
    then raise exception 'Invalid employment relationship'; end if;
  if jsonb_typeof(p_responsibilities) is distinct from 'array' or jsonb_array_length(p_responsibilities)>30
     or jsonb_typeof(p_additional_roles) is distinct from 'array' or jsonb_array_length(p_additional_roles)>16
     or jsonb_typeof(p_profiles) is distinct from 'array' or jsonb_array_length(p_profiles)>16
     or jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps)>24 then
    raise exception 'Invalid or oversized reusable package arrays'; end if;
  if jsonb_typeof(p_work_pattern) is distinct from 'object'
     or p_work_pattern->>'time_zone'<>'Asia/Kolkata'
     or (p_work_pattern->>'daily_minutes')::integer not between 60 and 600
     or (p_work_pattern->>'weekly_minutes')::integer not between 60 and 2880
     or jsonb_typeof(p_work_pattern->'days') is distinct from 'array' then
    raise exception 'Work pattern must use valid IST calendar, hours and weekdays'; end if;
  for item in select value from jsonb_array_elements(p_responsibilities) loop
    if jsonb_typeof(item)<>'string' or length(btrim(item #>> '{}')) not between 3 and 300
       then raise exception 'Invalid responsibility text'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_additional_roles) loop
    if not exists(select 1 from public.office_position_catalog p
       join public.office_department_catalog d on d.code=item->>'department_code'
       where p.code=item->>'position_code' and p.active=true and d.active=true)
       then raise exception 'Additional roles must reference active catalogue positions/departments'; end if;
    if not public.office_role_package_authorised(p_actor,item->>'department_code')
       then raise exception 'Additional role is outside current departmental authority'; end if;
    if exists(select 1 from public.office_position_catalog p
      where p.code=item->>'position_code' and (p.family='EXECUTIVE' or p.level>=8))
      and not exists(select 1 from public.office_user_roles r where r.user_id=p_actor
        and r.role='OWNER' and (r.expires_at is null or r.expires_at>now())) then
      raise exception 'Additional executive positions require Founder authority'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_profiles) loop
    if not exists(select 1 from public.office_access_profile_catalog
         where code=item->>'profile_code' and active=true) then
      raise exception 'Unknown access profile in package'; end if;
    if not exists(select 1 from public.office_user_roles r
      where r.user_id=p_actor and r.role='OWNER'
        and (r.expires_at is null or r.expires_at>now())) then
      if item->>'scope_type'<>'DEPARTMENT' or item->>'scope_key'<>p_department then
        raise exception 'Delegated department heads can package only their department-scoped access'; end if;
      if exists(
        select 1 from public.office_access_profile_catalog ap
        where ap.code=item->>'profile_code'
          and (ap.owner_managed_only or not ap.assignable_by_admin)
      ) or exists(
        select 1 from public.office_access_profile_permissions pp
        join public.office_permission_catalog permission on permission.code=pp.permission_code
        where pp.profile_code=item->>'profile_code' and pp.effect='ALLOW'
          and (permission.high_risk or permission.sensitivity in ('HIGH','CRITICAL')
            or public.office_department_for_permission(permission.code) is distinct from p_department)
      ) then raise exception 'Delegated package cannot include reserved or cross-department permissions'; end if;
    end if;
    if item->>'scope_type' not in
      ('DEPARTMENT','TEAM','PRODUCT','PROJECT','REPOSITORY','COST_CENTER','COMPANY','OWN')
      then raise exception 'Invalid access scope'; end if;
    if (item->>'scope_type')='DEPARTMENT' then
      if not exists(select 1 from public.office_department_catalog
        where code=item->>'scope_key' and active=true)
        or not public.office_role_package_authorised(p_actor,item->>'scope_key') then
        raise exception 'Cannot grant permissions outside owned departments'; end if;
    elsif (item->>'scope_type')='COMPANY' then
      -- A reusable staff bundle must never silently grant cross-department
      -- company privileges after a department has been handed over.
      raise exception 'Company-wide authority must use separately reviewed Access Administration';
    elsif (item->>'scope_type') not in ('OWN','DEPARTMENT') then
      if length(btrim(coalesce(item->>'scope_key',''))) < 2 then
        raise exception 'Resource-scoped profile requires a resource key'; end if;
      if not exists(select 1 from public.office_user_roles
        where user_id=p_actor and role='OWNER' and (expires_at is null or expires_at>now())) then
        raise exception 'Project and repository package grants require Founder review'; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_steps) loop
    if (item->>'code') !~ '^[A-Z][A-Z0-9_]{2,59}$'
      or length(btrim(coalesce(item->>'label',''))) not between 3 and 180
      or jsonb_typeof(item->'required') is distinct from 'boolean' then
      raise exception 'Invalid onboarding step'; end if;
  end loop;
  if (select count(distinct value->>'code') from jsonb_array_elements(p_steps))
      <>jsonb_array_length(p_steps) then
    raise exception 'Onboarding step codes must be unique'; end if;
  if p_employment='EMPLOYEE' and exists(
    select 1 from (values ('IDENTITY_VERIFIED'),('APPOINTMENT_SIGNED'),
      ('POLICIES_ACKNOWLEDGED'),('BANK_DETAILS_REVIEWED')) as mandatory(code)
    where not exists(
      select 1 from jsonb_array_elements(p_steps) task
      where task->>'code'=mandatory.code and task->>'required'='true'
    )
  ) then raise exception 'Employee packages require identity, signed appointment, policies and bank verification'; end if;
  if (select count(distinct ((value->>'profile_code')||':'||(value->>'scope_type')||':'||coalesce(value->>'scope_key','')))
      from jsonb_array_elements(p_profiles)) <> jsonb_array_length(p_profiles)
      then raise exception 'Duplicate access profile grants in package'; end if;
  perform pg_advisory_xact_lock(hashtext('KRAVIA_ROLE_PACKAGE'),hashtext(parsed_code));
  select coalesce(max(version),0)+1 into next_version
    from public.office_role_packages where code=parsed_code;
  insert into public.office_role_packages (
    code,version,label,description,department_code,primary_position_code,employment_type,
    responsibilities,additional_roles,access_profiles,onboarding_steps,work_pattern,created_by)
  values(parsed_code,next_version,btrim(p_label),left(coalesce(p_description,''),2000),
    p_department,p_position,p_employment,p_responsibilities,p_additional_roles,p_profiles,
    p_steps,p_work_pattern,p_actor) returning id into new_id;
  insert into public.office_role_package_events(package_id,actor_user_id,event_type,detail)
  values(new_id,p_actor,'PACKAGE_CREATED',jsonb_build_object('version',next_version));
  return new_id;
end; $func$;

-- Revalidate at PUBLISH and APPLY, not merely when a draft was created.
-- A newly delegated department head must not publish an old Founder draft
-- containing company/cross-department/high-risk privileges.
create or replace function public.office_role_package_scope_safe(
  p_actor uuid,p_package uuid
) returns boolean language plpgsql stable security definer set search_path='' as $func$
declare tmpl public.office_role_packages%rowtype; item jsonb;
begin
  select * into tmpl from public.office_role_packages where id=p_package;
  if not found or not public.office_role_package_authorised(p_actor,tmpl.department_code)
    then return false; end if;
  if exists(select 1 from public.office_user_roles r where r.user_id=p_actor
     and r.role='OWNER' and (r.expires_at is null or r.expires_at>now()))
     then return true; end if;
  if exists(select 1 from public.office_position_catalog p
     where p.code=tmpl.primary_position_code and (p.family='EXECUTIVE' or p.level>=8))
     then return false; end if;
  for item in select value from jsonb_array_elements(tmpl.additional_roles) loop
    if item->>'department_code'<>tmpl.department_code or exists(
      select 1 from public.office_position_catalog p
      where p.code=item->>'position_code' and (p.family='EXECUTIVE' or p.level>=8)
    ) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(tmpl.access_profiles) loop
    if item->>'scope_type'<>'DEPARTMENT' or item->>'scope_key'<>tmpl.department_code
      or not exists(
         select 1 from public.office_access_profile_catalog ap
         where ap.code=item->>'profile_code' and ap.active and ap.assignable_by_admin
           and not ap.owner_managed_only
      ) or exists(
         select 1 from public.office_access_profile_permissions pp
         join public.office_permission_catalog p on p.code=pp.permission_code
         where pp.profile_code=item->>'profile_code' and pp.effect='ALLOW'
           and (p.high_risk or p.sensitivity in ('HIGH','CRITICAL')
             or public.office_department_for_permission(p.code) is distinct from tmpl.department_code)
      ) then return false; end if;
  end loop;
  return true;
end; $func$;

create or replace function public.office_role_package_publish(
  p_actor uuid,p_package uuid
) returns text language plpgsql security definer set search_path='' as $func$
declare tmpl public.office_role_packages%rowtype;
begin
  select * into tmpl from public.office_role_packages where id=p_package for update;
  if not found or tmpl.status<>'DRAFT' then raise exception 'Only a draft package can be published'; end if;
  if not public.office_role_package_authorised(p_actor,tmpl.department_code)
    or not public.office_role_package_scope_safe(p_actor,tmpl.id) then
    raise exception 'Current scoped department authority and safe package required'; end if;
  -- New role-template versions never silently replace an active template.
  update public.office_role_packages set status='RETIRED' where code=tmpl.code and status='ACTIVE';
  update public.office_role_packages set status='ACTIVE',published_by=p_actor,
    published_at=now() where id=tmpl.id;
  insert into public.office_role_package_events(package_id,actor_user_id,event_type,detail)
  values(tmpl.id,p_actor,'PACKAGE_PUBLISHED',jsonb_build_object('code',tmpl.code,'version',tmpl.version));
  return 'ACTIVE';
end; $func$;

-- Controlled delegation path for a department head with a basic MEMBER role.
-- Never expand global actor_can_administer_target: doing so would elevate the
-- caller across unrelated Office administration. Only this service-role RPC
-- invokes this helper and rechecks the exact owned department and recipient.
create or replace function public.office_role_package_assign_by_department_head(
  p_actor uuid,p_target uuid,p_package uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $func$
declare tmpl public.office_role_packages%rowtype; item jsonb; saved_id uuid;
begin
  select * into tmpl from public.office_role_packages where id=p_package and status='ACTIVE';
  if not found or not exists(
    select 1 from public.office_department_ownership o where o.department_code=tmpl.department_code
      and o.owner_user_id=p_actor
  ) then raise exception 'Only the accepted department owner may delegate this package'; end if;
  if p_actor=p_target then
    raise exception 'Department head cannot change their own assigned job or permissions'; end if;
  if not exists(
    select 1 from public.office_identity_users i where i.user_id=p_target
      and i.status='ACTIVE' and i.primary_department=tmpl.department_code
  ) then raise exception 'Recipient must already be verified in the assigned department'; end if;
  if exists(select 1 from public.office_user_roles r
       where r.user_id=p_target and r.role in ('OWNER','ADMIN','DIRECTOR')
        and (r.expires_at is null or r.expires_at>now())) then
    raise exception 'Delegated owner cannot change privileged employee roles'; end if;
  if exists(select 1 from public.office_position_catalog p
       where p.code=tmpl.primary_position_code and (p.family='EXECUTIVE' or p.level>=8)) then
    raise exception 'Delegated owner cannot appoint executives or department heads'; end if;
  -- One department only, low-risk predefined profiles only.
  for item in select value from jsonb_array_elements(tmpl.access_profiles) loop
    if item->>'scope_type'<>'DEPARTMENT' or item->>'scope_key'<>tmpl.department_code then
      raise exception 'Cross-department package profile is forbidden for a department head'; end if;
    if exists(select 1 from public.office_access_profile_catalog ap
      where ap.code=item->>'profile_code' and
        (not ap.active or ap.owner_managed_only or not ap.assignable_by_admin)) then
      raise exception 'Restricted profile cannot be delegated by a department head'; end if;
    if exists(select 1 from public.office_access_profile_permissions pp
      join public.office_permission_catalog permission on permission.code=pp.permission_code
      where pp.profile_code=item->>'profile_code' and pp.effect='ALLOW' and
       (permission.high_risk or permission.sensitivity in ('HIGH','CRITICAL')
        or public.office_department_for_permission(permission.code) is distinct from tmpl.department_code)) then
      raise exception 'Cross-department or high-risk permission cannot be delegated'; end if;
  end loop;
  insert into public.office_job_assignments
    (user_id,position_code,department_code,reports_to_user_id,team_key,
     product_key,employment_type,status,assigned_by,updated_at)
  values(p_target,tmpl.primary_position_code,tmpl.department_code,p_actor,null,null,
         tmpl.employment_type,'ACTIVE',p_actor,now())
  on conflict(user_id) do update set position_code=excluded.position_code,
    department_code=excluded.department_code,reports_to_user_id=p_actor,
    employment_type=excluded.employment_type,status='ACTIVE',
    assigned_by=p_actor,updated_at=now();
  update public.office_identity_users set primary_department=tmpl.department_code,
    job_title=(select label from public.office_position_catalog where code=tmpl.primary_position_code),
    updated_at=now() where user_id=p_target;
  insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,
    action,department,reason,metadata)
  select p_actor,coalesce((select array_agg(r.role order by r.role)
    from public.office_user_roles r where r.user_id=p_actor
      and (r.expires_at is null or r.expires_at>now())),array[]::text[]),
    p_target,'JOB_ASSIGNMENT_CHANGED',tmpl.department_code,p_reason,
    jsonb_build_object('position',tmpl.primary_position_code,'delegate','ACCEPTED_DEPARTMENT_OWNER');
  for item in select value from jsonb_array_elements(tmpl.access_profiles) loop
    select id into saved_id from public.office_user_access_profiles
      where user_id=p_target and profile_code=item->>'profile_code'
        and scope_type='DEPARTMENT' and scope_key=tmpl.department_code
      limit 1 for update;
    if saved_id is null then
      insert into public.office_user_access_profiles
        (user_id,profile_code,scope_type,scope_key,status,granted_by,grant_reason,expires_at)
      values(p_target,item->>'profile_code','DEPARTMENT',tmpl.department_code,
        'ACTIVE',p_actor,p_reason,null);
    else
      update public.office_user_access_profiles set status='ACTIVE',
        granted_by=p_actor,grant_reason=p_reason,expires_at=null,updated_at=now()
      where id=saved_id;
    end if;
    insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,
      action,department,reason,metadata)
    select p_actor,coalesce((select array_agg(r.role order by r.role)
      from public.office_user_roles r where r.user_id=p_actor
       and (r.expires_at is null or r.expires_at>now())),array[]::text[]),
      p_target,'PROFILE_ASSIGNED',tmpl.department_code,p_reason,
      jsonb_build_object('profile',item->>'profile_code','scope_type','DEPARTMENT',
        'scope_key',tmpl.department_code,'delegate','ACCEPTED_DEPARTMENT_OWNER');
    saved_id:=null;
  end loop;
  return true;
end; $func$;

create or replace function public.office_role_package_apply(
  p_actor uuid,p_target uuid,p_package uuid,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $func$
declare tmpl public.office_role_packages%rowtype; item jsonb; rec record;
  existing uuid; application uuid; snapshot jsonb; global_admin boolean;
begin
  if length(btrim(coalesce(p_reason,''))) not between 12 and 500
    then raise exception 'An accountable assignment reason is required'; end if;
  select * into tmpl from public.office_role_packages where id=p_package and status='ACTIVE';
  if not found then raise exception 'Published package not available'; end if;
  if not public.office_role_package_authorised(p_actor,tmpl.department_code)
    or not public.office_role_package_scope_safe(p_actor,tmpl.id) then
    raise exception 'Current scoped department authority and safe package required'; end if;
  global_admin:=public.office_actor_can_administer_target(p_actor,p_target);
  if not global_admin and not exists(
    select 1 from public.office_department_ownership o
    join public.office_identity_users i on i.user_id=p_target
    where o.department_code=tmpl.department_code and o.owner_user_id=p_actor
      and i.status='ACTIVE' and i.primary_department=tmpl.department_code
  ) then raise exception 'Head can manage only already-allocated staff in their department'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_target and status='ACTIVE')
     then raise exception 'Recipient must have accepted and activated their Office account'; end if;
  if exists(select 1 from public.office_user_roles where user_id=p_target and role='OWNER'
    and (expires_at is null or expires_at>now())) then
    raise exception 'Founding Owner assignments are protected'; end if;
  if exists(select 1 from public.office_job_assignments j
      where j.user_id=p_target and j.status='ACTIVE' and j.department_code<>tmpl.department_code)
    then raise exception 'Changing another department primary job requires a separate governed transfer'; end if;
  select id into existing from public.office_employee_role_package_applications
     where package_id=tmpl.id and employee_user_id=p_target;
  if existing is not null then return existing; end if;
  -- Validate all assignment authority BEFORE any write. Existing RPCs remain
  -- the canonical permission and job mutators; the whole call is one transaction.
  for item in select value from jsonb_array_elements(tmpl.additional_roles) loop
    if not public.office_role_package_authorised(p_actor,item->>'department_code')
      then raise exception 'Supplemental department authority has changed'; end if;
  end loop;
  for item in select value from jsonb_array_elements(tmpl.access_profiles) loop
    if item->>'scope_type'='DEPARTMENT' and not
      public.office_role_package_authorised(p_actor,item->>'scope_key') then
      raise exception 'Access-profile scope was transferred to a different owner'; end if;
  end loop;
  if global_admin then
    -- Continue using the existing audited canonical mutations for Founder.
    if not public.office_assign_job(p_actor,p_target,tmpl.primary_position_code,tmpl.department_code,
        null,null,null,tmpl.employment_type,p_reason) then
      raise exception 'Canonical job assignment rejected'; end if;
    for item in select value from jsonb_array_elements(tmpl.access_profiles) loop
      perform public.office_assign_access_profile(p_actor,p_target,
        item->>'profile_code',item->>'scope_type',nullif(item->>'scope_key',''),
        p_reason || ' · ' || tmpl.code || ' v' || tmpl.version::text,null);
    end loop;
  elsif not public.office_role_package_assign_by_department_head(p_actor,p_target,tmpl.id,p_reason)
    then raise exception 'Scoped delegated package assignment was rejected'; end if;
  snapshot:=jsonb_build_object(
    'code',tmpl.code,'version',tmpl.version,'label',tmpl.label,
    'department_code',tmpl.department_code,'primary_position_code',tmpl.primary_position_code,
    'employment_type',tmpl.employment_type,'responsibilities',tmpl.responsibilities,
    'additional_roles',tmpl.additional_roles,'access_profiles',tmpl.access_profiles,
    'onboarding_steps',tmpl.onboarding_steps,'work_pattern',tmpl.work_pattern);
  insert into public.office_employee_role_package_applications (
    package_id,employee_user_id,applied_by,snapshot,snapshot_sha256,reason)
  values(tmpl.id,p_target,p_actor,snapshot,
    encode(extensions.digest(convert_to(snapshot::text,'UTF8'),'sha256'),'hex'),p_reason)
  returning id into application;
  for item in select value from jsonb_array_elements(tmpl.additional_roles) loop
    insert into public.office_employee_functional_positions
      (employee_user_id,position_code,department_code,application_id,responsibilities)
    values(p_target,item->>'position_code',item->>'department_code',application,
       case when jsonb_typeof(item->'responsibilities')='array'
          then item->'responsibilities' else '[]'::jsonb end)
    on conflict(employee_user_id,position_code,department_code) do update set
      application_id=excluded.application_id,responsibilities=excluded.responsibilities,
      active=true,updated_at=now();
  end loop;
  for item in select value from jsonb_array_elements(tmpl.onboarding_steps) loop
    insert into public.office_role_package_onboarding_tasks
      (application_id,employee_user_id,task_code,label,required)
    values(application,p_target,item->>'code',item->>'label',(item->>'required')::boolean);
  end loop;
  insert into public.office_role_package_events(package_id,application_id,actor_user_id,
    target_user_id,event_type,detail)
  values(tmpl.id,application,p_actor,p_target,'PACKAGE_APPLIED',
    jsonb_build_object('reason',p_reason,'version',tmpl.version,
                       'no_salary_or_department_ownership_change',true));
  return application;
end; $func$;

-- Apply ONE reusable package to many people atomically. Either every
-- recipient passes the canonical actor/target/scope checks, or nobody changes.
create or replace function public.office_role_package_apply_many(
  p_actor uuid,p_targets uuid[],p_package uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $func$
declare target_id uuid; applied_id uuid; result jsonb:='[]'::jsonb;
begin
  if coalesce(cardinality(p_targets),0) not between 1 and 30
     then raise exception 'Select between 1 and 30 verified employees'; end if;
  if (select count(distinct v) from unnest(p_targets) as v)
       <> cardinality(p_targets) then
    raise exception 'Duplicate or missing employee targets'; end if;
  for target_id in select v from unnest(p_targets) as v order by v loop
    applied_id:=public.office_role_package_apply(p_actor,target_id,p_package,p_reason);
    result:=result||jsonb_build_array(jsonb_build_object(
      'employee_user_id',target_id,'application_id',applied_id));
  end loop;
  return result;
end; $func$;

create or replace function public.office_role_package_task_decide(
  p_actor uuid,p_task uuid,p_action text,p_reference text,p_note text
) returns text language plpgsql security definer set search_path='' as $func$
declare task public.office_role_package_onboarding_tasks%rowtype; rec public.office_employee_role_package_applications%rowtype;
  new_state text; action_type text;
begin
  select * into task from public.office_role_package_onboarding_tasks where id=p_task for update;
  if not found then raise exception 'Onboarding task not found'; end if;
  select * into rec from public.office_employee_role_package_applications where id=task.application_id;
  if p_action='SUBMIT' then
    if p_actor<>task.employee_user_id or task.status not in ('PENDING','SUBMITTED') then
      raise exception 'Only the employee can submit their pending evidence'; end if;
    if length(btrim(coalesce(p_reference,'')))<8 then raise exception 'Evidence reference required'; end if;
    new_state:='SUBMITTED'; action_type:='TASK_SUBMITTED';
    update public.office_role_package_onboarding_tasks
       set status=new_state,evidence_reference=left(p_reference,500),
           submitted_by=p_actor,submitted_at=now()
       where id=task.id;
  else
    if p_actor=task.employee_user_id then
      raise exception 'Employee cannot verify their own onboarding'; end if;
    if not (
      (public.office_actor_can_administer_target(p_actor,task.employee_user_id)
       and public.office_effective_permission(p_actor,'people.update','COMPANY',null,null))
      or exists(
         select 1 from public.office_department_ownership o
         join public.office_identity_users i on i.user_id=task.employee_user_id
         where o.owner_user_id=p_actor and o.department_code=i.primary_department
       )
    ) then raise exception 'Independent owner or People reviewer required'; end if;
    if p_action='VERIFY' and task.status='SUBMITTED' then
      new_state:='VERIFIED';action_type:='TASK_VERIFIED';
    elsif p_action='RETURN' and task.status in ('SUBMITTED','VERIFIED') then
      new_state:='PENDING';action_type:='TASK_RETURNED';
    elsif p_action='WAIVE' and task.required=false and task.status<>'VERIFIED'
      and length(btrim(coalesce(p_note,'')))>=12 then
      new_state:='WAIVED';action_type:='TASK_WAIVED';
    else raise exception 'Invalid task decision or evidence state'; end if;
    update public.office_role_package_onboarding_tasks
      set status=new_state,reviewed_by=p_actor,reviewed_at=now(),review_note=left(p_note,500),
        evidence_reference=case when new_state='PENDING' then null else evidence_reference end
      where id=task.id;
  end if;
  insert into public.office_role_package_events(package_id,application_id,task_id,
    actor_user_id,target_user_id,event_type,detail)
  values(rec.package_id,rec.id,task.id,p_actor,task.employee_user_id,action_type,
    jsonb_build_object('status',new_state,'note',left(coalesce(p_note,''),500)));
  return new_state;
end; $func$;

revoke all on function public.office_role_package_protect_evidence() from public,anon,authenticated;
revoke all on function public.office_role_package_authorised(uuid,text) from public,anon,authenticated;
revoke all on function public.office_role_package_create(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.office_role_package_publish(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_role_package_scope_safe(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_role_package_assign_by_department_head(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_role_package_apply(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_role_package_apply_many(uuid,uuid[],uuid,text) from public,anon,authenticated;
revoke all on function public.office_role_package_task_decide(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.office_role_package_authorised(uuid,text) to service_role;
grant execute on function public.office_role_package_create(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.office_role_package_publish(uuid,uuid) to service_role;
grant execute on function public.office_role_package_apply(uuid,uuid,uuid,text) to service_role;
grant execute on function public.office_role_package_apply_many(uuid,uuid[],uuid,text) to service_role;
grant execute on function public.office_role_package_task_decide(uuid,uuid,text,text,text) to service_role;
