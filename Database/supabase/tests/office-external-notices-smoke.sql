-- No production emails, real people or provider requests. Transaction rolls back.
BEGIN;
DO $privacy$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>81
  OR (SELECT count(*) FROM public.office_lifecycle_mail_policy
        WHERE delivery_owner='EXTERNAL_NOTICE_WORKER')<>7
  OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
  OR EXISTS(SELECT 1 FROM public.office_external_notice_outbox)
 THEN RAISE EXCEPTION 'Expected 81 mapped and seven disabled external routes'; END IF;
 IF has_table_privilege('anon','public.office_external_notice_outbox','SELECT')
  OR has_table_privilege('authenticated','public.office_external_notice_events','SELECT')
  OR has_function_privilege('service_role',
     'public.office_external_notice_claim(integer)','EXECUTE')
  OR NOT has_function_privilege('kravia_office_backend',
     'public.office_external_notice_claim(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'External mail worker privileges are not isolated'; END IF;
END $privacy$;

-- Enable two source routes only in the rolled-back fixture. Not a real Owner
-- activation, not a provider call, and no historical records were replayed.
UPDATE public.office_lifecycle_mail_policy
 SET enabled=true,effective_from=pg_catalog.now()-interval '1 minute'
 WHERE event_code IN('ONB-04','EXIT-02');

-- Genuine provider delivery-bound event against the canonical HR_APPOINTMENT
-- template and generated KR-DOC instance identifier (never template_code in document_code).
INSERT INTO public.office_document_instances(
 id,document_code,template_id,subject_type,subject_reference,status,
 created_by,approved_by,approved_at,signed_at
) VALUES(
 'a1111111-1111-4111-8111-111111111111','KR-DOC-00001711',
 'f1000000-0000-4000-8000-000000000002','EMPLOYEE',
 '33333333-3333-4333-8333-333333333333',
 'SIGNING','22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',now(),NULL
);
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,destination_masked,provider_reference,event_type,metadata
) VALUES(
 'a2222222-2222-4222-8222-222222222222',
 'a1111111-1111-4111-8111-111111111111','ESIGN',
 's***@kraviaprivatelimited.com','synthetic-provider-ref-1711','SIGNING_LINK_ISSUED',
 '{"link_expires_at":"2099-11-30T12:00:00Z"}'::jsonb
);
INSERT INTO public.office_document_engine_events(
 document_instance_id,event_type,metadata
) VALUES(
 'a1111111-1111-4111-8111-111111111111','DOCUMENT_DELIVERED',
 '{"delivery_event_id":"a2222222-2222-4222-8222-222222222222"}'::jsonb
);

DO $sign$
BEGIN
 IF (SELECT count(*) FROM public.office_onboarding_signing_proofs)<>1
 OR (SELECT count(*) FROM public.office_external_notice_outbox
  WHERE event_code='ONB-04' AND status='PENDING')<>1
 THEN RAISE EXCEPTION 'Authentic signatory event did not produce an idempotent private notice'; END IF;
END $sign$;

CREATE TEMP TABLE sign_claims AS SELECT * FROM public.office_external_notice_claim(5);
DO $sign_claim$
BEGIN
 IF (SELECT count(*) FROM pg_temp.sign_claims)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_temp.sign_claims
   WHERE event_code='ONB-04'
     AND recipient_email='synthetic.employee@kraviaprivatelimited.com'
     AND source_reference LIKE 'ONBOARDING_SIGNING:%')
 THEN RAISE EXCEPTION 'Wrong corporate signatory or source claimed'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_temp.sign_claims claim
  WHERE public.office_external_notice_can_send(claim.outbox_id,claim.claim_token)
 ) THEN RAISE EXCEPTION 'Safe signatory claim was denied'; END IF;
END $sign_claim$;
SELECT public.office_external_notice_finish(outbox_id,claim_token,'SENT','synthetic-provider-confirmation')
 FROM pg_temp.sign_claims;

-- Authentic current two-person verified personal contact for an approved exit.
SELECT public.office_exit_contact_record(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'former.employee@example.net','SIGNED_EXIT_FORM',
 'Synthetic consent source EXIT-2026-11-13',
 'Real consent rehearsal is independently recorded');
SELECT public.office_exit_contact_decide(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 true,'Current Owner independently verified alternate contact');
UPDATE public.office_employment_registry SET end_date=CURRENT_DATE
 WHERE identity_user_id='33333333-3333-4333-8333-333333333333';
INSERT INTO public.office_requests(id,request_type_code,target_user_id,status)
VALUES('b1111111-1111-4111-8111-111111111111','EMPLOYEE_OFFBOARDING',
 '33333333-3333-4333-8333-333333333333','APPROVED');
INSERT INTO public.office_request_events(
 request_id,actor_user_id,event_type,from_status,to_status
) VALUES(
 'b1111111-1111-4111-8111-111111111111',
 '11111111-1111-4111-8111-111111111111',
 'REQUEST_APPROVED','PENDING','APPROVED'
);

DO $exit$
BEGIN
 IF (SELECT count(*) FROM public.office_external_notice_outbox
  WHERE event_code='EXIT-02' AND status='PENDING')<>1
 THEN RAISE EXCEPTION 'Verified exit request failed to queue exactly once'; END IF;
END $exit$;
CREATE TEMP TABLE exit_claims AS SELECT * FROM public.office_external_notice_claim(5);
DO $exit_claim$
BEGIN
 IF (SELECT count(*) FROM pg_temp.exit_claims)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_temp.exit_claims
   WHERE event_code='EXIT-02'
     AND recipient_email='former.employee@example.net'
     AND source_reference LIKE 'EXIT_NOTIFICATION:%')
 THEN RAISE EXCEPTION 'Former employee notice used an unverified or corporate address'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_temp.exit_claims claim
  WHERE public.office_external_notice_can_send(claim.outbox_id,claim.claim_token))
 THEN RAISE EXCEPTION 'Consent-bound exit claim was denied before revocation'; END IF;
END $exit_claim$;

SELECT public.office_exit_contact_revoke(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'Synthetic employee withdrew the email notification consent');
DO $revoke$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.exit_claims claim
   WHERE public.office_external_notice_can_send(claim.outbox_id,claim.claim_token))
 THEN RAISE EXCEPTION 'Revoked consent did not block already claimed external mail'; END IF;
END $revoke$;

SELECT public.office_external_notice_finish(outbox_id,claim_token,'REJECTED',NULL)
 FROM pg_temp.exit_claims;
DO $final$
BEGIN
 IF (SELECT count(*) FROM public.office_external_notice_events
  WHERE event_type='ACCEPTED')<>1
 OR (SELECT count(*) FROM public.office_external_notice_events
  WHERE event_type='REJECTED')<>1
 OR EXISTS(SELECT 1 FROM public.office_external_notice_outbox WHERE status='PENDING')
 THEN RAISE EXCEPTION 'External provider outcomes were duplicated or left sendable'; END IF;
END $final$;
ROLLBACK;
SELECT 'EXTERNAL_LIFECYCLE_81_SOURCE_AND_RECIPIENT_GATES_VERIFIED' AS result;
