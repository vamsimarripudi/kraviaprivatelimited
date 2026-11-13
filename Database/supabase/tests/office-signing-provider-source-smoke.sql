-- Synthetic provider-source proof only. No URLs, real mail, or signing tokens.
BEGIN;
DO $privacy$
BEGIN
 IF has_table_privilege('anon','public.office_onboarding_signing_proofs','SELECT')
 OR has_function_privilege(
  'authenticated','public.office_onboarding_signing_source_valid(bigint)','EXECUTE')
 THEN RAISE EXCEPTION 'Signing proof is exposed to an untrusted role'; END IF;
END $privacy$;

INSERT INTO public.office_document_instances(
 id,document_code,subject_type,subject_reference,status,
 created_by,approved_by,approved_at,signed_at
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','HR_APPOINTMENT',
 'EMPLOYEE','33333333-3333-4333-8333-333333333333',
 'DELIVERED',
 '22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',now(),NULL
);
-- A private record without a provider acknowledgement cannot be treated as
-- an issued signing link.
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,destination_masked,
 provider_reference,event_type
) VALUES(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ESIGN','***@example.com',NULL,'SIGNING_LINK_ISSUED'
);
INSERT INTO public.office_document_engine_events(
 document_instance_id,event_type,metadata
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DOCUMENT_DELIVERED',
 '{"delivery_event_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}'::jsonb
);
DO $rejected$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_onboarding_signing_proofs)
 THEN RAISE EXCEPTION 'Unissued signing link produced a provider proof'; END IF;
END $rejected$;

-- A real provider reference, independently approved HR document, and
-- masked address may be recorded without creating or leaking the link.
INSERT INTO public.office_document_delivery_events(
 id,document_instance_id,channel,destination_masked,
 provider_reference,event_type
) VALUES(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'ESIGN','***@example.com','synthetic-esign-provider-proof-2026',
 'SIGNING_LINK_ISSUED'
);
INSERT INTO public.office_document_engine_events(
 document_instance_id,event_type,metadata
) VALUES(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DOCUMENT_DELIVERED',
 '{"delivery_event_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}'::jsonb
);
DO $verified$
DECLARE v_id bigint;
BEGIN
 IF (SELECT count(*) FROM public.office_onboarding_signing_proofs)<>1
 THEN RAISE EXCEPTION 'Expected exactly one independent provider proof'; END IF;
 SELECT id INTO v_id FROM public.office_onboarding_signing_proofs;
 IF NOT public.office_onboarding_signing_source_valid(v_id)
 THEN RAISE EXCEPTION 'Provider-issued link evidence was incorrectly rejected'; END IF;
END $verified$;

UPDATE public.office_document_instances SET signed_at=now()
 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $stale$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_onboarding_signing_proofs proof
  WHERE public.office_onboarding_signing_source_valid(proof.id))
 THEN RAISE EXCEPTION 'Already signed document kept an active signing-link proof'; END IF;
END $stale$;
ROLLBACK;
SELECT 'ONBOARDING_SIGNING_PROVIDER_PROOF_VERIFIED' AS result;
