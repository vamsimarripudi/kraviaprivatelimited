-- Disposable PostgreSQL fixture only. The four credential email types already
-- have direct, idempotent first-party senders; never invoke Brevo in this test.
BEGIN;
DO $ownership$
DECLARE v text;
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>63
   OR EXISTS (SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS (SELECT 1 FROM public.office_lifecycle_mail_outbox)
   OR (SELECT count(*) FROM public.office_lifecycle_transactional_ownership)<>4
 THEN
   RAISE EXCEPTION 'Unexpected lifecycle state following direct credential ownership mapping';
 END IF;

 FOR v IN SELECT event_code FROM public.office_lifecycle_transactional_ownership LOOP
   IF NOT EXISTS (
     SELECT 1 FROM public.office_lifecycle_mail_policy
     WHERE event_code=v AND source_ready AND NOT enabled
       AND delivery_owner='FIRST_PARTY_AUTH'
   ) THEN
     RAISE EXCEPTION 'Credential email % not safely delegated', v;
   END IF;
   BEGIN
     UPDATE public.office_lifecycle_mail_policy
       SET enabled=true
     WHERE event_code=v;
     RAISE EXCEPTION 'Unsafe duplicate lifecycle email was enabled for %',v;
   EXCEPTION WHEN OTHERS THEN
     IF SQLERRM LIKE 'Unsafe duplicate lifecycle email was enabled%' THEN RAISE; END IF;
     IF SQLERRM NOT LIKE '%already handled by first-party Office authentication%' THEN
       RAISE EXCEPTION 'Unexpected authority failure for %: %',v,SQLERRM;
     END IF;
   END;
 END LOOP;

 IF EXISTS (SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Directly sent credential mail was duplicated into lifecycle queue';
 END IF;
 IF has_table_privilege('anon','public.office_lifecycle_transactional_ownership','SELECT')
  OR has_table_privilege('authenticated','public.office_lifecycle_transactional_ownership','SELECT')
  OR has_function_privilege('anon','public.office_lifecycle_prevent_auth_duplicate()','EXECUTE')
 THEN
   RAISE EXCEPTION 'Credential ownership catalog exposed to browser';
 END IF;
END;
$ownership$;
ROLLBACK;
SELECT 'DIRECT_CREDENTIAL_OWNERSHIP_VERIFIED' AS result;
