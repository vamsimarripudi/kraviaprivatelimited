-- Synthetic completion only: no bank execution, real HR document or email.
BEGIN;
SELECT public.office_exit_contact_record(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'former.person@example.net','SIGNED_EXIT_FORM',
 'Synthetic independently signed exit consent EX-2026',
 'HR recorded former-employee written notice preference');
SELECT public.office_exit_contact_decide(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',true,
 'Owner independently accepted source-backed contact consent');

UPDATE public.office_identity_users SET status='REVOKED'
 WHERE user_id='33333333-3333-4333-8333-333333333333';
UPDATE public.office_employment_registry
 SET status='ENDED',end_date=CURRENT_DATE
 WHERE identity_user_id='33333333-3333-4333-8333-333333333333';
INSERT INTO public.office_requests(id,request_type_code,target_user_id,status)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'EMPLOYEE_OFFBOARDING','33333333-3333-4333-8333-333333333333','FULFILLED');
INSERT INTO public.office_payroll_results(
 id,employee_user_id,status,currency,net_pay_minor
) VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '33333333-3333-4333-8333-333333333333','LOCKED','INR',120000);

CREATE TEMP TABLE ci_exit_case AS
 SELECT public.office_exit_settlement_open(
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Genuine synthetic offboarding settlement case entered'
 ) AS id;
INSERT INTO public.office_salary_settlement_evidence(
 id,payroll_result_id,amount_minor,currency,status,submitted_by,
 verified_by,verified_at
) VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',120000,'INR','VERIFIED',
 '22222222-2222-4222-8222-222222222222',
 '44444444-4444-4444-8444-444444444444',now());
SELECT public.office_exit_settlement_verify(
 '11111111-1111-4111-8111-111111111111',
 (SELECT id FROM pg_temp.ci_exit_case),
 'Owner accepted independent net salary credit verification');

-- Signed and independently verified relieving document was delivered, rather
-- than just drafted or marked ready without a signature.
INSERT INTO public.office_document_instances(
 id,document_code,template_id,subject_type,subject_reference,status,
 approved_by,approved_at,signed_at
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','KR-DOC-00000004',
 'f1000000-0000-4000-8000-000000000001','EMPLOYEE',
 '33333333-3333-4333-8333-333333333333',
 'DELIVERED','11111111-1111-4111-8111-111111111111',now(),now());
INSERT INTO public.office_document_signature_evidence(
 id,document_instance_id,status,signed_at,signed_sha256
) VALUES('aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','VERIFIED',now(),repeat('f',64));
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,provider_reference,event_type
) VALUES('aaaaaaaa-cccc-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SECURE_LINK',
 'synthetic-signed-exit-document-provider-reference','DELIVERED');
INSERT INTO public.office_document_engine_events(
 document_instance_id,event_type,metadata
) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'DOCUMENT_DELIVERED',
 '{"delivery_event_id":"aaaaaaaa-cccc-4aaa-8aaa-aaaaaaaaaaaa"}'::jsonb);

-- An assigned asset with security wipe still pending blocks completion.
INSERT INTO public.office_asset_lifecycle(
 asset_id,custodian_user_id,lifecycle_status,
 security_wipe_required,wipe_verified_by
) VALUES('Synthetic-KRAVIA-Device-01',
 '33333333-3333-4333-8333-333333333333','ASSIGNED',true,NULL);

DO $before$
BEGIN
 IF public.office_exit_completion_preflight(
  (SELECT id FROM pg_temp.ci_exit_case)) THEN
  RAISE EXCEPTION 'Incomplete asset return was marked as done'; END IF;
 BEGIN
  PERFORM public.office_exit_completion_record(
   '11111111-1111-4111-8111-111111111111',
   (SELECT id FROM pg_temp.ci_exit_case),
   'Owner attempts to close before security asset wipe');
  RAISE EXCEPTION 'Owner bypassed outstanding asset safeguards';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Outstanding salary, asset, document or access controls%' THEN
    RAISE; END IF;
 END;
END $before$;

UPDATE public.office_asset_lifecycle
 SET lifecycle_status='READY_FOR_REISSUE',
     wipe_verified_by='11111111-1111-4111-8111-111111111111'
 WHERE asset_id='Synthetic-KRAVIA-Device-01';

DO $complete$
DECLARE v_id bigint;
BEGIN
 IF NOT public.office_exit_completion_preflight(
   (SELECT id FROM pg_temp.ci_exit_case)) THEN
  RAISE EXCEPTION 'Completed controls failed signoff preflight'; END IF;
 v_id:=public.office_exit_completion_record(
   '11111111-1111-4111-8111-111111111111',
   (SELECT id FROM pg_temp.ci_exit_case),
   'Owner independently signed off all People, finance and device evidence'
 );
 IF NOT public.office_exit_completion_source_valid(v_id) THEN
  RAISE EXCEPTION 'Final governed EXIT-08 proof was rejected'; END IF;
 IF (SELECT count(*) FROM public.office_exit_completion_proofs)<>1 THEN
  RAISE EXCEPTION 'Offboarding completion was duplicated'; END IF;
END $complete$;

SELECT public.office_exit_contact_revoke(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'Former employee withdrew the authorized external address');

DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_exit_completion_proofs proof
    WHERE public.office_exit_completion_source_valid(proof.id))
 THEN RAISE EXCEPTION 'EXIT-08 survived consent revocation'; END IF;
END $revoked$;
ROLLBACK;
SELECT 'OFFICE_EXIT_COMPLETION_EVIDENCE_VERIFIED' AS result;
