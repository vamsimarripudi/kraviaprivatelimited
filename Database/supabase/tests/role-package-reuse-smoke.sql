-- Isolated business-flow proof for the generic role package composer.
begin;
do $$
declare
 founder uuid:='f0000000-0000-4000-8000-000000000001';
 recipient uuid:='f0000000-0000-4000-8000-000000000002';
 employee uuid:='f0000000-0000-4000-8000-000000000004';
 package uuid; newer uuid; application uuid; second_application uuid; task uuid; transfer uuid;
 delegated_package uuid; delegated_application uuid;
begin
 package:=public.office_role_package_create(
   founder,'GENERIC_TECH_TEAM','Reusable engineering contributor',
   'Canonical department/position profile, scope and checklist package.',
   'ENGINEERING','FULL_STACK_DEV','EMPLOYEE',
   '["Deliver assigned product features","Record implementation and security evidence"]'::jsonb,
   '[{"position_code":"SALES_HEAD","department_code":"SALES","responsibilities":["Support approved sales workflows"]}]'::jsonb,
   '[{"profile_code":"ENGINEERING_MANAGER","scope_type":"DEPARTMENT","scope_key":"ENGINEERING"}]'::jsonb,
   '[{"code":"IDENTITY_VERIFIED","label":"Verify identity","required":true},{"code":"APPOINTMENT_SIGNED","label":"Verify signed appointment","required":true},{"code":"POLICIES_ACKNOWLEDGED","label":"Company policies acknowledged","required":true},{"code":"BANK_DETAILS_REVIEWED","label":"Verify payroll banking evidence","required":true}]'::jsonb,
   '{"days":["MON","TUE","WED","THU","FRI"],"daily_minutes":360,"weekly_minutes":1800,"flexible":true,"time_zone":"Asia/Kolkata"}'::jsonb
 );
 if (select status from public.office_role_packages where id=package)<>'DRAFT' then
   raise exception 'Package was improperly made active without publishing'; end if;
 if public.office_role_package_publish(founder,package)<>'ACTIVE' then
   raise exception 'Reusable package did not publish'; end if;
 if exists(select 1 from public.office_employee_role_package_applications) then
   raise exception 'Publishing a package changed employee records'; end if;
 application:=public.office_role_package_apply(founder,employee,package,'Approved engineering role and existing access scopes');
 if application is null then raise exception 'Application not created'; end if;
 if public.office_role_package_apply(founder,employee,package,'Repeat idempotent request')<>application then
   raise exception 'Reapplication was not idempotent'; end if;
 second_application:=public.office_role_package_apply(
   founder,recipient,package,'Same published package reused for second verified employee');
 if second_application is null or second_application=application then
   raise exception 'A reusable package must create separate employee applications'; end if;
 if (select count(*) from public.office_employee_role_package_applications
     where package_id=package)<>2 then
   raise exception 'Reusable package failed to serve two employees'; end if;
 if (select position_code from public.office_job_assignments where user_id=employee)<>'FULL_STACK_DEV'
    or (select department_code from public.office_job_assignments where user_id=employee)<>'ENGINEERING'
    then raise exception 'Canonical primary position not assigned'; end if;
 if (select count(*) from public.office_user_access_profiles
      where user_id=employee and scope_type='DEPARTMENT' and scope_key='ENGINEERING' and expires_at is null)<>1 then
   raise exception 'Scoped permanent access profile not applied exactly once'; end if;
 if (select count(*) from public.office_employee_functional_positions
      where employee_user_id=employee and position_code='SALES_HEAD' and department_code='SALES' and active)<>1 then
   raise exception 'Additional functional position missing'; end if;
 if (select count(*) from public.office_role_package_onboarding_tasks
      where application_id=application and status='PENDING')<>4 then
   raise exception 'Onboarding checklist was not created as pending'; end if;
 if (select snapshot_sha256 from public.office_employee_role_package_applications
      where id=application) <> (
        select encode(extensions.digest(convert_to(snapshot::text,'UTF8'),'sha256'),'hex')
        from public.office_employee_role_package_applications where id=application
      ) then raise exception 'Immutable snapshot integrity failed'; end if;
 if exists(select 1 from public.office_department_ownership) then
   raise exception 'Role package incorrectly transferred a department'; end if;
 begin
   update public.office_employee_role_package_applications set snapshot='{}'::jsonb where id=application;
   raise exception 'Applied role snapshot incorrectly mutable';
 exception when others then
   if sqlerrm='Applied role snapshot incorrectly mutable' then raise; end if;
 end;
 select id into task from public.office_role_package_onboarding_tasks where application_id=application
   and task_code='IDENTITY_VERIFIED';
 if public.office_role_package_task_decide(employee,task,'SUBMIT','DOCUMENT-REF-001',null)<>'SUBMITTED'
   then raise exception 'Employee could not submit evidence'; end if;
 begin
   perform public.office_role_package_task_decide(employee,task,'VERIFY',null,'Own work');
   raise exception 'Employee self-verified their own onboarding task';
 exception when others then if sqlerrm='Employee self-verified their own onboarding task' then raise; end if;
 end;
 if public.office_role_package_task_decide(founder,task,'VERIFY',null,'Evidence independently checked')<>'VERIFIED'
   then raise exception 'Independent document verification failed'; end if;
 if exists(select 1 from public.office_role_package_onboarding_tasks
     where application_id=application and required and status='WAIVED') then
   raise exception 'Required document was waived'; end if;
 begin
   perform public.office_role_package_create(
     founder,'COMPANY_BYPASS','Company-wide grant should be denied',
     'Reusable packages must never bypass transferred department ownership.',
     'ENGINEERING','FULL_STACK_DEV','EMPLOYEE','[]'::jsonb,'[]'::jsonb,
     '[{"profile_code":"ENGINEERING_MANAGER","scope_type":"COMPANY"}]'::jsonb,
     '[]'::jsonb,
     '{"days":["MON","TUE","WED","THU","FRI"],"daily_minutes":360,"weekly_minutes":1800,"flexible":true,"time_zone":"Asia/Kolkata"}'::jsonb);
   raise exception 'Unsafe company-wide package was permitted';
 exception when others then
   if sqlerrm='Unsafe company-wide package was permitted' then raise; end if;
 end;
 newer:=public.office_role_package_create(
   founder,'GENERIC_TECH_TEAM','Reusable engineering contributor V2',
   'New version must not retroactively mutate a previous employee snapshot.',
   'ENGINEERING','FRONTEND_DEV','EMPLOYEE',
   '["Deliver assigned frontend features"]'::jsonb,'[]'::jsonb,
   '[{"profile_code":"FRONTEND_EDITOR","scope_type":"DEPARTMENT","scope_key":"ENGINEERING"}]'::jsonb,
   '[{"code":"IDENTITY_VERIFIED","label":"Verify identity","required":true},{"code":"APPOINTMENT_SIGNED","label":"Verify signed appointment","required":true},{"code":"POLICIES_ACKNOWLEDGED","label":"Company policies acknowledged","required":true},{"code":"BANK_DETAILS_REVIEWED","label":"Verify payroll banking evidence","required":true}]'::jsonb,
   '{"days":["MON","TUE","WED","THU","FRI"],"daily_minutes":360,"weekly_minutes":1800,"flexible":true,"time_zone":"Asia/Kolkata"}'::jsonb
 );
 if (select version from public.office_role_packages where id=newer)<>2 then
   raise exception 'Role package did not increment version'; end if;
 perform public.office_role_package_publish(founder,newer);
 if (select status from public.office_role_packages where id=package)<>'RETIRED' then
   raise exception 'Previous package version not retired'; end if;
 if (select snapshot->>'primary_position_code' from public.office_employee_role_package_applications
      where id=application)<>'FULL_STACK_DEV' then
   raise exception 'New template revision silently changed historical employee assignment'; end if;
 if has_table_privilege('anon','public.office_role_packages','SELECT') or
    has_table_privilege('authenticated','public.office_role_package_onboarding_tasks','SELECT') or
    has_function_privilege('anon','public.office_role_package_apply(uuid,uuid,uuid,text)','EXECUTE') then
    raise exception 'Role packages unexpectedly exposed to browser database roles'; end if;
 transfer:=public.office_department_transfer_propose(
   founder,'ENGINEERING',recipient,'Permanent handover of Engineering ownership');
 perform public.office_department_transfer_accept(recipient,transfer);
 -- The recipient has MEMBER role, not company-wide ADMIN. After accepting
 -- Engineering ownership they can package and assign only Engineering work.
 delegated_package:=public.office_role_package_create(
   recipient,'SCOPED_ENGINEERING_HEAD','Scoped Engineering contributor',
   'Delegated permanent Engineering head can assign existing verified team.',
   'ENGINEERING','FRONTEND_DEV','EMPLOYEE',
   '["Implement scoped Engineering work","Record reviewable delivery evidence"]'::jsonb,
   '[]'::jsonb,
   '[{"profile_code":"FRONTEND_EDITOR","scope_type":"DEPARTMENT","scope_key":"ENGINEERING"}]'::jsonb,
   '[{"code":"IDENTITY_VERIFIED","label":"Verify identity","required":true},{"code":"APPOINTMENT_SIGNED","label":"Verify signed appointment","required":true},{"code":"POLICIES_ACKNOWLEDGED","label":"Acknowledge company policy","required":true},{"code":"BANK_DETAILS_REVIEWED","label":"Review bank identity evidence","required":true}]'::jsonb,
   '{"days":["MON","TUE","WED","THU","FRI"],"daily_minutes":360,"weekly_minutes":1800,"flexible":true,"time_zone":"Asia/Kolkata"}'::jsonb);
 if public.office_role_package_publish(recipient,delegated_package)<>'ACTIVE'
   then raise exception 'Accepted department head could not publish owned package'; end if;
 delegated_application:=public.office_role_package_apply(recipient,employee,delegated_package,
   'Scoped access and engineering duties granted by the accepted department head');
 if delegated_application is null or not exists(
   select 1 from public.office_access_audit a
   where a.actor_user_id=recipient and a.target_user_id=employee
      and a.action='PROFILE_ASSIGNED' and a.department='ENGINEERING'
 ) then raise exception 'Delegated Engineer owner did not produce audited scoped assignment'; end if;
 select id into task from public.office_role_package_onboarding_tasks
   where application_id=delegated_application and task_code='IDENTITY_VERIFIED';
 if public.office_role_package_task_decide(employee,task,'SUBMIT','EMPLOYEE-EVIDENCE-DELEGATED',null)<>'SUBMITTED'
   then raise exception 'Employee could not submit to delegated department owner'; end if;
 if public.office_role_package_task_decide(recipient,task,'VERIFY',null,
     'Existing verified identity evidence independently reviewed')<>'VERIFIED' then
   raise exception 'Department head could not approve own team evidence'; end if;
 if (select position_code from public.office_job_assignments where user_id=employee)<>'FRONTEND_DEV'
    then raise exception 'Delegated job write did not update primary position'; end if;
 if exists(select 1 from public.office_user_roles r where r.user_id=recipient
    and r.role in ('OWNER','ADMIN')) then raise exception 'Department head was improperly elevated'; end if;

 begin
   perform public.office_role_package_create(
     founder,'TRY_BYPASS','Should be rejected','Cannot bypass transferred department',
     'ENGINEERING','FULL_STACK_DEV','EMPLOYEE',
     '[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
     '{"days":["MON"],"daily_minutes":360,"weekly_minutes":360,"flexible":true,"time_zone":"Asia/Kolkata"}'::jsonb);
   raise exception 'Founder bypassed transfer to create Engineering package';
 exception when others then
   if sqlerrm='Founder bypassed transfer to create Engineering package' then raise; end if;
 end;
end $$;
rollback;
select 'REUSABLE_ROLE_PACKAGE_VERIFIED' as result;
