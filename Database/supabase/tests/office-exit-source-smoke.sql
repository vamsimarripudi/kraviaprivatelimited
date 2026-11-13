-- Disposable PostgreSQL fixture, no external email and no production data.
BEGIN;
DO $check$
BEGIN
 IF has_table_privilege('anon','public.office_exit_notification_proofs','SELECT')
  OR has_table_privilege('authenticated','public.office_exit_notification_proofs','SELECT')
  OR has_function_privilege(
    'anon','public.office_exit_notification_source_valid(bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Exit source evidence exposed to untrusted clients'; END IF;
END $check$;

-- Real People contact authority; independent Owner review; no blind default.
SELECT public.office_exit_contact_record(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'former.staff@example.net','SIGNED_EXIT_FORM',
 'Synthetic consent proof from approved exit case 2026',
 'Recorded employee alternative contact with written consent');
SELECT public.office_exit_contact_decide(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 true,'Owner reviewed signed former-employee contact proof');

UPDATE public.office_employment_registry
 SET end_date=CURRENT_DATE+7
 WHERE identity_user_id='33333333-3333-4333-8333-333333333333';

-- Unrelated request actions never produce exit mail source records.
INSERT INTO public.office_requests(
 id,request_type_code,target_user_id,status
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EMPLOYEE_ONBOARDING',
 '33333333-3333-4333-8333-333333333333','APPROVED');
INSERT INTO public.office_request_events(
 request_id,actor_user_id,event_type,from_status,to_status,metadata
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 'REQUEST_APPROVED','PENDING','APPROVED','{}'::jsonb);

INSERT INTO public.office_requests(
 id,request_type_code,target_user_id,status
) VALUES(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','EMPLOYEE_OFFBOARDING',
 '33333333-3333-4333-8333-333333333333','APPROVED');
INSERT INTO public.office_request_events(
 request_id,actor_user_id,event_type,from_status,to_status,metadata
) VALUES(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111',
 'REQUEST_APPROVED','PENDING','APPROVED','{}'::jsonb);
DO $approved$
DECLARE v_id bigint;
BEGIN
 IF (SELECT count(*) FROM public.office_exit_notification_proofs)<>1 THEN
  RAISE EXCEPTION 'Approved request failed to create one verified EXIT-02 proof'; END IF;
 SELECT id INTO v_id FROM public.office_exit_notification_proofs WHERE event_code='EXIT-02';
 IF NOT public.office_exit_notification_source_valid(v_id) THEN
  RAISE EXCEPTION 'Verified EXIT-02 source incorrectly rejected'; END IF;
END $approved$;

-- No worker or email is emitted by a premature FULFILLED event.
INSERT INTO public.office_request_events(
 request_id,actor_user_id,event_type,from_status,to_status,metadata
) VALUES(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111',
 'FULFILLED','APPROVED','FULFILLED',
 '{"execution":"OFFICE_ACCESS_REVOKED"}'::jsonb);
DO $reject$
BEGIN
 IF EXISTS(
  SELECT 1 FROM public.office_exit_notification_proofs WHERE event_code='EXIT-04'
 ) THEN RAISE EXCEPTION 'Premature exit revocation notice fabricated'; END IF;
END $reject$;

-- This order matches the canonical office_execute_workforce_offboarding
-- function: revoke the identity and active sessions, record immutable event,
-- fulfil the request, then commit a FULFILLED request audit event.
UPDATE public.office_identity_users SET status='REVOKED'
 WHERE user_id='33333333-3333-4333-8333-333333333333';
INSERT INTO public.office_workforce_events(
 target_user_id,event_type
) VALUES(
 '33333333-3333-4333-8333-333333333333','WORKFORCE_ACCESS_REVOKED');
UPDATE public.office_requests SET status='FULFILLED'
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
INSERT INTO public.office_request_events(
 request_id,actor_user_id,event_type,from_status,to_status,metadata
) VALUES(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '11111111-1111-4111-8111-111111111111',
 'FULFILLED','APPROVED','FULFILLED',
 '{"execution":"OFFICE_ACCESS_REVOKED"}'::jsonb);
DO $fulfilled$
DECLARE v_id bigint;
BEGIN
 IF (SELECT count(*) FROM public.office_exit_notification_proofs)<>2 THEN
  RAISE EXCEPTION 'Expected exactly two signed offboarding source proofs'; END IF;
 SELECT id INTO v_id FROM public.office_exit_notification_proofs WHERE event_code='EXIT-04';
 IF NOT public.office_exit_notification_source_valid(v_id) THEN
  RAISE EXCEPTION 'Canonical final revocation evidence incorrectly rejected'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.office_exit_notification_proofs
  WHERE employee_user_id<>'33333333-3333-4333-8333-333333333333'::uuid
 ) THEN RAISE EXCEPTION 'Exit notice source targeted another employee'; END IF;
END $fulfilled$;

-- A changed personal address invalidates both old proofs. No stale replay.
SELECT public.office_exit_contact_record(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'another.private@example.net','VERIFIED_EMPLOYEE_REPLY',
 'Signed renewed personal address proof 2026',
 'Former employee instructed HR to replace the verified address');
DO $rotation$
BEGIN
 IF EXISTS(
   SELECT 1 FROM public.office_exit_notification_proofs proof
   WHERE public.office_exit_notification_source_valid(proof.id)
 ) THEN RAISE EXCEPTION 'Old proof inherited new unreviewed contact'; END IF;
END $rotation$;
ROLLBACK;
SELECT 'OFFICE_EXIT_SOURCE_PROOFS_VERIFIED' AS result;
