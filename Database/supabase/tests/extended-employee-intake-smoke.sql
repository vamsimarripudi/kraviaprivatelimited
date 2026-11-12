-- Assert private data boundaries and backwards-compatible migration.
do $verify$
declare
  rec record;
  rejected boolean;
begin
  if has_table_privilege('anon','public.office_employee_intake_profiles','SELECT') or
     has_table_privilege('authenticated','public.office_employee_intake_profiles','SELECT') or
     has_table_privilege('anon','public.office_employee_intake_profiles','INSERT') or
     has_table_privilege('authenticated','public.office_employee_intake_profiles','UPDATE') then
    raise exception 'Private intake leaked to browser roles';
  end if;
  if not has_table_privilege('service_role','public.office_employee_intake_profiles','SELECT') or
     not has_table_privilege('service_role','public.office_employee_intake_profiles','UPDATE') then
    raise exception 'Authorised backend lost intake read/write permission';
  end if;
  select legal_name,status,emergency_contacts,prior_experience,tax_declarations
  into rec from public.office_employee_intake_profiles
    where employee_user_id='a0000000-0000-4000-8000-000000000001';
  if rec.legal_name!='Synthetic isolated CI record' or rec.status!='DRAFT' or
     rec.emergency_contacts!='[]'::jsonb or rec.prior_experience!='[]'::jsonb or
     rec.tax_declarations!='{}'::jsonb then
    raise exception 'Existing private employee row was not preserved';
  end if;
  update public.office_employee_intake_profiles set
    emergency_contacts='[{"name":"Example Person","relation":"Family","phone":"0000000000"}]'::jsonb,
    prior_experience='[{"organisation":"Example","position":"Engineer"}]'::jsonb,
    tax_declarations='{"tax_residency":"UNDECLARED"}'::jsonb
    where employee_user_id='a0000000-0000-4000-8000-000000000001';
  rejected:=false;
  begin
    update public.office_employee_intake_profiles
      set emergency_contacts='[{}, {}, {}, {}, {}]'::jsonb
      where employee_user_id='a0000000-0000-4000-8000-000000000001';
  exception when check_violation then rejected:=true;
  end;
  if not rejected then raise exception 'Emergency contact length limit bypassed'; end if;
  rejected:=false;
  begin
    update public.office_employee_intake_profiles set tax_declarations='[]'::jsonb
      where employee_user_id='a0000000-0000-4000-8000-000000000001';
  exception when check_violation then rejected:=true;
  end;
  if not rejected then raise exception 'Tax declaration shape was not enforced'; end if;
  if not (select relrowsecurity from pg_class where oid='public.office_employee_intake_profiles'::regclass) then
    raise exception 'Row-level security is disabled on private intake';
  end if;
end;
$verify$;
select 'KRAVIA_EXTENDED_INTAKE_VERIFIED' as result;
