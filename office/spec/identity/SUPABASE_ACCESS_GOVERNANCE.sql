-- KRAVIA Office — delegated access-governance extension
-- Apply after SUPABASE_IDENTITY.sql. Contains no user-specific identities or secrets.

alter table public.office_identity_users drop constraint if exists office_identity_users_status_check;
alter table public.office_identity_users add constraint office_identity_users_status_check check (status in ('ACTIVE','SUSPENDED','REVOKED'));
alter table public.office_identity_users
  add column if not exists primary_department text,
  add column if not exists job_title text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists authorization_version bigint not null default 1,
  add column if not exists last_role_change_at timestamptz,
  add column if not exists last_access_review_at timestamptz,
  add column if not exists access_review_due_at timestamptz not null default (now()+interval '90 days');
alter table public.office_identity_users drop constraint if exists office_identity_users_department_check;
alter table public.office_identity_users add constraint office_identity_users_department_check check (primary_department is null or primary_department in ('EXECUTIVE','ADMINISTRATION','FINANCE','TAX','SECRETARIAL','LEGAL','PEOPLE','OPERATIONS','AUDIT','PRODUCT'));

alter table public.office_user_roles drop constraint if exists office_user_roles_role_check;
alter table public.office_user_roles add constraint office_user_roles_role_check check (role in ('OWNER','DIRECTOR','ADMIN','FINANCE','CA','CS','LEGAL','HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN'));
alter table public.office_user_roles
  add column if not exists granted_by uuid references auth.users(id) on delete set null,
  add column if not exists grant_reason text,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists office_single_owner_role on public.office_user_roles(role) where role='OWNER';

