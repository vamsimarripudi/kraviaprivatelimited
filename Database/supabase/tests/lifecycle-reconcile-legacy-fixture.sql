-- Disposable PostgreSQL 17 only. Simulate the older already-applied
-- production schema before running the forward-only reconciliation.
-- The true production state was read and confirmed to have 15 source routes,
-- a six-column claim contract and no decision-events table.
DO $pre$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
    OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>27
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
   RAISE EXCEPTION 'Current canonical fixture did not start with the expected 81 disabled events';
 END IF;
END;
$pre$;
WITH ready AS (
  SELECT event_code,row_number() OVER (ORDER BY event_code) AS rank
  FROM public.office_lifecycle_mail_policy WHERE source_ready
)
UPDATE public.office_lifecycle_mail_policy p SET source_ready=false
FROM ready WHERE p.event_code=ready.event_code AND ready.rank>15;

ALTER TABLE public.office_lifecycle_mail_outbox
 DROP CONSTRAINT office_lifecycle_mail_outbox_source_table_check;
ALTER TABLE public.office_lifecycle_mail_outbox
 ADD CONSTRAINT office_lifecycle_mail_outbox_source_table_check
 CHECK(source_table IN ('office_employee_intake_events','office_role_package_events',
  'office_worktime_events','office_department_transfer_events','office_auth_events',
  'office_people_development_events','office_payroll_events','office_task_events'));

DROP TABLE public.office_lifecycle_mail_decision_events;
DROP FUNCTION public.office_lifecycle_mail_claim(integer);
CREATE FUNCTION public.office_lifecycle_mail_claim(p_limit integer DEFAULT 10)
RETURNS TABLE (
  outbox_id uuid,claim_token uuid,event_code text,recipient_email text,
  recipient_name text,source_reference text
) LANGUAGE sql STABLE AS $legacy$
 SELECT null::uuid,null::uuid,null::text,null::text,null::text,null::text WHERE false;
$legacy$;
DO $verify_legacy$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>15 OR
   to_regclass('public.office_lifecycle_mail_decision_events') IS NOT NULL THEN
   RAISE EXCEPTION 'Legacy database schema not simulated';
 END IF;
 IF (SELECT pg_get_function_result('public.office_lifecycle_mail_claim(integer)'::regprocedure))
      LIKE '%pay_period%' THEN
   RAISE EXCEPTION 'Legacy claim function has new fields already';
 END IF;
END;
$verify_legacy$;
