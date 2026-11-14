-- Independent maker/checker/Owner payroll finalization in disposable PostgreSQL.
DO $qa$
DECLARE
  maker constant uuid := 'f0000000-0000-4000-8000-000000000004';
  finance constant uuid := 'f0000000-0000-4000-8000-000000000003';
  founder constant uuid := 'f0000000-0000-4000-8000-000000000001';
  v_request uuid;
  v_period uuid;
  v_review uuid;
  v_owner uuid;
  blocked boolean;
BEGIN
  insert into public.office_requests(status,requester_user_id)
    values('APPROVED',maker) returning id into v_request;
  insert into public.office_payroll_periods(period_code,starts_on,ends_on,status,approval_request_id)
    values('HR-CHECKER-2026-10','2026-10-01','2026-10-31','PENDING_REVIEW',v_request)
    returning id into v_period;
  insert into public.office_request_steps(request_id,step_code,step_order,status,decision_by)
    values(v_request,'PAYROLL_REVIEW',1,'APPROVED',maker)
    returning id into v_review;
  insert into public.office_request_steps(request_id,step_code,step_order,status,decision_by)
    values(v_request,'OWNER_APPROVAL',2,'APPROVED',founder)
    returning id into v_owner;
  blocked := false;
  begin
    perform public.office_payroll_maker_checker_guard(v_period,v_request);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Payroll maker approved own Finance review'; end if;

  update public.office_request_steps set decision_by=finance where id=v_review;
  perform public.office_payroll_maker_checker_guard(v_period,v_request);
  update public.office_request_steps set decision_by=finance where id=v_owner;
  blocked := false;
  begin
    perform public.office_payroll_maker_checker_guard(v_period,v_request);
  exception when others then blocked := true; end;
  if not blocked then raise exception 'Finance reviewer also approved final Owner step'; end if;

  update public.office_request_steps set decision_by=founder where id=v_owner;
  perform public.office_payroll_maker_checker_guard(v_period,v_request);
END;
$qa$;
SELECT 'HR_PAYROLL_MAKER_CHECKER_VERIFIED' AS result;
