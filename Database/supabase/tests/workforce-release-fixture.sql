-- Isolated PostgreSQL 17 fixture. NEVER load this into a live KRAVIA database.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='kravia_office_backend') then
    create role kravia_office_backend nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;

create table public.office_department_catalog (
  code text primary key, label text, active boolean not null default true
);
create table public.office_identity_users (
  user_id uuid primary key, display_name text, status text not null default 'ACTIVE'
);
create table public.office_user_roles (
  user_id uuid not null references public.office_identity_users(user_id),
  role text not null, expires_at timestamptz
);
create table public.office_permission_catalog (
  code text primary key, module text not null, action text not null,
  active boolean not null default true, owner_bypass boolean not null default true
);
create table public.office_user_permission_overrides (
  user_id uuid not null references public.office_identity_users(user_id),
  permission_code text not null references public.office_permission_catalog(code),
  effect text not null, expires_at timestamptz,
  scope_type text not null default 'COMPANY', scope_key text
);
create table public.office_user_access_profiles (
  user_id uuid not null references public.office_identity_users(user_id),
  profile_code text not null, scope_type text not null default 'COMPANY',
  scope_key text, status text not null default 'ACTIVE', expires_at timestamptz
);
create table public.office_access_profile_permissions (
  profile_code text not null, permission_code text not null,
  effect text not null, default_scope_type text default 'COMPANY'
);
create or replace function public.office_scope_matches(
  grant_type text,grant_key text,resource_type text,resource_key text,
  actor uuid, owner_id uuid
) returns boolean language sql stable as $$
  select grant_type='COMPANY' or
         (grant_type='DEPARTMENT' and resource_type='DEPARTMENT' and (grant_key is null or grant_key=resource_key))
         or (grant_type='OWN' and actor=owner_id);
$$;

create table public.office_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.office_identity_users(user_id),
  check_in_at timestamptz not null, check_out_at timestamptz
);
create table public.office_attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid references public.office_attendance_sessions(id),
  started_at timestamptz not null, ended_at timestamptz
);
create table public.office_payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_code text not null, starts_on date, ends_on date, status text
);
create table public.office_employment_registry (
  employment_id uuid primary key default gen_random_uuid(),
  employment_code text not null
);
create table public.office_compensation_versions (
  id uuid primary key default gen_random_uuid(),
  annual_ctc_minor bigint not null, monthly_gross_minor bigint not null
);
create table public.office_payroll_results (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.office_payroll_periods(id),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  employment_id uuid not null references public.office_employment_registry(employment_id),
  compensation_version_id uuid not null references public.office_compensation_versions(id),
  currency text not null default 'INR',
  base_gross_minor bigint not null,
  prorated_gross_minor bigint not null,
  additional_earnings_minor bigint not null default 0,
  deductions_minor bigint not null default 0,
  net_pay_minor bigint not null,
  line_items jsonb not null default '[]'::jsonb,
  calculation_version integer not null default 1,
  calculation_hash text not null,
  status text not null default 'CALCULATED'
);
create table public.office_payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.office_payroll_periods(id),
  employment_id uuid not null references public.office_employment_registry(employment_id),
  adjustment_code text not null,
  source_reference text not null
);
insert into public.office_department_catalog(code,label) values
 ('FINANCE','Finance'),('ENGINEERING','Engineering'),('PEOPLE','People & HR');
insert into public.office_identity_users(user_id,display_name,status) values
 ('f0000000-0000-4000-8000-000000000001','Founder','ACTIVE'),
 ('f0000000-0000-4000-8000-000000000002','Finance Recipient','ACTIVE'),
 ('f0000000-0000-4000-8000-000000000003','Director Reviewer','ACTIVE'),
 ('f0000000-0000-4000-8000-000000000004','Employee','ACTIVE');
insert into public.office_user_roles(user_id,role) values
 ('f0000000-0000-4000-8000-000000000001','OWNER'),
 ('f0000000-0000-4000-8000-000000000003','DIRECTOR'),
 ('f0000000-0000-4000-8000-000000000002','MEMBER'),
 ('f0000000-0000-4000-8000-000000000004','MEMBER');
insert into public.office_permission_catalog(code,module,action,owner_bypass) values
 ('finance.payment.prepare','FINANCE','CREATE',true),
 ('finance.read','FINANCE','READ',true),
 ('payroll.run.read','PAYROLL','READ_RUN',true),
 ('payroll.run.review','PAYROLL','REVIEW_RUN',true),
 ('payroll.rules.manage','PAYROLL','MANAGE_RULES',true),
 ('payroll.payment.prepare','PAYROLL','PREPARE_PAYMENT',true),
 ('payroll.run.prepare','PAYROLL','PREPARE_RUN',true),
 ('people.update','PEOPLE','UPDATE',true);
insert into public.office_user_access_profiles(user_id,profile_code,scope_type,scope_key,status)
  values ('f0000000-0000-4000-8000-000000000003','TEST_DIRECTOR_FINANCE','COMPANY',null,'ACTIVE');
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('TEST_DIRECTOR_FINANCE','payroll.run.review','ALLOW','COMPANY'),
 ('TEST_DIRECTOR_FINANCE','people.update','ALLOW','COMPANY'),
 ('TEST_DIRECTOR_FINANCE','payroll.payment.prepare','ALLOW','COMPANY'),
 ('TEST_DIRECTOR_FINANCE','payroll.rules.manage','ALLOW','COMPANY');
