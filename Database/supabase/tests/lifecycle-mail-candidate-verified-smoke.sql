-- Synthetic candidate domain, no real candidate data or provider sends.
-- Genuine candidate opt-in is stored before any external claim is granted.
BEGIN;
DO $initial$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>74
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_candidate_mail_outbox)
    OR EXISTS(SELECT 1 FROM public.office_candidate_mail_consents)
 THEN RAISE EXCEPTION 'Candidate rehearsal must begin with 74 covered disabled codes and no messages'; END IF;
 IF has_table_privilege('anon','public.office_candidate_mail_consents','SELECT')
  OR has_table_privilege('authenticated','public.office_candidate_mail_outbox','SELECT')
  OR has_function_privilege('service_role','public.office_candidate_mail_claim(integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Candidate privacy or worker authority boundary broken'; END IF;
END;
$initial$;

INSERT INTO public.office_hiring_requisitions(id,department_code)
VALUES('e1000000-0000-4000-8000-000000000001','PEOPLE');
INSERT INTO public.office_candidates(
 id,requisition_id,candidate_code,full_name,email,status
) VALUES(
 'e1000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'KR-CAND-EXAMPLE','Synthetic Applicant','candidate@example.test','APPLIED'
),(
 'e1000000-0000-4000-8000-000000000003',
 'e1000000-0000-4000-8000-000000000001',
 'KR-CAND-DECLINED','Synthetic Other Applicant','other@example.test','APPLIED'
);
-- The Owner enables sources only in the isolated transaction.
UPDATE public.office_lifecycle_mail_policy
SET enabled=true,approved_by='a0000000-0000-4000-8000-000000000001',
 approved_at=pg_catalog.now()-interval '5 minutes',
 effective_from=pg_catalog.now()-interval '4 minutes'
WHERE event_code LIKE 'HIRE-%' AND delivery_owner='CANDIDATE_WORKER';

INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,new_status
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000002',
 'CANDIDATE_CREATED','APPLIED'
);
DO $no_consent$
BEGIN
 IF (SELECT count(*) FROM public.office_candidate_mail_outbox WHERE event_code='HIRE-01')<>1 THEN
   RAISE EXCEPTION 'Source intent must be immutable while consent is pending'; END IF;
END;$no_consent$;
SET ROLE kravia_office_backend;
SELECT count(*) FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $no_consent$
BEGIN
 IF (SELECT count(*) FROM public.office_candidate_mail_outbox WHERE status='SENDING')<>0 THEN
   RAISE EXCEPTION 'Candidate mail was claimed without verified consent'; END IF;
END;$no_consent$;

SELECT public.office_candidate_mail_consent_record(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000002',
 'Synthetic-signed-candidate-consent-2026',
 pg_catalog.now()-interval '1 day',
 'Candidate consent copy held in private HR evidence vault');
DO $independent$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.office_candidate_mail_consent_decide(
     'a0000000-0000-4000-8000-000000000002',
     'e1000000-0000-4000-8000-000000000002',
     true,'Self review prohibited for consent evidence');
 EXCEPTION WHEN others THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Consent creator self-approved unverified evidence'; END IF;
END;$independent$;
SELECT public.office_candidate_mail_consent_decide(
 'a0000000-0000-4000-8000-000000000003',
 'e1000000-0000-4000-8000-000000000002',
 true,'Separate authorised reviewer checked external candidate consent');
-- Consent is attached to the exact candidate-provided mailbox. A later
-- address edit may not inherit the old candidate's verified authorization.
UPDATE public.office_candidates SET email='changed@example.test'
 WHERE id='e1000000-0000-4000-8000-000000000002';
SET ROLE kravia_office_backend;
SELECT count(*) FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $changed_address$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_candidate_mail_outbox
     WHERE status='SENDING') THEN
   RAISE EXCEPTION 'Changed candidate email inherited a different mailbox consent';
 END IF;
END;$changed_address$;
UPDATE public.office_candidates SET email='candidate@example.test'
 WHERE id='e1000000-0000-4000-8000-000000000002';


SET ROLE kravia_office_backend;
CREATE TEMP TABLE applicant_claims AS
SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $delivery$
BEGIN
 IF (SELECT count(*) FROM pg_temp.applicant_claims)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_temp.applicant_claims
   WHERE event_code='HIRE-01' AND recipient_email='candidate@example.test') THEN
    RAISE EXCEPTION 'Verified candidate receipt not claimed correctly'; END IF;
