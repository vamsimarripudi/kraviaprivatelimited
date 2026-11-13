-- Disposable PostgreSQL-only simulated evidence; never execute on live staff.
-- A scheduler may record reminders only from real, positive source evidence.
-- This entire probe rolls back, and no provider I/O or recipient mail occurs.
BEGIN;
DO $disabled$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>49
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 49 mapped policies, all disabled, no prior messages';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_lifecycle_schedule_due(integer)','EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated','public.office_lifecycle_schedule_due(integer)','EXECUTE')
    OR pg_catalog.has_function_privilege('service_role','public.office_lifecycle_schedule_due(integer)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon','public.office_lifecycle_flex_evidence_verified(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Private scheduler or worktime evidence exposed to browser'; END IF;
END;
$disabled$;

UPDATE public.office_lifecycle_mail_policy
 SET enabled=true,
   approved_by='a0000000-0000-4000-8000-000000000001',
   approved_at=pg_catalog.now()-interval '2 minutes',
   effective_from=pg_catalog.now()-interval '1 minute'
 WHERE event_code IN ('AUTH-10','DEV-02','ONB-11','ONB-12','PAY-10','TIME-07');

-- A canonical employee in a first-week milestone and a separately confirmed
-- manager in a first-month milestone. Both records represent real dates here.
UPDATE public.office_employment_registry
 SET start_date=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-7
 WHERE identity_user_id='a0000000-0000-4000-8000-000000000002';
INSERT INTO public.office_employment_registry(
 identity_user_id,status,start_date,relationship_type
) VALUES(
 'a0000000-0000-4000-8000-000000000003','ACTIVE',
 (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-30,'EMPLOYEE'
);
INSERT INTO public.office_job_assignments(user_id,reports_to_user_id,status)
VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000003','ACTIVE'
),(
 'a0000000-0000-4000-8000-000000000003',
 'a0000000-0000-4000-8000-000000000001','ACTIVE'
);

UPDATE public.office_training_assignments
 SET due_on=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date+1
 WHERE id='d0000000-0000-4000-8000-000000000001';
-- A disabled identity MUST NOT receive a training reminder.
INSERT INTO public.office_training_assignments(
 id,user_id,status,due_on
) VALUES(
 'd0000000-0000-4000-8000-000000000019',
 'a0000000-0000-4000-8000-000000000004','ASSIGNED',
 (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date+1
);

-- One independently approved locked payroll outcome, with a real due date
-- that has just passed and NO independently verified bank credit.
INSERT INTO public.office_payroll_periods(id,period_code,status,pay_date)
VALUES(
 'f0000000-0000-4000-8000-000000000030','2026-09','APPROVED',
 (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-1
);
INSERT INTO public.office_payroll_results(
 id,period_id,employment_id,employee_user_id,status,net_pay_minor
) VALUES(
 'f0000000-0000-4000-8000-000000000031',
 'f0000000-0000-4000-8000-000000000030',
 'f0000000-0000-4000-8000-000000000003',
 'a0000000-0000-4000-8000-000000000002','LOCKED',5000
);
INSERT INTO public.office_department_ownership(department_code,owner_user_id)
VALUES('FINANCE','a0000000-0000-4000-8000-000000000003');

-- Account lock alert: one verified temporary lock event, no messages for
-- normal successful login or repeated attacker-triggered lock attempts.
UPDATE public.office_auth_users SET locked_until=pg_catalog.now()+interval '30 minutes'
WHERE id='a0000000-0000-4000-8000-000000000002';
INSERT INTO public.office_auth_events_v2(id,user_id,event_type,metadata_json)
VALUES(
 'synthetic_lock_01','a0000000-0000-4000-8000-000000000002',
 'LOGIN_BLOCKED','{"reason":"temporary_lock"}'
),(
 'synthetic_lock_02','a0000000-0000-4000-8000-000000000002',
 'LOGIN_BLOCKED','{"reason":"temporary_lock"}'
),(
 'synthetic_login_success','a0000000-0000-4000-8000-000000000002',
 'LOGIN_SUCCESS','{}'
);

-- An approved six-hour weekday record across five distinct calendar days,
-- not an arbitrary 30-hour value inserted into a Flex Day request.
UPDATE public.office_worktime_policy_versions
 SET status='APPROVED',approved_by='a0000000-0000-4000-8000-000000000001',
 approved_at=pg_catalog.now(),
 effective_from=(date_trunc('week',
   (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::date)-14
 WHERE id='b0000000-0000-4000-8000-000000000006';

WITH dates AS (
 SELECT (date_trunc('week',
   (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::date)-7+i AS actual_date
 FROM generate_series(0,4) i
)
INSERT INTO public.office_worktime_review_cases(
 id,employee_user_id,requested_by,status,
 work_starts_at,work_ends_at,breaks
)
SELECT pg_catalog.gen_random_uuid(),
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002','APPROVED',
 (actual_date::timestamp+interval '9 hours') AT TIME ZONE 'Asia/Kolkata',
 (actual_date::timestamp+interval '15 hours') AT TIME ZONE 'Asia/Kolkata',
 '[]'::jsonb FROM dates;

INSERT INTO public.office_flex_day_requests(
 id,employee_user_id,status,requested_by,earned_week_monday,
 qualifying_work_minutes
) VALUES(
 'b0000000-0000-4000-8000-000000000035',
 'a0000000-0000-4000-8000-000000000002','PENDING',
 'a0000000-0000-4000-8000-000000000002',
 (date_trunc('week',
   (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::timestamp)::date)-7,1800
);
DO $flex$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='TIME-07')<>1
 OR NOT public.office_lifecycle_flex_evidence_verified(
    'b0000000-0000-4000-8000-000000000035') THEN
  RAISE EXCEPTION 'Five distinct approved six-hour weekdays were not verified';
 END IF;
END;
$flex$;

-- The only permitted scheduling caller is the private backend role.
SET ROLE kravia_office_backend;
SELECT public.office_lifecycle_schedule_due(50) AS newly_queued;
SELECT public.office_lifecycle_schedule_due(50) AS duplicate_should_be_zero;
RESET ROLE;
DO $expected$
DECLARE n integer;
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_auth_signals WHERE event_code='AUTH-10')<>1 THEN
  RAISE EXCEPTION 'One temporary lockout must create one account alert';
 END IF;
 SELECT count(*) INTO n FROM public.office_lifecycle_mail_outbox;
 IF n<>10 THEN RAISE EXCEPTION 'Expected 10 genuine employee/manager alerts, got %',n; END IF;
 IF (SELECT count(DISTINCT event_code) FROM public.office_lifecycle_mail_outbox)<>6 THEN
  RAISE EXCEPTION 'Six event codes must be independent and idempotent';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox
     WHERE event_code='PAY-10')<>2
    OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox
     WHERE event_code='DEV-02')<>2
    OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox
     WHERE event_code='ONB-11')<>2
    OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox
     WHERE event_code='ONB-12')<>2
    OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox
     WHERE event_code='TIME-07')<>1
 THEN RAISE EXCEPTION 'Employee and authorised manager source scopes are incomplete'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.office_lifecycle_mail_outbox
  WHERE recipient_user_id='a0000000-0000-4000-8000-000000000004'
 ) THEN RAISE EXCEPTION 'Suspended identity received a scheduled alert'; END IF;
END;
$expected$;

SET ROLE kravia_office_backend;
CREATE TEMP TABLE new_claims AS SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $claims$
BEGIN
 IF (SELECT count(*) FROM pg_temp.new_claims)<>10 THEN
  RAISE EXCEPTION 'Only fully verified source proofs may be claimed';
 END IF;
 IF (SELECT count(*) FROM pg_temp.new_claims
      WHERE event_code='PAY-10' AND pay_period='2026-09')<>2 THEN
  RAISE EXCEPTION 'Salary reminders must carry an authentic payroll period';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.new_claims
     WHERE recipient_email NOT LIKE '%@kraviaprivatelimited.com') THEN
  RAISE EXCEPTION 'Unapproved external email recipient in private claim';
 END IF;
END;
$claims$;
ROLLBACK;
SELECT 'SCHEDULED_LIFECYCLE_SOURCES_VERIFIED' AS result;
