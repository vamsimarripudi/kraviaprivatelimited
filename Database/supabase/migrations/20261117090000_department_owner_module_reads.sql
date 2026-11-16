-- KRAVIA Office: restore minimum owner reads for the actual assigned departments.
-- No department ownership/roles/profiles are modified by this migration.
-- Company Secretary (CS) is SECRETARIAL, never Customer Support.
-- Managed-device checks, explicit DENY overrides, and maker-checker still
-- execute in the existing Office permission engine after this verdict.
-- Keep the ownership permission map aligned with the actual Office sections.
-- Facilities is an Operations workspace (the previous ADMINISTRATION mapping
-- accidentally denied Operations owners). Every mutation still retains the
-- managed-device, role and independent-approval checks of its domain API.
create or replace function public.office_department_for_permission(p_permission text)
returns text language sql stable security definer set search_path = '' as $function$
  select case
    when p.code in ('document.finance.create') then 'FINANCE'
    when p.code in ('document.hr.create') then 'PEOPLE'
    when p.code in ('document.legal.create') then 'LEGAL'
    when p.code in ('document.sales.create') then 'SALES'
    when p.code in ('document.operations.create') then 'OPERATIONS'
    when p.code in ('document.secretarial.create') then 'SECRETARIAL'
    when p.code in ('master.customer.create','master.customer.read') then 'SALES'
    when p.code in ('master.product.create','master.product.read') then 'PRODUCT'
    -- Security-owned resilience and AI consoles expose only these baseline
    -- reads; all sensitive reviews/mutations still require explicit authority.
    when p.code in ('resilience.read','ai.tool.read') then 'SECURITY'
    when p.module in ('FINANCE','PAYROLL','INSURANCE') then 'FINANCE'
    when p.module='ENGINEERING' then 'ENGINEERING'
    when p.module='INFRASTRUCTURE' then 'DEVOPS'
    when p.module in ('HIRING','PEOPLE','TRAVEL') then 'PEOPLE'
    when p.module='SALES' then 'SALES'
    when p.module='OPERATIONS' then 'OPERATIONS'
    when p.module='FACILITIES' then 'OPERATIONS'
    when p.module='PROCUREMENT' then 'PROCUREMENT'
    when p.module in ('PRODUCT','PORTFOLIO') then 'PRODUCT'
    when p.module='QUALITY' then 'QUALITY'
    when p.module='SUPPORT' then 'SUPPORT'
    when p.module='CUSTOMER_TRUST' then 'CUSTOMER_SUCCESS'
    when p.module='SECURITY' then 'SECURITY'
    when p.module in ('IT','IDENTITY') then 'IT'
    when p.module in ('LEGAL','PRIVACY','COMPLIANCE','ETHICS') then 'LEGAL'
    when p.module='SECRETARIAL' or p.module='REGISTRATIONS' then 'SECRETARIAL'
    when p.module='TAX' then 'TAX'
    when p.module in ('AUDIT','ASSURANCE') then 'AUDIT'
    when p.module in ('GOVERNANCE','STRATEGY') then 'EXECUTIVE'
    when p.module in ('ADMIN','KNOWLEDGE') then 'ADMINISTRATION'
    else null end
  from public.office_permission_catalog p
  where p.code=p_permission and p.active=true;
$function$;
revoke execute on function public.office_department_for_permission(text)
 from public,anon,authenticated;
grant execute on function public.office_department_for_permission(text)
 to service_role;
do $grant_permission_map$
begin
 if exists(select 1 from pg_roles where rolname='kravia_office_backend') then
   grant execute on function public.office_department_for_permission(text) to kravia_office_backend;
 end if;
end;
$grant_permission_map$;

create or replace function public.office_department_permission_verdict(
 p_actor uuid,p_permission text
) returns text language plpgsql stable security definer set search_path = '' as $function$
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
   -- Only the ACTIVE owner of the owning department receives the explicitly
   -- enumerated baseline read permission. Not broader company-wide reads.
   select exists(
     select 1 from public.office_permission_catalog p
     where p.code=p_permission and p.active=true
       and p.high_risk=false and p.owner_bypass is distinct from false
       and p.code in (
        'finance.read','people.basic.read','master.product.read',
        'portfolio.read','strategy.read',
        -- Actual owned workspaces (no Finance/HR or secrets data):
        'support.case.read',
        'customer.trust.read',
        'secretarial.board.read',
        'registration.read',
        'compliance.rules.read',
        'operations.asset.read',
        'facilities.room.read',
        'legal.obligation.read',
        'resilience.read',
        'ai.tool.read',
        'security.overview.read'
       )
   ) into baseline_read_allowed;
   if baseline_read_allowed and current_owner=p_actor and exists(
     select 1 from public.office_identity_users i
     where i.user_id=p_actor and i.status='ACTIVE'
   ) then return 'DEPARTMENT_OWNER'; end if;
   return 'DEFAULT';
 end if;
 if current_owner is null then return 'DEFAULT'; end if;
 if current_owner=p_actor then
   if exists(select 1 from public.office_permission_catalog p
     where p.code=p_permission and p.owner_bypass is distinct from false
   ) then return 'DEPARTMENT_OWNER'; end if;
   return 'DEFAULT';
 end if;
 if exists(select 1 from public.office_department_former_owners f
  where f.department_code=department and f.user_id=p_actor)
 or exists(select 1 from public.office_user_roles r
  where r.user_id=p_actor and r.role='OWNER'
   and (r.expires_at is null or r.expires_at>now()))
 then return 'DENY'; end if;
 return 'DEFAULT';
end;
$function$;

-- This RPC is service-only: a browser cannot invoke the security definer.
revoke execute on function public.office_department_permission_verdict(uuid,text)
 from public,anon,authenticated;
grant execute on function public.office_department_permission_verdict(uuid,text)
 to service_role;
-- Keep the separately defined controlled backend runtime role, if installed.
do $grant$
begin
 if exists(select 1 from pg_roles where rolname='kravia_office_backend') then
   grant execute on function public.office_department_permission_verdict(uuid,text) to kravia_office_backend;
 end if;
end;
$grant$;
