\set ON_ERROR_STOP on
-- Disposable PostgreSQL only, using the existing synthetic handover fixture.
\ir department-handover-access-sync.sql

-- Simulate six departments assigned to the same active company administrator
-- (sample IDs only; no real user or production records).
create or replace function public.office_department_for_permission(p_permission text)
returns text language sql stable as $$
 select case
   when p.code='finance.bank.read' then 'FINANCE'
   when p.code='people.sensitive.read' then 'PEOPLE'
   when p.module='FINANCE' then 'FINANCE'
   when p.module='PEOPLE' then 'PEOPLE'
   when p.module='PORTFOLIO' or p.module='MASTER_DATA' then 'PRODUCT'
   when p.module='STRATEGY' then 'EXECUTIVE'
   when p.module='SECURITY' then 'SECURITY'
   when p.module='SUPPORT' then 'SUPPORT'
   when p.module='CUSTOMER_TRUST' then 'CUSTOMER_SUCCESS'
   when p.module='SECRETARIAL' or p.module='REGISTRATIONS' then 'SECRETARIAL'
   when p.module='OPERATIONS' then 'OPERATIONS'
   when p.module='FACILITIES' then 'ADMINISTRATION' -- historical wrong mapping overwritten by the tested migration
   when p.module='COMPLIANCE' then 'LEGAL'
   else null end
 from public.office_permission_catalog p where p.code=p_permission and p.active;
$$;
insert into public.office_department_ownership(department_code,owner_user_id)
 values
 ('SUPPORT','00000000-0000-0000-0000-000000000002'),
 ('CUSTOMER_SUCCESS','00000000-0000-0000-0000-000000000002'),
 ('SECRETARIAL','00000000-0000-0000-0000-000000000002'),
 ('OPERATIONS','00000000-0000-0000-0000-000000000002'),
 ('LEGAL','00000000-0000-0000-0000-000000000002'),
 ('SECURITY','00000000-0000-0000-0000-000000000002');
insert into public.office_permission_catalog(code,module,action,active,owner_bypass,high_risk)
 values
 ('support.case.read','SUPPORT','READ',true,true,false),
 ('support.case.manage','SUPPORT','MANAGE',true,true,false),
 ('customer.trust.read','CUSTOMER_TRUST','READ_TRUST',true,true,false),
 ('customer.trust.manage','CUSTOMER_TRUST','MANAGE_TRUST',true,true,true),
 ('secretarial.board.read','SECRETARIAL','READ_BOARD',true,true,false),
 ('secretarial.board.manage','SECRETARIAL','MANAGE_BOARD',true,true,true),
 ('registration.read','REGISTRATIONS','READ',true,true,false),
 ('compliance.rules.read','COMPLIANCE','READ_RULES',true,true,false),
 ('operations.asset.read','OPERATIONS','READ_ASSET',true,true,false),
 ('facilities.room.read','FACILITIES','READ_ROOMS',true,true,false),
 ('facilities.manage','FACILITIES','MANAGE_FACILITIES',true,true,true),
 ('operations.bank.read','OPERATIONS','READ',true,true,false),
 ('finance.customer.read','FINANCE','READ',true,true,false),
 ('customer.trust.sensitive.read','CUSTOMER_TRUST','READ',true,true,true),
 ('customer.trust.hidden.read','CUSTOMER_TRUST','READ',true,false,false)
 on conflict(code) do nothing;

\ir ../migrations/20261117090000_department_owner_module_reads.sql
-- Reapplying the replacement must be idempotent.
\ir ../migrations/20261117090000_department_owner_module_reads.sql

do $smoke$
declare multi uuid:='00000000-0000-0000-0000-000000000002';
        founder uuid:='00000000-0000-0000-0000-000000000001';
        unrelated uuid:='00000000-0000-0000-0000-000000000003';
        perm text;
begin
 foreach perm in array array[
   'support.case.read',
   'customer.trust.read',
   'secretarial.board.read',
   'registration.read',
   'compliance.rules.read',
   'operations.asset.read',
   'facilities.room.read',
   'security.overview.read'
 ] loop
  if public.office_department_permission_verdict(multi,perm)<>'DEPARTMENT_OWNER' then
    raise exception 'Active owner missing explicit module read: %',perm;
  end if;
  if public.office_department_permission_verdict(unrelated,perm)<>'DEFAULT' then
    raise exception 'Unrelated employee obtained module read: %',perm;
  end if;
  if public.office_department_permission_verdict(founder,perm)='DEPARTMENT_OWNER' then
    raise exception 'Unrelated Founder obtained owner read: %',perm;
  end if;
 end loop;
 foreach perm in array array[
   'operations.bank.read',
   'finance.customer.read',
   'people.sensitive.read',
   'finance.bank.read',
   'customer.trust.sensitive.read',
   'customer.trust.hidden.read'
 ] loop
  if public.office_department_permission_verdict(multi,perm)<>'DEFAULT' then
    raise exception 'Sensitive, unrelated or non-bypass read elevated: %',perm;
  end if;
 end loop;
 if public.office_department_for_permission('facilities.room.read')<>'OPERATIONS' then
   raise exception 'Facilities permission map still points to unassigned Administration';
 end if;
 if public.office_department_permission_verdict(multi,'customer.trust.manage')<>'DEPARTMENT_OWNER'
    or public.office_department_permission_verdict(multi,'secretarial.board.manage')<>'DEPARTMENT_OWNER'
    or public.office_department_permission_verdict(multi,'facilities.manage')<>'DEPARTMENT_OWNER' then
   raise exception 'Existing owner write gates were accidentally removed';
 end if;
 if has_function_privilege('anon','public.office_department_for_permission(text)','EXECUTE')
 or has_function_privilege('authenticated','public.office_department_for_permission(text)','EXECUTE') then
   raise exception 'Supporting department permission map exposed to clients';
 end if;
 if has_function_privilege('anon','public.office_department_permission_verdict(uuid,text)','EXECUTE')
 or has_function_privilege('authenticated','public.office_department_permission_verdict(uuid,text)','EXECUTE') then
   raise exception 'Department security definer exposed to browser roles';
 end if;
 if not has_function_privilege('service_role','public.office_department_permission_verdict(uuid,text)','EXECUTE') then
   raise exception 'Trusted service execution grant missing';
 end if;
end $smoke$;
select 'SIX_DEPARTMENT_OWNER_READ_SCOPE_VERIFIED' as result;
