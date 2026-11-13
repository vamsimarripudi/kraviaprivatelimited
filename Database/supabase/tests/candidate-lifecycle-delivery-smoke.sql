-- Disposable Postgres fixture; no Brevo network activity or real candidate rows.
BEGIN;
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>67
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox) THEN
    RAISE EXCEPTION 'Candidate delivery migration unexpectedly enabled mail';
 END IF;
 IF has_function_privilege('anon','public.office_candidate_lifecycle_claim(integer)','EXECUTE')
 OR has_function_privilege('authenticated','public.office_candidate_lifecycle_claim(integer)','EXECUTE')
 OR has_table_privilege('anon','public.office_candidate_contact_authorizations','SELECT')
 OR has_table_privilege('authenticated','public.office_candidate_lifecycle_outbox','SELECT') THEN
   RAISE EXCEPTION 'External candidate address or worker claim leaked to browser';
 END IF;
END $guard$;

-- Existing applications are not retrospectively emailed. Even after a valid
-- source event is committed, the Owner and policy gate must be satisfied.
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,new_status
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'CANDIDATE_CREATED','APPLIED'
);
DO $pre$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox)
 THEN RAISE EXCEPTION 'Unapproved candidate contact generated outgoing mail'; END IF;
 BEGIN
  PERFORM public.office_candidate_contact_authorize(
   '99999999-9999-4999-8999-999999999999',
   '22222222-2222-4222-8222-222222222222',
   'CANDIDATE_EMAIL_REPLY','Signed answer from candidate received by hiring team');
  RAISE EXCEPTION 'Non-Owner authorized external candidate address';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Current Owner approval is required%' THEN RAISE; END IF;
 END;
END $pre$;
SELECT public.office_candidate_contact_authorize(
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 'CANDIDATE_EMAIL_REPLY','Signed applicant email reply ref APPL-2026-001'
);
DO $before$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox)
 THEN RAISE EXCEPTION 'Candidate contact approval bypassed event policy'; END IF;
END $before$;

-- Policy activation exists only inside this rolled-back test, never production.
UPDATE public.office_lifecycle_mail_policy
SET enabled=true,effective_from=now()-interval '1 minute',
    approved_by='11111111-1111-4111-8111-111111111111',approved_at=now()
WHERE event_code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04',
                    'HIRE-05','HIRE-06','HIRE-09','HIRE-10');
-- Explicitly re-verify to request the single application receipt.
SELECT public.office_candidate_contact_authorize(
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222',
 'CANDIDATE_EMAIL_REPLY','Signed applicant email reply ref APPL-2026-001'
);
INSERT INTO public.office_candidate_interviews(
 id,candidate_id,status,scheduled_start
) VALUES(
 '44444444-4444-4444-8444-444444444444',
 '22222222-2222-4222-8222-222222222222','SCHEDULED',
 now()+interval '2 days'
);
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,metadata
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'INTERVIEW_SCHEDULED',
 jsonb_build_object('interview_id','44444444-4444-4444-8444-444444444444',
                    'scheduled_start',now()+interval '2 days')
);
DO $initial$
BEGIN
 IF (SELECT count(*) FROM public.office_candidate_lifecycle_outbox)<>2
 THEN RAISE EXCEPTION 'Application and scheduled interview not both queued'; END IF;
END $initial$;

-- Claim two permitted events. A recorded new time must invalidate stale
-- scheduled-event evidence and create its own independent event.
SET ROLE kravia_office_backend;
SELECT count(*) FROM public.office_candidate_lifecycle_claim(25);
RESET ROLE;

