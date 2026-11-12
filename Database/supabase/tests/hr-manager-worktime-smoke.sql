-- Ephemeral PostgreSQL fixture only. Never use these synthetic actors in production.
begin;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
values('HR_MANAGER','people.update','ALLOW','COMPANY');

insert into public.office_user_access_profiles(user_id,profile_code,scope_type,scope_key,status,effective_from)
values('f0000000-0000-4000-8000-000000000002','HR_MANAGER','COMPANY',null,'ACTIVE',now()+interval '1 day');

do $$
begin
  begin
    perform public.office_worktime_submit(
      'f0000000-0000-4000-8000-000000000002',
      'f0000000-0000-4000-8000-000000000004',
      null,'2026-08-03 04:30:00+00'::timestamptz,'2026-08-03 10:30:00+00'::timestamptz,
      '[]'::jsonb,'HISTORICAL_CORRECTION','HR-AUGUST-2026-EVIDENCE',
      'Past evidence must be independently reviewed'
    );
    raise exception 'Future HR grant bypassed effective date';
  exception when others then
    if sqlerrm not like '%Employee or authorised HR Manager may propose%' then raise; end if;
  end;
end $$;

update public.office_user_access_profiles
set effective_from=now()-interval '1 day'
where user_id='f0000000-0000-4000-8000-000000000002' and profile_code='HR_MANAGER';

do $$
declare case_id uuid;
begin
  case_id:=public.office_worktime_submit(
    'f0000000-0000-4000-8000-000000000002',
    'f0000000-0000-4000-8000-000000000004',
    null,'2026-08-03 04:30:00+00'::timestamptz,'2026-08-03 10:30:00+00'::timestamptz,
    '[]'::jsonb,'HISTORICAL_CORRECTION','HR-AUGUST-2026-EVIDENCE',
    'Past evidence must be independently reviewed'
  );
  if case_id is null then raise exception 'Effective HR grant could not file evidence'; end if;

  begin
    perform public.office_worktime_decide(
      'f0000000-0000-4000-8000-000000000002',
      case_id,'APPROVE','Not independent');
    raise exception 'HR submitted and approved the same claim';
  exception when others then
    if sqlerrm not like '%Worktime cannot be self-approved%' then raise; end if;
  end;

  perform public.office_worktime_decide(
    'f0000000-0000-4000-8000-000000000003',
    case_id,'APPROVE','Separate authorised reviewer verified synthetic evidence');

  if not exists(select 1 from public.office_worktime_review_cases
      where id=case_id and status='APPROVED' and
      reviewed_by='f0000000-0000-4000-8000-000000000003') then
    raise exception 'Independent HR correction approval failed'; end if;
end $$;

rollback;
select 'HR_WORKTIME_AUTHORITY_VERIFIED';
