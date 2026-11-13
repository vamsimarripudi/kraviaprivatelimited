-- Verified, synthetic due-date tests. Never run against actual staff/production.
BEGIN;
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>49
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
  RAISE EXCEPTION 'Expected 49 mapped, zero enabled reminders, empty outbox';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_lifecycle_reminder_tick(integer)','EXECUTE')
  OR pg_catalog.has_function_privilege('authenticated','public.office_lifecycle_reminder_tick(integer)','EXECUTE') THEN
  RAISE EXCEPTION 'Non-worker roles may schedule employee mail';
 END IF;
END;
$preflight$;

INSERT INTO public.office_identity_users(user_id,display_name,status)
VALUES
 ('a0000000-0000-4000-8000-000000000005','CI New Colleague','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000006','CI Month Colleague','ACTIVE');
INSERT INTO public.office_auth_users(id,email,status)
VALUES
 ('a0000000-0000-4000-8000-000000000005','synthetic.new@kraviaprivatelimited.com','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000006','synthetic.month@kraviaprivatelimited.com','ACTIVE');

INSERT INTO public.office_job_assignments(user_id,reports_to_user_id,status,start_date)
VALUES
 ('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','ACTIVE',CURRENT_DATE-60),
 ('a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000003','ACTIVE',CURRENT_DATE-60),
 ('a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000003','ACTIVE',CURRENT_DATE-60);
UPDATE public.office_employment_registry
SET start_date=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-7
WHERE identity_user_id='a0000000-0000-4000-8000-000000000002';
INSERT INTO public.office_employment_registry(
 identity_user_id,employment_id,status,start_date,relationship_type
) VALUES
 ('a0000000-0000-4000-8000-000000000005','f0000000-0000-4000-8000-000000000085',
 'ACTIVE',(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date,'EMPLOYEE'),
 ('a0000000-0000-4000-8000-000000000006','f0000000-0000-4000-8000-000000000086',
 'ACTIVE',(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-30,'EMPLOYEE');
UPDATE public.office_training_assignments
SET due_on=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date+1
WHERE id='d0000000-0000-4000-8000-000000000001';
UPDATE public.office_payroll_periods
SET pay_date=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-1
WHERE id='f0000000-0000-4000-8000-000000000001';
UPDATE public.office_payroll_periods
SET attendance_cutoff_at=pg_catalog.now()+interval '12 hours'
WHERE id='f0000000-0000-4000-8000-000000000006';

UPDATE public.office_lifecycle_mail_policy
SET enabled=true,
 approved_by='a0000000-0000-4000-8000-000000000001',
 approved_at=pg_catalog.now()-interval '2 minutes',
 effective_from=pg_catalog.now()-interval '1 minute'
WHERE event_code IN ('DEV-02','ONB-06','ONB-11','ONB-12','PAY-10','TIME-10');

SET ROLE kravia_office_backend;
CREATE TEMP TABLE tick_results AS
 SELECT public.office_lifecycle_reminder_tick(50) AS inserted;
RESET ROLE;
DO $verify$
DECLARE
 v_count integer;
BEGIN
 SELECT inserted INTO v_count FROM pg_temp.tick_results;
 IF v_count<>16 THEN
  RAISE EXCEPTION 'Expected 16 verified due-date proofs, got %, distribution %',
    v_count,(SELECT string_agg(event_code||':'||n::text,', ' ORDER BY event_code)
      FROM (SELECT event_code,count(*) n FROM public.office_lifecycle_mail_outbox
         GROUP BY event_code) buckets);
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>16 THEN
  RAISE EXCEPTION 'Scheduled sources were not enqueued exactly once';
 END IF;
 IF (SELECT count(DISTINCT event_code) FROM public.office_lifecycle_mail_outbox)<>6 THEN
  RAISE EXCEPTION 'Six independent scheduled sources were not captured';
 END IF;
 IF EXISTS(
   SELECT 1 FROM public.office_lifecycle_mail_outbox
   WHERE recipient_user_id='a0000000-0000-4000-8000-000000000004'
 ) THEN
  RAISE EXCEPTION 'Suspended employee became a scheduled notification recipient';
 END IF;
END;
$verify$;

SET ROLE kravia_office_backend;
CREATE TEMP TABLE tick_again AS
 SELECT public.office_lifecycle_reminder_tick(50) AS inserted;
CREATE TEMP TABLE reminder_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $claims$
BEGIN
 IF (SELECT inserted FROM pg_temp.tick_again)<>0
   OR (SELECT count(*) FROM pg_temp.reminder_claims)<>16 THEN
  RAISE EXCEPTION 'Scheduled tick repeated a due-date event or claim validation failed';
 END IF;
 IF (SELECT count(*) FROM pg_temp.reminder_claims
   WHERE event_code='PAY-10' AND pay_period='2026-11')<>3 THEN
  RAISE EXCEPTION 'Overdue wage reminder lacked immutable payroll period evidence';
 END IF;
 IF EXISTS(
   SELECT 1 FROM pg_temp.reminder_claims
   WHERE recipient_email NOT LIKE 'synthetic.%@kraviaprivatelimited.com'
     AND recipient_email<>'synthetic.manager@kraviaprivatelimited.com'
 ) THEN
  RAISE EXCEPTION 'Unverified or external recipient was claimed';
 END IF;
END;
$claims$;
ROLLBACK;
SELECT 'OFFICE_SCHEDULED_SOURCE_VERIFIED' AS result;
