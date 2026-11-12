-- Future-effective Office access grants: no rights before the appointed
-- start, even when a person accepts an invitation early.
-- Legacy profiles have NULL effective_from and retain their previous behavior.
alter table public.office_user_access_profiles
  add column if not exists effective_from timestamptz;
comment on column public.office_user_access_profiles.effective_from is
  'Earliest date/time a governed access profile can grant permission.';

create or replace function public.office_effective_permission(
  p_user_id uuid, p_permission text, p_scope_type text default 'COMPANY',
  p_scope_key text default null, p_owner_user_id uuid default null
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  permission_record public.office_permission_catalog%rowtype;
  verdict text;
begin
  if not exists(select 1 from public.office_identity_users i
                where i.user_id=p_user_id and i.status='ACTIVE') then return false; end if;
  select * into permission_record from public.office_permission_catalog p
  where p.code=p_permission and p.active=true;
  if not found then return false; end if;

  verdict:=public.office_department_permission_verdict(p_user_id,p_permission);
  if verdict='DENY' then return false; end if;

  if exists(
    select 1 from public.office_user_permission_overrides o
    where o.user_id=p_user_id and o.permission_code=p_permission and o.effect='DENY'
      and (o.expires_at is null or o.expires_at>now())
      and public.office_scope_matches(o.scope_type,o.scope_key,
                                      p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  ) then return false; end if;

  if permission_record.owner_bypass is distinct from false and (
    verdict='DEPARTMENT_OWNER' or exists(
      select 1 from public.office_user_roles r where r.user_id=p_user_id
      and r.role='OWNER' and (r.expires_at is null or r.expires_at>now())
    )
  ) then return true; end if;

  if exists(
    select 1 from public.office_user_permission_overrides o
    where o.user_id=p_user_id and o.permission_code=p_permission and o.effect='ALLOW'
      and (o.expires_at is null or o.expires_at>now())
      and public.office_scope_matches(o.scope_type,o.scope_key,
                                      p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  ) then return true; end if;

  return exists(
    select 1 from public.office_user_access_profiles up
    join public.office_access_profile_permissions pp on
       pp.profile_code=up.profile_code and pp.permission_code=p_permission and pp.effect='ALLOW'
    where up.user_id=p_user_id and up.status='ACTIVE'
      and (up.effective_from is null or up.effective_from<=now())
      and (up.expires_at is null or up.expires_at>now())
      and public.office_scope_matches(up.scope_type,up.scope_key,
                                      p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  );
end; $$;

-- Do not extend this authority to browsers, anon or ordinary authenticated users.
revoke all on function public.office_effective_permission(uuid,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.office_effective_permission(uuid,text,text,text,uuid) to service_role;
