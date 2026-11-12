-- Dedicated disposable-fixture smoke. Never run against a real employee.
begin;

-- A future grant cannot authorize a People mutation even when its status is ACTIVE.
update public.office_user_access_profiles
set effective_from=now()+interval '1 day'
where user_id='f0000000-0000-4000-8000-000000000003'
  and profile_code='TEST_DIRECTOR_FINANCE';
do $$
begin
  if public.office_effective_permission(
    'f0000000-0000-4000-8000-000000000003', 'people.update',
    'COMPANY',null,null
  ) then
    raise exception 'Future-effective HR grant became usable too early';
  end if;
end $$;

-- Past effective grants retain the original permission and independent role checks.
update public.office_user_access_profiles
set effective_from=now()-interval '1 day'
where user_id='f0000000-0000-4000-8000-000000000003'
  and profile_code='TEST_DIRECTOR_FINANCE';
do $$
begin
  if not public.office_effective_permission(
    'f0000000-0000-4000-8000-000000000003', 'people.update',
    'COMPANY',null,null
  ) then
    raise exception 'Effective HR grant is wrongly denied';
  end if;
end $$;

rollback;
select 'FUTURE_HR_ACCESS_VERIFIED' as result;
