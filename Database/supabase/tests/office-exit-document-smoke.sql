-- Synthetic document evidence only. No template publication or mail.
BEGIN;
DO $privacy$
BEGIN
 IF has_table_privilege('anon','public.office_exit_document_proofs','SELECT')
 OR has_function_privilege(
   'authenticated','public.office_exit_document_source_valid(bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Private relieving document proof is publicly visible'; END IF;
END $privacy$;

SELECT public.office_exit_contact_record(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'former.staff@example.net','SIGNED_EXIT_FORM',
 'Synthetic verified signed exit contact DOC-2026-11',
 'Recorded separate former employee email with signed consent');
SELECT public.office_exit_contact_decide(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 true,'Owner independently verified synthetic external contact');

UPDATE public.office_identity_users SET status='REVOKED'
 WHERE user_id='33333333-3333-4333-8333-333333333333';
UPDATE public.office_employment_registry SET end_date=CURRENT_DATE
 WHERE identity_user_id='33333333-3333-4333-8333-333333333333';
INSERT INTO public.office_requests(id,request_type_code,target_user_id,status)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','EMPLOYEE_OFFBOARDING',
 '33333333-3333-4333-8333-333333333333','FULFILLED');

-- A generic signed document is not an HR relieving document.
INSERT INTO public.office_document_instances(
 id,document_code,template_id,subject_type,subject_reference,status,
 approved_by,approved_at,signed_at
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','KR-DOC-00000001',
 'f1000000-0000-4000-8000-000000000003','EMPLOYEE',
 '33333333-3333-4333-8333-333333333333','DELIVERED',
 '11111111-1111-4111-8111-111111111111',now(),now());
INSERT INTO public.office_document_signature_evidence(
 id,document_instance_id,status,signed_at,signed_sha256
) VALUES(
 'aaaaaaaa-bbbb-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','VERIFIED',now(),
 repeat('a',64));
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,provider_reference,event_type
) VALUES(
 'aaaaaaaa-cccc-4aaa-8aaa-aaaaaaaaaaaa',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'SECURE_LINK','synthetic-delivery-reference','DOCUMENT_DELIVERED');
INSERT INTO public.office_document_engine_events(
 document_instance_id,event_type,metadata
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'DOCUMENT_DELIVERED',
 '{"delivery_event_id":"aaaaaaaa-cccc-4aaa-8aaa-aaaaaaaaaaaa"}'::jsonb);

DO $negative$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_exit_document_proofs) THEN
  RAISE EXCEPTION 'Generic document generated an unauthorized EXIT-07 notice'; END IF;
END $negative$;

-- Real signed HR relieving document: independently approved, verified signed
-- file evidence, external delivery record and already fulfilled offboarding.
INSERT INTO public.office_document_instances(
 id,document_code,template_id,subject_type,subject_reference,status,
 approved_by,approved_at,signed_at
) VALUES(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','KR-DOC-00000002',
 'f1000000-0000-4000-8000-000000000001','EMPLOYEE',
 '33333333-3333-4333-8333-333333333333','DELIVERED',
 '11111111-1111-4111-8111-111111111111',now(),now());
INSERT INTO public.office_document_signature_evidence(
 id,document_instance_id,status,signed_at,signed_sha256
) VALUES(
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','VERIFIED',now(),
 repeat('c',64));
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,provider_reference,event_type
) VALUES(
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc','SECURE_LINK',
 'synthetic-provider-document-delivered','DOCUMENT_DELIVERED');
INSERT INTO public.office_document_engine_events(
 document_instance_id,event_type,metadata
) VALUES(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'DOCUMENT_DELIVERED',
 '{"delivery_event_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}'::jsonb);

DO $positive$
DECLARE v_id bigint;
BEGIN
 IF (SELECT count(*) FROM public.office_exit_document_proofs)<>1 THEN
  RAISE EXCEPTION 'Expected one signed relieving document source proof'; END IF;
 SELECT id INTO v_id FROM public.office_exit_document_proofs;
 IF NOT public.office_exit_document_source_valid(v_id) THEN
  RAISE EXCEPTION 'Verified, signed and delivered EXIT-07 proof rejected'; END IF;
END $positive$;

SELECT public.office_exit_contact_revoke(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'Former employee withdrew all external document notices');

DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_exit_document_proofs proof
  WHERE public.office_exit_document_source_valid(proof.id))
 THEN RAISE EXCEPTION 'Revoked contact still enabled document notice'; END IF;
END $revoked$;
ROLLBACK;
SELECT 'OFFICE_EXIT_DOCUMENT_EVIDENCE_VERIFIED' AS result;
