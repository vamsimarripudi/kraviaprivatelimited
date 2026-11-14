-- KRAVIA Office: accepted department transfers must be usable immediately.
-- Additive and safe for existing transfers. No employee roles or department
-- owner records are created or reassigned by this migration.
-- Only selected, non-sensitive baseline *read* capabilities accompany a
-- formally accepted department ownership transfer.

create or replace function public.office_department_permission_verdict(
  p_actor uuid, p_permission text
) returns text language plpgsql stable security definer set search_path='' as $$
declare
  department text;
  permission_action text;
  current_owner uuid;
  baseline_read_allowed boolean;
begin
  select p.action into permission_action
  from public.office_permission_catalog p
  where p.code=p_permission and p.active=true;
  if permission_action is null then return 'DENY'; end if;

  department:=public.office_department_for_permission(p_permission);
  if department is null then return 'DEFAULT'; end if;

  select o.owner_user_id into current_owner
  from public.office_department_ownership o
  where o.department_code=department;

  if permission_action='VIEW' or permission_action='AUDIT_USAGE'
      or permission_action like 'READ%' then
    -- The role owner needs selected baseline overview reads to enter their
    -- workspace. No sensitive HR, bank, payroll, ethics or security reads are
    -- conferred by this rule.
    select exists(
      select 1 from public.office_permission_catalog p
      where p.code=p_permission and p.active=true
        and p.high_risk=false and p.owner_bypass is distinct from false
        and p.code in (
          'finance.read',
          'people.basic.read',
          'master.product.read',
          'portfolio.read',
          'strategy.read'
        )
    ) into baseline_read_allowed;
    if baseline_read_allowed and current_owner=p_actor and exists(
      select 1 from public.office_identity_users i
      where i.user_id=p_actor and i.status='ACTIVE'
    ) then
      return 'DEPARTMENT_OWNER';
    end if;
    return 'DEFAULT';
  end if;

  if current_owner is null then return 'DEFAULT'; end if;
  if current_owner=p_actor then
    if exists(
      select 1 from public.office_permission_catalog p
      where p.code=p_permission and p.owner_bypass is distinct from false
    ) then return 'DEPARTMENT_OWNER'; end if;
    return 'DEFAULT';
  end if;

  if exists(
    select 1 from public.office_department_former_owners f
    where f.department_code=department and f.user_id=p_actor
  ) or exists(
    select 1 from public.office_user_roles r
    where r.user_id=p_actor and r.role='OWNER'
      and (r.expires_at is null or r.expires_at>now())
  ) then return 'DENY'; end if;

  return 'DEFAULT';
end;
$$;

-- This is a role-authority revision, not an invitation or a profile grant.
-- Authenticated sessions obtain fresh authorization_version through the
-- existing first-party /auth/session response; the UI prompts re-login only
-- after all transfers addressed to that employee have been accepted.
create or replace function public.office_department_acceptance_authz_bump()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='PENDING' and new.status='ACCEPTED' then
    update public.office_identity_users i
      set authorization_version=i.authorization_version+1,
          last_role_change_at=now()
    where i.user_id in (new.from_owner_user_id,new.to_owner_user_id)
      and i.status='ACTIVE';
  end if;
  return new;
end;
$$;

drop trigger if exists office_department_acceptance_authz_bump
  on public.office_department_transfer_requests;
create trigger office_department_acceptance_authz_bump
after update of status on public.office_department_transfer_requests
for each row execute function public.office_department_acceptance_authz_bump();

-- One-time catch-up for transfers accepted before this trigger was installed.
-- Re-running will not re-bump users whose last authority review is newer
-- than their accepted transfer. No direct grant or transfer is made.
with accepted_participants as (
  select from_owner_user_id as user_id, max(decided_at) as latest_accept
    from public.office_department_transfer_requests
    where status='ACCEPTED' and decided_at is not null
    group by from_owner_user_id
  union all
  select to_owner_user_id as user_id, max(decided_at) as latest_accept
    from public.office_department_transfer_requests
    where status='ACCEPTED' and decided_at is not null
    group by to_owner_user_id
), latest as (
  select user_id,max(latest_accept) as accepted_at
  from accepted_participants group by user_id
)
update public.office_identity_users i
set authorization_version=i.authorization_version+1,
    last_role_change_at=now()
from latest l
where i.user_id=l.user_id and i.status='ACTIVE'
  and (i.last_role_change_at is null or i.last_role_change_at<l.accepted_at);

-- Preserve existing function privileges, explicitly deny direct browser RPC
-- invocation of these privileged control-plane procedures.
revoke all on function public.office_department_permission_verdict(uuid,text)
  from public,anon,authenticated;
revoke all on function public.office_department_acceptance_authz_bump()
  from public,anon,authenticated;
grant execute on function public.office_department_permission_verdict(uuid,text)
  to service_role;
grant execute on function public.office_department_permission_verdict(uuid,text)
  to kravia_office_backend;
-- Trigger functions do not need direct execution rights by any browser role.
