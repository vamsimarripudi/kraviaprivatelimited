-- Disposable PostgreSQL 17 fixture; never execute against production employees.
BEGIN;
DO $baseline$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>59
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 59 mapped lifecycle policies with zero active mail';
 END IF;
 IF pg_catalog.has_table_privilege('anon','public.office_lifecycle_attendance_reminder_sources','SELECT')
    OR pg_catalog.has_function_privilege('authenticated','public.office_lifecycle_reminder_tick(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'Browser can access restricted attendance evidence or sender';
 END IF;
END;
$baseline$;

UPDATE public.office_lifecycle_mail_policy
 SET enabled=true,
     approved_by='a0000000-0000-4000-8000-000000000001'::uuid,
     approved_at=pg_catalog.now()-interval '2 minutes',
     effective_from=pg_catalog.now()-interval '1 minute'
 WHERE event_code IN ('TIME-02','EXIT-01');

INSERT INTO public.office_job_assignments(
 user_id,reports_to_user_id,status,start_date
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000003',
 'ACTIVE',CURRENT_DATE-50
)
ON CONFLICT(user_id) DO UPDATE SET
 status='ACTIVE',
 start_date=CURRENT_DATE-50,
 reports_to_user_id='a0000000-0000-4000-8000-000000000003';

-- True recorded sessions block neutral missing-attendance reminders.
WITH weekday AS (
 SELECT CASE extract(isodow FROM
    (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date)::integer
    WHEN 1 THEN (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-3
    WHEN 2 THEN (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-1
    WHEN 3 THEN (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-1
    WHEN 4 THEN (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-1
    WHEN 5 THEN (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date-1
    ELSE NULL::date END AS prior
)
INSERT INTO public.office_attendance_sessions(
 id,user_id,work_date,check_in_at,check_out_at,status
)
SELECT 'b0000000-0000-4000-8000-000000000055',
 'a0000000-0000-4000-8000-000000000002',weekday.prior,
 pg_catalog.now()-interval '26 hours',pg_catalog.now()-interval '20 hours','CLOSED'
FROM weekday WHERE weekday.prior IS NOT NULL;

SELECT public.office_lifecycle_reminder_tick(25);
DO $checked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_attendance_reminder_sources)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox WHERE event_code='TIME-02') THEN
   RAISE EXCEPTION 'Recorded check-in must suppress missing-attendance reminder';
 END IF;
END;
$checked$;

DELETE FROM public.office_attendance_sessions
 WHERE id='b0000000-0000-4000-8000-000000000055';
SELECT public.office_lifecycle_reminder_tick(25);
SELECT public.office_lifecycle_reminder_tick(25);
DO $reminder$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_attendance_reminder_sources)<>1
    OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='TIME-02')<>1 THEN
   RAISE EXCEPTION 'One neutral previous-workday reminder must be idempotent';
 END IF;
END;
$reminder$;

INSERT INTO public.office_requests(
 id,request_type_code,current_step_order,status,target_user_id
) VALUES(
 'b0000000-0000-4000-8000-000000000056',
 'EMPLOYEE_OFFBOARDING',1,'APPROVED',
 'a0000000-0000-4000-8000-000000000002'
);
INSERT INTO public.office_request_events(
 request_id,actor_user_id,event_type,to_status
) VALUES(
 'b0000000-0000-4000-8000-000000000056',
 'a0000000-0000-4000-8000-000000000001',
 'REQUEST_APPROVED','APPROVED'
);
DO $exit$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='EXIT-01')<>1
    OR NOT EXISTS(
      SELECT 1 FROM public.office_lifecycle_mail_outbox
      WHERE event_code='EXIT-01'
        AND recipient_user_id='a0000000-0000-4000-8000-000000000003'
    ) THEN
   RAISE EXCEPTION 'Approved exit did not notify the current independent People reviewer';
 END IF;
END;
$exit$;

SET ROLE kravia_office_backend;
CREATE TEMP TABLE verified_workday_exit_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $claimed$
BEGIN
 IF (SELECT count(*) FROM pg_temp.verified_workday_exit_claims)<>2
    OR (SELECT count(DISTINCT event_code) FROM pg_temp.verified_workday_exit_claims)<>2
    OR NOT EXISTS(
      SELECT 1 FROM pg_temp.verified_workday_exit_claims
      WHERE event_code='TIME-02'
        AND recipient_email='synthetic.staff@kraviaprivatelimited.com'
    )
    OR NOT EXISTS(
      SELECT 1 FROM pg_temp.verified_workday_exit_claims
      WHERE event_code='EXIT-01'
        AND recipient_email='synthetic.manager@kraviaprivatelimited.com'
    ) THEN
   RAISE EXCEPTION 'Private worker did not claim exactly two independently verified recipients';
 END IF;
END;
$claimed$;
ROLLBACK;
SELECT 'WORKDAY_EXIT_SOURCE_VERIFIED' AS result;
