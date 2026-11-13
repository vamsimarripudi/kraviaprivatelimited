-- Disposable fixture only; this test never sends provider mail.
-- Verify first-party auth event INSERT can flush before approval UPDATE.
BEGIN;
UPDATE public.office_lifecycle_mail_policy
 SET enabled=true,
 approved_by='a0000000-0000-4000-8000-000000000001'::uuid,
 approved_at=pg_catalog.now()-interval '1 minute',
 effective_from=pg_catalog.now()-interval '1 minute'
WHERE event_code='AUTH-07';
INSERT INTO public.office_login_device_approvals(
 id,user_id,session_id,status,approved_at
) VALUES(
 'atomic_device_approval','a0000000-0000-4000-8000-000000000002',
 'atomic_device_session','PENDING',NULL
);
INSERT INTO public.office_auth_events_v2(
 id,user_id,session_id,event_type,metadata_json
) VALUES(
 'atomic_approved_event','a0000000-0000-4000-8000-000000000002',
 'atomic_device_session','DEVICE_APPROVAL_APPROVED','{}'
);
DO $before$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_auth_signals
       WHERE event_code='AUTH-07')<>1
   OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox
       WHERE event_code='AUTH-07')<>1 THEN
   RAISE EXCEPTION 'Valid device decision was lost because source INSERT flushed before state UPDATE';
 END IF;
END;
$before$;
-- Fail closed while status is unverified; claiming does not remove the intent.
SET ROLE kravia_office_backend;
CREATE TEMP TABLE predecision_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $unverified$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.predecision_claims) THEN
   RAISE EXCEPTION 'Device decision was delivered before approval was committed';
 END IF;
END;
$unverified$;
UPDATE public.office_login_device_approvals
 SET status='APPROVED',approved_at=pg_catalog.now()
WHERE id='atomic_device_approval';
SET ROLE kravia_office_backend;
CREATE TEMP TABLE verified_decision_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $verified$
BEGIN
 IF (SELECT count(*) FROM pg_temp.verified_decision_claims)<>1
   OR NOT EXISTS(
     SELECT 1 FROM pg_temp.verified_decision_claims
     WHERE event_code='AUTH-07'
       AND recipient_email='synthetic.staff@kraviaprivatelimited.com'
   ) THEN
   RAISE EXCEPTION 'Approved device decision did not claim exactly once after commit';
 END IF;
END;
$verified$;
ROLLBACK;
SELECT 'DEVICE_DECISION_ATOMICITY_VERIFIED' AS result;