END;$delivery$;
SET ROLE kravia_office_backend;
SELECT public.office_candidate_mail_finish(
 outbox_id,claim_token,'SENT','synthetic-provider-accepted-01')
FROM pg_temp.applicant_claims;
RESET ROLE;
DO $idempotent$
BEGIN
 IF (SELECT count(*) FROM public.office_candidate_mail_outbox WHERE status='SENT')<>1 THEN
  RAISE EXCEPTION 'Provider outcome lost';
 END IF;
END;$idempotent$;

-- Real interview creates SCHEDULED, subsequent reschedule/cancel change
-- canonical state; stale previous notices must fail source verification.
INSERT INTO public.office_candidate_interviews(
 id,candidate_id,scheduled_start,status
) VALUES(
 'e1000000-0000-4000-8000-000000000004',
 'e1000000-0000-4000-8000-000000000002',
 pg_catalog.now()+interval '3 days','SCHEDULED'
);
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,metadata
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000002',
 'INTERVIEW_SCHEDULED',pg_catalog.jsonb_build_object(
  'interview_id','e1000000-0000-4000-8000-000000000004'));
SET ROLE kravia_office_backend;
CREATE TEMP TABLE interview_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $interview$
BEGIN
 IF (SELECT count(*) FROM pg_temp.interview_claims WHERE event_code='HIRE-02')<>1
 THEN RAISE EXCEPTION 'Verified scheduled interview intent not claimed'; END IF;
END;$interview$;

SELECT public.office_interview_reschedule(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000004',
 pg_catalog.now()+interval '5 days',
 pg_catalog.now()+interval '5 days 2 hours',
 'Candidate confirmed another mutually acceptable date');
SET ROLE kravia_office_backend;
CREATE TEMP TABLE reschedule_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $reschedule$
BEGIN
 IF (SELECT count(*) FROM pg_temp.reschedule_claims WHERE event_code='HIRE-03')<>1
 THEN RAISE EXCEPTION 'Reschedule notice lacks actual changed interview'; END IF;
END;$reschedule$;

SELECT public.office_interview_cancel(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000004',
 'Candidate requested cancellation of scheduled interview');
SET ROLE kravia_office_backend;
CREATE TEMP TABLE cancel_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $cancel$
BEGIN
 IF (SELECT count(*) FROM pg_temp.cancel_claims WHERE event_code='HIRE-04')<>1
 THEN RAISE EXCEPTION 'Cancellation notice lacks canonical cancelled state'; END IF;
END;$cancel$;

-- New doc request actually recorded to candidate creates source automatically;
-- document rejection needs real request status and explicit reviewer decision.
INSERT INTO public.office_candidate_document_requests(
 id,candidate_id,document_type,label,required,status,requested_by
) VALUES(
 'e1000000-0000-4000-8000-000000000005',
 'e1000000-0000-4000-8000-000000000002',
 'IDENTITY','Identity verification evidence',true,'REQUESTED',
 'a0000000-0000-4000-8000-000000000002');
SET ROLE kravia_office_backend;
CREATE TEMP TABLE request_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $request$
BEGIN
 IF (SELECT count(*) FROM pg_temp.request_claims WHERE event_code='HIRE-05')<>1
 THEN RAISE EXCEPTION 'Actual requested candidate document was not claimed'; END IF;
END;$request$;
UPDATE public.office_candidate_document_requests SET status='REJECTED'
WHERE id='e1000000-0000-4000-8000-000000000005';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,metadata
) VALUES(
 'a0000000-0000-4000-8000-000000000003',
 'e1000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000002',
 'CANDIDATE_DOCUMENT_REVIEWED',
 pg_catalog.jsonb_build_object(
  'request_id','e1000000-0000-4000-8000-000000000005',
  'decision','REJECTED'));
SET ROLE kravia_office_backend;
CREATE TEMP TABLE correction_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $correction$
BEGIN
 IF (SELECT count(*) FROM pg_temp.correction_claims WHERE event_code='HIRE-06')<>1
 THEN RAISE EXCEPTION 'Rejected document review was not verified'; END IF;
END;$correction$;

