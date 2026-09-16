-- KRAVIA Office — base Supabase identity/RBAC schema
-- Hosted project: KRAVIA Office. Contains no API keys, passwords, user identities or MFA secrets.
-- Apply this file first, then SUPABASE_ACCESS_GOVERNANCE.sql.

create table if not exists public.office_identity_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','REVOKED')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','DIRECTOR','ADMIN','FINANCE','CA','CS','LEGAL','HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.office_identity_users enable row level security;
alter table public.office_user_roles enable row level security;
revoke all on public.office_identity_users from anon, authenticated, public;
revoke all on public.office_user_roles from anon, authenticated, public;
grant usage on schema public to supabase_auth_admin;
grant select on public.office_identity_users to supabase_auth_admin;
grant select on public.office_user_roles to supabase_auth_admin;

drop policy if exists office_identity_deny_client_access on public.office_identity_users;
create policy office_identity_deny_client_access on public.office_identity_users as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists office_roles_deny_client_access on public.office_user_roles;
create policy office_roles_deny_client_access on public.office_user_roles as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists office_identity_auth_admin_read on public.office_identity_users;
create policy office_identity_auth_admin_read on public.office_identity_users for select to supabase_auth_admin using (true);
drop policy if exists office_roles_auth_admin_read on public.office_user_roles;
create policy office_roles_auth_admin_read on public.office_user_roles for select to supabase_auth_admin using (true);

create or replace function public.office_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  claims jsonb;
  roles jsonb;
  access_status text;
begin
  claims := event->'claims';
  select u.status into access_status from public.office_identity_users u where u.user_id=(event->>'user_id')::uuid;
  if access_status='ACTIVE' then
    select coalesce(jsonb_agg(r.role order by r.role),'[]'::jsonb) into roles from public.office_user_roles r where r.user_id=(event->>'user_id')::uuid;
  else
    roles := '[]'::jsonb;
  end if;
  claims := jsonb_set(claims,'{office_roles}',coalesce(roles,'[]'::jsonb),true);
  claims := jsonb_set(claims,'{office_access_status}',to_jsonb(coalesce(access_status,'UNASSIGNED')),true);
  return jsonb_build_object('claims',claims);
end;
$$;

grant execute on function public.office_custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.office_custom_access_token_hook(jsonb) from anon, authenticated, public;

comment on table public.office_identity_users is 'KRAVIA Office identity admission state. No row means no Office access.';
comment on table public.office_user_roles is 'Explicit KRAVIA Office application roles. Extended governance is defined in SUPABASE_ACCESS_GOVERNANCE.sql.';
comment on function public.office_custom_access_token_hook(jsonb) is 'Base KRAVIA Office custom access-token hook; access-governance migration extends its claims.';
