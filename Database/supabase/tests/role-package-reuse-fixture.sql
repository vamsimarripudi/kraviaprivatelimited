-- Extra canonical fixtures for the reusable package smoke after
-- workforce-release-fixture.sql and permanent ownership migration.
-- All identities are fabricated, only used inside ephemeral CI PostgreSQL.
create table if not exists public.office_position_catalog (
  code text primary key, label text not null, family text not null,
  level smallint not null default 2, active boolean not null default true
);
create table if not exists public.office_access_profile_catalog (
  code text primary key, label text not null,
  owner_managed_only boolean not null default false,
  assignable_by_admin boolean not null default true,
  active boolean not null default true
);
create table if not exists public.office_job_assignments (
  user_id uuid primary key references public.office_identity_users(user_id),
  position_code text references public.office_position_catalog(code),
  department_code text references public.office_department_catalog(code),
  reports_to_user_id uuid references public.office_identity_users(user_id),
  team_key text, product_key text, employment_type text not null default 'EMPLOYEE',
  status text not null default 'ACTIVE', assigned_by uuid references public.office_identity_users(user_id),
  updated_at timestamptz not null default now()
);
alter table public.office_identity_users
  add column if not exists primary_department text,
  add column if not exists job_title text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.office_user_access_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists granted_by uuid references public.office_identity_users(user_id),
  add column if not exists grant_reason text not null default 'Controlled grant',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.office_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_roles text[],
  target_user_id uuid,
  action text,
  department text,
  reason text,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.office_permission_catalog
  add column if not exists high_risk boolean not null default false,
  add column if not exists sensitivity text not null default 'LOW';
insert into public.office_position_catalog(code,label,family,level) values
 ('FULL_STACK_DEV','Full Stack Developer','ENGINEERING',3),
 ('FRONTEND_DEV','Frontend Developer','ENGINEERING',3),
 ('SALES_HEAD','Sales Head','SALES',8),
 ('MARKETING_HEAD','Marketing Head','MARKETING',8);
insert into public.office_department_catalog(code,label,active) values
 ('SALES','Sales',true),('MARKETING','Marketing',true);
insert into public.office_access_profile_catalog(code,label) values
 ('ENGINEERING_MANAGER','Engineering Manager'),
 ('SALES_MANAGER','Sales Manager'),
 ('FRONTEND_EDITOR','Frontend Editor');
insert into public.office_permission_catalog(code,module,action,owner_bypass) values
 ('access.profile.assign','ACCESS','ASSIGN_PROFILE',true),
 ('engineering.code.read','ENGINEERING','READ',true);
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
 values ('ENGINEERING_MANAGER','finance.read','ALLOW','DEPARTMENT'),
  ('FRONTEND_EDITOR','engineering.code.read','ALLOW','DEPARTMENT');
insert into public.office_job_assignments(user_id,position_code,department_code,employment_type,assigned_by)
values ('f0000000-0000-4000-8000-000000000001','FULL_STACK_DEV','ENGINEERING','EMPLOYEE',
        'f0000000-0000-4000-8000-000000000001');

create or replace function public.office_actor_can_administer_target(p_actor uuid,p_target uuid)
returns boolean language sql stable security definer set search_path='' as $func$
 select exists(select 1 from public.office_identity_users i where i.user_id=p_actor and i.status='ACTIVE')
 and exists(select 1 from public.office_identity_users i where i.user_id=p_target and i.status='ACTIVE')
 and (
  exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role='OWNER')
  or (
   exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role='ADMIN')
   and p_actor<>p_target
   and not exists(select 1 from public.office_user_roles r
                  where r.user_id=p_target and r.role in ('OWNER','DIRECTOR','ADMIN'))
  )
 );
$func$;
create or replace function public.office_assign_job(
  p_actor uuid,p_target uuid,p_position text,p_department text,p_reports_to uuid default null,
  p_team_key text default null,p_product_key text default null,
  p_employment_type text default 'EMPLOYEE',p_reason text default null
) returns boolean language plpgsql security definer set search_path='' as $func$
begin
  if not public.office_actor_can_administer_target(p_actor,p_target) then
    raise exception 'Actor cannot administer target'; end if;
  if not exists(select 1 from public.office_position_catalog where code=p_position and active=true)
    then raise exception 'Invalid position'; end if;
  if not exists(select 1 from public.office_department_catalog where code=p_department and active=true)
    then raise exception 'Invalid department'; end if;
  if p_reports_to=p_target then raise exception 'User cannot report to self'; end if;
  insert into public.office_job_assignments(user_id,position_code,department_code,
      reports_to_user_id,team_key,product_key,employment_type,assigned_by,status,updated_at)
  values(p_target,p_position,p_department,p_reports_to,p_team_key,p_product_key,
         p_employment_type,p_actor,'ACTIVE',now())
  on conflict(user_id) do update set position_code=excluded.position_code,
    department_code=excluded.department_code,employment_type=excluded.employment_type,
    assigned_by=p_actor,status='ACTIVE',updated_at=now();
  update public.office_identity_users set primary_department=p_department,
    job_title=(select label from public.office_position_catalog where code=p_position),
    updated_at=now() where user_id=p_target;
  insert into public.office_access_audit(actor_user_id,target_user_id,action,department,reason)
  values(p_actor,p_target,'JOB_ASSIGNMENT_CHANGED',p_department,p_reason);
  return true;
end; $func$;
create or replace function public.office_assign_access_profile(
  p_actor uuid,p_target uuid,p_profile text,p_scope_type text default 'COMPANY',
  p_scope_key text default null,p_reason text default null,p_expires_at timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $func$
declare new_id uuid;
begin
  if not public.office_actor_can_administer_target(p_actor,p_target) then
     raise exception 'Actor cannot administer target'; end if;
  if not exists(select 1 from public.office_access_profile_catalog where code=p_profile and active=true)
     then raise exception 'Unknown profile'; end if;
  insert into public.office_user_access_profiles(user_id,profile_code,scope_type,
       scope_key,status,granted_by,grant_reason,expires_at)
  values(p_target,p_profile,p_scope_type,p_scope_key,'ACTIVE',p_actor,p_reason,p_expires_at)
  returning id into new_id;
  insert into public.office_access_audit(actor_user_id,target_user_id,action,reason)
  values(p_actor,p_target,'PROFILE_ASSIGNED',p_reason);
  return new_id;
end; $func$;
