-- Runs only in disposable CI PostgreSQL. No live HR wages are generated.
do $hr_import_qa$
declare
  uploader constant uuid := 'f0000000-0000-4000-8000-000000000003';
  reviewer constant uuid := 'f0000000-0000-4000-8000-000000000005';
  employee constant uuid := 'f0000000-0000-4000-8000-000000000004';
  v_batch uuid;
  first_row uuid;
  second_batch uuid;
  blocked boolean;
  source jsonb:=jsonb_build_array(jsonb_build_object(
    'key','Oct 2026:15','sheet','Oct 2026','row',15,
    'employee_user_id',employee,'work_date','2026-10-19',
    'payable_minutes',360,'paid_leave_minutes',0,
    'overtime_candidate_minutes',0,'evidence_reference','HR-SIGNED-PHYSICAL-REGISTER',
    'workbook_decision','APPROVED','source_status','NO EVIDENCE — NOT ABSENT'));
begin
  -- Both identities hold current director authority. Only a different
  -- director may accept a record uploaded by the first.
  insert into public.office_identity_users(user_id,display_name,status)
    values(reviewer,'Second Independent Reviewer','ACTIVE');
  insert into public.office_user_roles(user_id,role)
    values(reviewer,'DIRECTOR');
  insert into public.office_user_access_profiles(user_id,profile_code,scope_type,scope_key,status)
    values(reviewer,'TEST_DIRECTOR_FINANCE','COMPANY',null,'ACTIVE');
  insert into public.office_employment_registry(
    employment_code,identity_user_id,status,start_date)
    values('HR-IMPORT-EMP-1',employee,'ACTIVE','2026-08-01');
  v_batch:=public.office_hr_attendance_import_stage(
    uploader,'KRAVIA-test.xlsx',repeat('a',64),source);
  if not exists(select 1 from public.office_hr_attendance_import_rows
    where batch_id=v_batch and status='PENDING' and payable_candidate_minutes=360) then
    raise exception 'Staged hours missing from independent HR review'; end if;
  select id into first_row from public.office_hr_attendance_import_rows
    where batch_id=v_batch;

  blocked:=false;
  begin
    perform public.office_hr_attendance_import_review(
      uploader,first_row,'ACCEPT','Attempted workbook uploader self approval');
  exception when others then blocked:=true;end;
  if not blocked then raise exception 'Workbook uploader self-approved their own evidence';end if;
  blocked:=false;
  begin
    perform public.office_hr_attendance_import_review(
      employee,first_row,'ACCEPT','Employee should never approve own source');
  exception when others then blocked:=true;end;
  if not blocked then raise exception 'Workbook beneficiary self-approved their own evidence';end if;

  if public.office_hr_attendance_import_review(
      reviewer,first_row,'ACCEPT','Independently checked signed physical attendance register')
    <> 'ACCEPTED' then raise exception 'Independent evidence acceptance failed';end if;
  if not exists(select 1 from public.office_hr_attendance_import_rows
    where id=first_row and status='ACCEPTED' and reviewed_by=reviewer) then
    raise exception 'Accepted review metadata missing';end if;
  if exists(select 1 from public.office_payroll_results) then
    raise exception 'Spreadsheet import generated unauthorized payroll';end if;
  if exists(select 1 from public.office_worktime_review_cases) then
    raise exception 'Spreadsheet import fabricated time intervals';end if;

  blocked:=false;
  begin
    perform public.office_hr_attendance_import_stage(
      uploader,'KRAVIA-test.xlsx',repeat('a',64),source);
  exception when unique_violation then blocked:=true;end;
  if not blocked then raise exception 'Same file was imported twice';end if;

  second_batch:=public.office_hr_attendance_import_stage(
    uploader,'KRAVIA-test-v2.xlsx',repeat('b',64),source);
  blocked:=false;
  begin
    perform public.office_hr_attendance_import_review(
      reviewer,(select id from public.office_hr_attendance_import_rows where batch_id=second_batch),
      'ACCEPT','Different upload with the same employee date must be rejected');
  exception when unique_violation then blocked:=true;end;
  if not blocked then raise exception 'Duplicate accepted employee-day bypassed uniqueness';end if;

  blocked:=false;
  begin
    perform public.office_hr_attendance_import_stage(
      uploader,'FUTURE.xlsx',repeat('c',64),
      jsonb_set(source,'{0,work_date}','"2028-05-20"'::jsonb));
  exception when others then blocked:=true;end;
  if not blocked then raise exception 'Future payroll source was staged';end if;
end;
$hr_import_qa$;
select 'HR_WORKBOOK_REVIEW_GUARDS_VERIFIED' as result;
