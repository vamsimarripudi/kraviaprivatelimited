-- Prove the simulated production drift was reconciled without any sends.
DO $verify$
DECLARE allowed_sources text;
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
   OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>27
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
  THEN RAISE EXCEPTION 'Lifecycle catalog readiness does not match canonical audited code'; END IF;
  IF to_regclass('public.office_lifecycle_mail_decision_events') IS NULL
  THEN RAISE EXCEPTION 'Independently verified decision events table not created'; END IF;
  SELECT pg_get_constraintdef(oid) INTO allowed_sources FROM pg_constraint
    WHERE conrelid='public.office_lifecycle_mail_outbox'::regclass
      AND conname='office_lifecycle_mail_outbox_source_table_check';
  IF allowed_sources NOT LIKE '%office_access_audit%'
     OR allowed_sources NOT LIKE '%office_lifecycle_mail_decision_events%'
  THEN RAISE EXCEPTION 'Canonical source-table check not widened to audited events'; END IF;
  IF (SELECT pg_get_function_result('public.office_lifecycle_mail_claim(integer)'::regprocedure))
      NOT LIKE '%pay_period text%'
  THEN RAISE EXCEPTION 'Lifecycle worker 7-field claim mismatch'; END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>0
  THEN RAISE EXCEPTION 'Historical lifecycle email was fabricated by migration'; END IF;
  IF pg_catalog.has_function_privilege('anon',
     'public.office_lifecycle_mail_claim(integer)','EXECUTE')
     OR pg_catalog.has_function_privilege('service_role',
     'public.office_lifecycle_mail_claim(integer)','EXECUTE')
  THEN RAISE EXCEPTION 'Private worker claim opened to untrusted browser/service role'; END IF;
  IF NOT pg_catalog.has_function_privilege('kravia_office_backend',
     'public.office_lifecycle_mail_claim(integer)','EXECUTE')
  THEN RAISE EXCEPTION 'Authorized worker cannot claim after migration'; END IF;
END;
$verify$;
SELECT 'LIFECYCLE_FORWARD_RECONCILED' AS result;