create table if not exists public.office_role_catalog (
  role text primary key check (role in ('OWNER','DIRECTOR','ADMIN','FINANCE','CA','CS','LEGAL','HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN')),
  label text not null,
  description text not null,
  workspace_scope text not null check (workspace_scope in ('OFFICE','FINANCE','BOTH')),
  privilege_tier smallint not null check (privilege_tier between 1 and 100),
  owner_managed_only boolean not null default false,
  assignable_by_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.office_role_catalog(role,label,description,workspace_scope,privilege_tier,owner_managed_only,assignable_by_admin) values
('OWNER','Owner','Protected company owner and ultimate Office access authority.','BOTH',100,true,false),
('DIRECTOR','Director','Director-level governance and executive access.','BOTH',90,true,false),
('ADMIN','Administrator','Delegated identity and access administration without automatic finance/legal authority.','OFFICE',80,true,false),
('FINANCE','Finance','Finance operations, treasury and accounting execution subject to maker-checker controls.','FINANCE',50,false,true),
('CA','Chartered Accountant','Tax, GST and accounting professional workspace access.','FINANCE',50,false,true),
('CS','Company Secretary','Corporate secretarial and governance workspace access.','OFFICE',50,false,true),
('LEGAL','Legal','Contracts, legal and privacy governance access.','OFFICE',50,false,true),
('HR','HR','People and HR administration access.','OFFICE',50,false,true),
('OPERATIONS','Operations','Company operations, vendor, asset and support access.','OFFICE',50,false,true),
('AUDITOR','Auditor','Independent read/review-oriented financial assurance access.','FINANCE',40,false,true),
('PRODUCT_ADMIN','Product Administrator','KRAVIA product and customer operational administration.','OFFICE',50,false,true)
on conflict(role) do update set label=excluded.label,description=excluded.description,workspace_scope=excluded.workspace_scope,privilege_tier=excluded.privilege_tier,owner_managed_only=excluded.owner_managed_only,assignable_by_admin=excluded.assignable_by_admin,active=true;

create table if not exists public.office_department_catalog (
  code text primary key check (code in ('EXECUTIVE','ADMINISTRATION','FINANCE','TAX','SECRETARIAL','LEGAL','PEOPLE','OPERATIONS','AUDIT','PRODUCT')),
  label text not null,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.office_department_catalog(code,label,description) values
('EXECUTIVE','Executive','Owner and director leadership.'),('ADMINISTRATION','Administration','Office administration and delegated access management.'),('FINANCE','Finance','Accounting, treasury, billing and reconciliation.'),('TAX','Tax & GST','GST, tax working papers and CA review.'),('SECRETARIAL','Secretarial','Company-secretarial and governance work.'),('LEGAL','Legal','Contracts, legal review and privacy governance.'),('PEOPLE','People & HR','People operations and HR administration.'),('OPERATIONS','Operations','Company operations, assets, vendors and support.'),('AUDIT','Audit','Independent assurance and audit review.'),('PRODUCT','Product','Product and customer operations.')
on conflict(code) do update set label=excluded.label,description=excluded.description,active=true;

create table if not exists public.office_access_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  job_title text,
  department text check (department is null or department in ('EXECUTIVE','ADMINISTRATION','FINANCE','TAX','SECRETARIAL','LEGAL','PEOPLE','OPERATIONS','AUDIT','PRODUCT')),
  requested_roles text[] not null default '{}' check (requested_roles <@ array['OWNER','DIRECTOR','ADMIN','FINANCE','CA','CS','LEGAL','HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN']::text[]),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REVOKED','EXPIRED','FAILED')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  auth_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now()+interval '1 hour'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists office_one_pending_invite_per_email on public.office_access_invitations(lower(email)) where status='PENDING';

create table if not exists public.office_access_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_roles text[] not null default '{}',
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null check (action in ('INVITE_CREATED','INVITE_ACCEPTED','INVITE_REVOKED','INVITE_EXPIRED','INVITE_FAILED','IDENTITY_ACTIVATED','IDENTITY_SUSPENDED','IDENTITY_REACTIVATED','IDENTITY_REVOKED','ROLE_GRANTED','ROLE_REVOKED','ROLE_EXPIRED','DEPARTMENT_CHANGED','ACCESS_REVIEW_APPROVED','ACCESS_REVIEW_CHANGES_REQUIRED','MFA_RESET')),
  role text,
  department text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.office_access_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','CHANGES_REQUIRED','CANCELLED')),
  due_at timestamptz not null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists office_access_invitations_auth_user_idx on public.office_access_invitations(auth_user_id);
create index if not exists office_access_invitations_requested_by_idx on public.office_access_invitations(requested_by);
create index if not exists office_access_audit_target_idx on public.office_access_audit(target_user_id,created_at desc);
create index if not exists office_access_audit_actor_idx on public.office_access_audit(actor_user_id,created_at desc);
create index if not exists office_access_reviews_reviewer_idx on public.office_access_reviews(reviewed_by);
create index if not exists office_access_reviews_user_idx on public.office_access_reviews(user_id);
create index if not exists office_access_reviews_due_idx on public.office_access_reviews(status,due_at);
create index if not exists office_identity_created_by_idx on public.office_identity_users(created_by);
create index if not exists office_roles_granted_by_idx on public.office_user_roles(granted_by);

alter table public.office_role_catalog enable row level security;
alter table public.office_department_catalog enable row level security;
alter table public.office_access_invitations enable row level security;
alter table public.office_access_audit enable row level security;
alter table public.office_access_reviews enable row level security;
revoke all on public.office_role_catalog,public.office_department_catalog,public.office_access_invitations,public.office_access_audit,public.office_access_reviews from anon,authenticated,public;

drop policy if exists office_role_catalog_deny_client_access on public.office_role_catalog;
create policy office_role_catalog_deny_client_access on public.office_role_catalog as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_department_catalog_deny_client_access on public.office_department_catalog;
create policy office_department_catalog_deny_client_access on public.office_department_catalog as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_invitations_deny_client_access on public.office_access_invitations;
create policy office_invitations_deny_client_access on public.office_access_invitations as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_access_audit_deny_client_access on public.office_access_audit;
create policy office_access_audit_deny_client_access on public.office_access_audit as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_access_reviews_deny_client_access on public.office_access_reviews;
create policy office_access_reviews_deny_client_access on public.office_access_reviews as restrictive for all to anon,authenticated using(false) with check(false);

grant usage on schema public to supabase_auth_admin;
grant select on public.office_identity_users,public.office_user_roles to supabase_auth_admin;
drop policy if exists office_identity_auth_admin_read on public.office_identity_users;
create policy office_identity_auth_admin_read on public.office_identity_users for select to supabase_auth_admin using(true);
drop policy if exists office_roles_auth_admin_read on public.office_user_roles;
create policy office_roles_auth_admin_read on public.office_user_roles for select to supabase_auth_admin using(true);

create or replace function public.office_touch_identity() returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at:=now();
  if new.status is distinct from old.status or new.primary_department is distinct from old.primary_department then new.authorization_version:=old.authorization_version+1; end if;
  return new;
end; $$;
drop trigger if exists office_identity_touch on public.office_identity_users;
create trigger office_identity_touch before update on public.office_identity_users for each row execute function public.office_touch_identity();

create or replace function public.office_role_change_bump_authz() returns trigger language plpgsql set search_path='' as $$
declare affected_user uuid;
begin
  affected_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  update public.office_identity_users set authorization_version=authorization_version+1,last_role_change_at=now(),updated_at=now() where user_id=affected_user;
  return case when tg_op='DELETE' then old else new end;
end; $$;
drop trigger if exists office_role_change_bump on public.office_user_roles;
create trigger office_role_change_bump after insert or update or delete on public.office_user_roles for each row execute function public.office_role_change_bump_authz();

create or replace function public.office_protect_owner_role() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' and old.role='OWNER' then raise exception 'OWNER role cannot be removed through ordinary role administration'; end if;
  if tg_op='UPDATE' and old.role='OWNER' and (new.role is distinct from old.role or new.user_id is distinct from old.user_id) then raise exception 'OWNER role cannot be transferred through ordinary role administration'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
drop trigger if exists office_owner_role_guard on public.office_user_roles;
create trigger office_owner_role_guard before update or delete on public.office_user_roles for each row execute function public.office_protect_owner_role();

create or replace function public.office_protect_owner_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status<>'ACTIVE' and exists(select 1 from public.office_user_roles r where r.user_id=old.user_id and r.role='OWNER') then raise exception 'OWNER identity cannot be suspended or revoked through ordinary administration'; end if;
  return new;
end; $$;
drop trigger if exists office_owner_identity_guard on public.office_identity_users;
create trigger office_owner_identity_guard before update of status on public.office_identity_users for each row execute function public.office_protect_owner_identity();

create or replace function public.office_role_conflict_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if new.role='AUDITOR' and exists(select 1 from public.office_user_roles r where r.user_id=new.user_id and r.role in ('OWNER','DIRECTOR','ADMIN','FINANCE') and (r.expires_at is null or r.expires_at>now())) then raise exception 'AUDITOR cannot be combined with privileged or finance-execution roles'; end if;
  if new.role in ('OWNER','DIRECTOR','ADMIN','FINANCE') and exists(select 1 from public.office_user_roles r where r.user_id=new.user_id and r.role='AUDITOR' and (r.expires_at is null or r.expires_at>now())) then raise exception 'Privileged or finance-execution roles cannot be combined with AUDITOR'; end if;
  return new;
end; $$;
drop trigger if exists office_role_conflict_guard_trigger on public.office_user_roles;
create trigger office_role_conflict_guard_trigger before insert or update on public.office_user_roles for each row execute function public.office_role_conflict_guard();

create or replace function public.office_access_audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'KRAVIA Office access audit is immutable'; end; $$;
drop trigger if exists office_access_audit_immutable_guard on public.office_access_audit;
create trigger office_access_audit_immutable_guard before update or delete on public.office_access_audit for each row execute function public.office_access_audit_immutable();

create or replace function public.office_custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare claims jsonb; roles jsonb; access_status text; department text; authz_version bigint;
begin
  claims:=event->'claims';
  select u.status,u.primary_department,u.authorization_version into access_status,department,authz_version from public.office_identity_users u where u.user_id=(event->>'user_id')::uuid;
  if access_status='ACTIVE' then
    select coalesce(jsonb_agg(r.role order by r.role),'[]'::jsonb) into roles from public.office_user_roles r where r.user_id=(event->>'user_id')::uuid and (r.expires_at is null or r.expires_at>now());
  else roles:='[]'::jsonb; end if;
  claims:=jsonb_set(claims,'{office_roles}',coalesce(roles,'[]'::jsonb),true);
  claims:=jsonb_set(claims,'{office_access_status}',to_jsonb(coalesce(access_status,'UNASSIGNED')),true);
  claims:=jsonb_set(claims,'{office_department}',to_jsonb(department),true);
  claims:=jsonb_set(claims,'{office_authz_version}',to_jsonb(coalesce(authz_version,0)),true);
  return jsonb_build_object('claims',claims);
end; $$;
grant execute on function public.office_custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.office_custom_access_token_hook(jsonb) from anon,authenticated,public;

-- Generic reconciliation for an already-approved bootstrap OWNER; contains no identity value.
update public.office_identity_users i set primary_department=coalesce(i.primary_department,'EXECUTIVE'),job_title=coalesce(i.job_title,'Owner'),created_by=coalesce(i.created_by,i.user_id) where exists(select 1 from public.office_user_roles r where r.user_id=i.user_id and r.role='OWNER');
update public.office_user_roles r set granted_by=coalesce(r.granted_by,r.user_id),grant_reason=coalesce(r.grant_reason,'Bootstrap owner authority'),updated_at=now() where r.role='OWNER';

comment on table public.office_access_audit is 'Immutable append-only KRAVIA Office identity/access governance audit events.';
comment on function public.office_custom_access_token_hook(jsonb) is 'KRAVIA Office custom access-token hook emitting active non-expired roles, status, department and authorization version.';