UPDATE public.office_candidate_interviews
SET scheduled_start=now()+interval '3 days'
WHERE id='44444444-4444-4444-8444-444444444444';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,metadata
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'INTERVIEW_RESCHEDULED',
 jsonb_build_object('interview_id','44444444-4444-4444-8444-444444444444',
                    'new_start',now()+interval '3 days')
);
UPDATE public.office_candidate_interviews SET status='CANCELLED'
WHERE id='44444444-4444-4444-8444-444444444444';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,metadata
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'INTERVIEW_CANCELLED',
 jsonb_build_object('interview_id','44444444-4444-4444-8444-444444444444')
);
SET ROLE kravia_office_backend;
SELECT count(*) FROM public.office_candidate_lifecycle_claim(25);
RESET ROLE;
-- The stale rescheduled record remains pending, not automatically sent.
DO $cancel$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox
  WHERE event_code='HIRE-04' AND status='SENDING') THEN
  RAISE EXCEPTION 'Verified cancellation is not claimable';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox
  WHERE event_code='HIRE-03' AND status='PENDING') THEN
  RAISE EXCEPTION 'Stale reschedule should not be delivered';
 END IF;
END $cancel$;

-- The real document-request mutation now emits immutable candidate event
-- evidence. A reviewer rejection is a separate canonical event.
INSERT INTO public.office_candidate_document_requests(
 id,candidate_id,document_type,requested_by,status
) VALUES(
 '55555555-5555-4555-8555-555555555555',
 '22222222-2222-4222-8222-222222222222','DEGREE',
 '11111111-1111-4111-8111-111111111111','REQUESTED'
);
UPDATE public.office_candidate_document_requests SET status='REJECTED'
WHERE id='55555555-5555-4555-8555-555555555555';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,metadata
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'CANDIDATE_DOCUMENT_REVIEWED',
 jsonb_build_object('request_id','55555555-5555-4555-8555-555555555555',
                    'decision','REJECTED')
);
INSERT INTO public.office_offer_proposals(
 id,candidate_id,status,approved_by,approved_at,accepted_at
) VALUES(
 '66666666-6666-4666-8666-666666666666',
 '22222222-2222-4222-8222-222222222222',
 'ONBOARDING','11111111-1111-4111-8111-111111111111',
 now()-interval '1 day',now()
);
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,offer_id,event_type,metadata
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 '66666666-6666-4666-8666-666666666666',
 'OFFER_ACCEPTANCE_RECORDED',
 jsonb_build_object('evidence_reference','synthetic signed candidate acceptance reference')
);
UPDATE public.office_candidates SET status='REJECTED'
WHERE id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.office_recruitment_events(
 actor_user_id,requisition_id,candidate_id,event_type,new_status
) VALUES(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 '22222222-2222-4222-8222-222222222222',
 'CANDIDATE_STATUS_CHANGED','REJECTED'
);
SET ROLE kravia_office_backend;
SELECT count(*) FROM public.office_candidate_lifecycle_claim(25);
RESET ROLE;

DO $assertions$
DECLARE total int;
BEGIN
 SELECT count(*) INTO total FROM public.office_candidate_lifecycle_outbox;
 IF total<>8 THEN RAISE EXCEPTION 'Expected 8 separate source events, got %',total; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox
  WHERE event_code='HIRE-10' AND status='SENDING'
    AND recipient_email='candidate@example.com') THEN
  RAISE EXCEPTION 'Approved final status notice not sent to valid candidate contact';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox
   WHERE recipient_email<>'candidate@example.com') THEN
  RAISE EXCEPTION 'Unverified candidate email reached outbox'; END IF;
END $assertions$;

-- Provider acceptance is final; no second claim or resend is possible.
SELECT public.office_candidate_lifecycle_finish(
 o.id,o.claim_token,'SENT','synthetic-provider-accepted'
) FROM public.office_candidate_lifecycle_outbox o
WHERE event_code='HIRE-10' AND status='SENDING';
DO $final$
BEGIN
 IF (SELECT count(*) FROM public.office_candidate_lifecycle_outbox
   WHERE event_code='HIRE-10' AND status='SENT')<>1 THEN
   RAISE EXCEPTION 'Accepted event not finalized'; END IF;
 IF EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox
   WHERE event_code='HIRE-10' AND status='PENDING') THEN
   RAISE EXCEPTION 'Accepted event can be resent'; END IF;
END $final$;
ROLLBACK;
SELECT 'CANDIDATE_LIFECYCLE_PRIVATE_DELIVERY_VERIFIED';