-- Offer notices only after a signed approved document is independently recorded
-- as delivered and acceptance has a separate evidence reference.
INSERT INTO public.office_document_instances(
 id,template_id,subject_type,subject_reference,status,
 approved_by,approved_at,signed_at,delivered_at
) VALUES(
 'e1000000-0000-4000-8000-000000000006',
 'e1000000-0000-4000-8000-000000000007',
 'CANDIDATE','e1000000-0000-4000-8000-000000000002',
 'DELIVERED','a0000000-0000-4000-8000-000000000003',
 pg_catalog.now()-interval '1 day',
 pg_catalog.now()-interval '2 hours',pg_catalog.now()
);
INSERT INTO public.office_offer_proposals(
 id,created_by,status,candidate_id,requisition_id,approved_by,
 offer_document_instance_id
) VALUES(
 'e1000000-0000-4000-8000-000000000008',
 'a0000000-0000-4000-8000-000000000002',
 'OFFERED','e1000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000003',
 'e1000000-0000-4000-8000-000000000006'
);
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,provider_reference,event_type
) VALUES(
 'e1000000-0000-4000-8000-000000000009',
 'e1000000-0000-4000-8000-000000000006',
 'SECURE_LINK','synthetic-confirmed-document-delivery','DELIVERED'
);
INSERT INTO public.office_document_engine_events(
 document_instance_id,actor_user_id,event_type,metadata
) VALUES(
 'e1000000-0000-4000-8000-000000000006',
 'a0000000-0000-4000-8000-000000000003',
 'DOCUMENT_DELIVERED',
 pg_catalog.jsonb_build_object('delivery_event_id',
    'e1000000-0000-4000-8000-000000000009')
);
SET ROLE kravia_office_backend;
CREATE TEMP TABLE offer_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $offer$
BEGIN
 IF (SELECT count(*) FROM pg_temp.offer_claims WHERE event_code='HIRE-08')<>1
 THEN RAISE EXCEPTION 'Signed and delivered offer evidence not claimed'; END IF;
END;$offer$;

UPDATE public.office_offer_proposals SET status='ONBOARDING',
 accepted_at=pg_catalog.now() WHERE id='e1000000-0000-4000-8000-000000000008';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,offer_id,event_type,metadata
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000008',
 'OFFER_ACCEPTANCE_RECORDED',
 pg_catalog.jsonb_build_object('evidence_reference','synthetic-signed-acceptance-01')
);
SET ROLE kravia_office_backend;
CREATE TEMP TABLE acceptance_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $accept$
BEGIN
 IF (SELECT count(*) FROM pg_temp.acceptance_claims WHERE event_code='HIRE-09')<>1
 THEN RAISE EXCEPTION 'Candidate acceptance lacks independently recorded evidence'; END IF;
END;$accept$;

-- No consent to mail this second candidate; rejection must never be claimed.
UPDATE public.office_candidates SET status='DECLINED'
 WHERE id='e1000000-0000-4000-8000-000000000003';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,new_status
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000001',
 'e1000000-0000-4000-8000-000000000003',
 'CANDIDATE_STATUS_CHANGED','DECLINED'
);
SET ROLE kravia_office_backend;
CREATE TEMP TABLE decline_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $decline$
BEGIN
 IF (SELECT count(*) FROM pg_temp.decline_claims)<>0
 THEN RAISE EXCEPTION 'Candidate without consent was sent a decline notice'; END IF;
END;$decline$;

-- Withdrawal revokes eligibility even if a valid source remains PENDING.
SELECT public.office_candidate_mail_consent_revoke(
 'a0000000-0000-4000-8000-000000000002',
 'e1000000-0000-4000-8000-000000000002',
 'Candidate elected to stop external recruitment communications');
SET ROLE kravia_office_backend;
CREATE TEMP TABLE revoked_claims AS SELECT * FROM public.office_candidate_mail_claim(5);
RESET ROLE;
DO $revoked$
BEGIN
 IF (SELECT count(*) FROM pg_temp.revoked_claims)<>0
 THEN RAISE EXCEPTION 'Candidate consent revocation did not suppress mail'; END IF;
END;$revoked$;

ROLLBACK;
SELECT 'CANDIDATE_NINE_SOURCE_ROUTES_VERIFIED' AS result;
