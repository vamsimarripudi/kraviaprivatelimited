-- KRAVIA Office — Supabase identity/RBAC control schema
-- Production project: xjtazosozxmudkbxqhjl (KRAVIA Office, ap-south-1)
-- This file contains no API keys, passwords, user identities or MFA secrets.

create table if not exists public.office_identity_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','REVOKED')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('OWNER','DIRECTOR','FINANCE','CA','CS','LEGAL','HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.office_identity_users enable row level security;
alter table public.office_user_roles enable row level security;

revoke all on public.office_identity_users from anon, authenticated, public;
revoke all on public.office_user_roles from anon, authenticated, public;

grant select on public.office_identity_users to supabase_auth_admin;
grant select on public.office_user_roles to supabase_auth_admin;

create policy "office_identity_deny_client_access"
on public.office_identity_users
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "office_roles_deny_client_access"
on public.office_user_roles
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.office_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  roles jsonb;
  access_status text;
begin
  claims := event->'claims';

  select u.status into access_status
  from public.office_identity_users u
  where u.user_id = (event->>'user_id')::uuid;

  if access_status = 'ACTIVE' then
    select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb)
      into roles
    from public.office_user_roles r
    where r.user_id = (event->>'user_id')::uuid;
  else
    roles := '[]'::jsonb;
  end if;

  claims := jsonb_set(claims, '{office_roles}', roles, true);
  claims := jsonb_set(claims, '{office_access_status}', to_jsonb(coalesce(access_status, 'UNASSIGNED')), true);

  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.office_custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.office_custom_access_token_hook(jsonb) from anon, authenticated, public;

comment on table public.office_identity_users is 'KRAVIA Office identity admission state. No row means no Office access.';
comment on table public.office_user_roles is 'Explicit KRAVIA Office application roles injected into Auth JWTs.';
comment on function public.office_custom_access_token_hook(jsonb) is 'Supabase custom access token hook for KRAVIA Office roles. Enable from Authentication > Hooks.';
