-- Synthetic provider link issuance must not prevent signed-PDF recording.
BEGIN;
INSERT INTO public.office_document_instances(
 id,document_code,template_id,template_version_id,owner_user_id,
 subject_type,subject_reference,status,created_by,approved_by,approved_at
) VALUES(
 'c1111111-1111-4111-8111-111111111111','KR-DOC-00001811',
 'f1000000-0000-4000-8000-000000000002',
 'c4444444-4444-4444-8444-444444444444',
 '22222222-2222-4222-8222-222222222222',
 'EMPLOYEE','33333333-3333-4333-8333-333333333333',
 'RENDERED','22222222-2222-4222-8222-222222222222',
 '11111111-1111-4111-8111-111111111111',now()
);
INSERT INTO public.office_document_renders(id,document_instance_id,output_format)
VALUES('c2222222-2222-4222-8222-222222222222',
       'c1111111-1111-4111-8111-111111111111','PDF');

SELECT public.office_document_record_delivery(
 '22222222-2222-4222-8222-222222222222',
 'c1111111-1111-4111-8111-111111111111',
 'c2222222-2222-4222-8222-222222222222',
 'ESIGN','s***@kraviaprivatelimited.com','synthetic-provider-issue-1811',
 'SIGNING_LINK_ISSUED',
 pg_catalog.jsonb_build_object('link_expires_at',
  pg_catalog.to_char(
   (pg_catalog.now()+interval '7 days') AT TIME ZONE 'UTC',
   'YYYY-MM-DD"T"HH24:MI:SS"Z"'
  ))
);
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.office_document_instances
    WHERE id='c1111111-1111-4111-8111-111111111111'
    AND status='SIGNING' AND delivered_at IS NULL)
 OR (SELECT count(*) FROM public.office_onboarding_signing_proofs)<>1
 OR EXISTS(SELECT 1 FROM public.office_external_notice_outbox)
 THEN
  RAISE EXCEPTION 'Signing link issuance changed document to delivered or enabled mail';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_onboarding_signing_proofs
   WHERE public.office_onboarding_signing_domain_evidence_valid(id))
 THEN RAISE EXCEPTION 'Provider recording did not create source evidence'; END IF;
 IF EXISTS(SELECT 1 FROM public.office_onboarding_signing_proofs
   WHERE public.office_onboarding_signing_source_valid(id))
 THEN RAISE EXCEPTION 'Unreviewed signing reference became sendable'; END IF;
END $verify$;

-- A still-valid provider link cannot be reissued while an active one exists.
DO $reject_active$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.office_document_record_delivery(
   '22222222-2222-4222-8222-222222222222',
   'c1111111-1111-4111-8111-111111111111',
   'c2222222-2222-4222-8222-222222222222',
   'ESIGN','s***@kraviaprivatelimited.com','synthetic-second-active-link',
   'SIGNING_LINK_ISSUED',
   pg_catalog.jsonb_build_object('link_expires_at',
    pg_catalog.to_char((pg_catalog.now()+interval '7 days') AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  );
 EXCEPTION WHEN others THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unexpired signing link was reissued'; END IF;
END $reject_active$;

-- Disposable fixture simulates link expiry; production evidence is immutable.
UPDATE public.office_document_delivery_events
SET metadata=pg_catalog.jsonb_build_object('link_expires_at',
 pg_catalog.to_char((pg_catalog.now()-interval '1 day') AT TIME ZONE 'UTC',
 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
WHERE provider_reference='synthetic-provider-issue-1811';
SELECT public.office_document_record_delivery(
 '22222222-2222-4222-8222-222222222222',
 'c1111111-1111-4111-8111-111111111111',
 'c2222222-2222-4222-8222-222222222222',
 'ESIGN','s***@kraviaprivatelimited.com','synthetic-renewed-link-1811',
 'SIGNING_LINK_ISSUED',
 pg_catalog.jsonb_build_object('link_expires_at',
  pg_catalog.to_char((pg_catalog.now()+interval '7 days') AT TIME ZONE 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
);
DO $renewal$
BEGIN
 IF (SELECT count(*) FROM public.office_document_delivery_events
     WHERE document_instance_id='c1111111-1111-4111-8111-111111111111'
       AND event_type='SIGNING_LINK_ISSUED')<>2
 OR (SELECT count(*) FROM public.office_onboarding_signing_proofs
     WHERE public.office_onboarding_signing_domain_evidence_valid(id))<>1
 THEN RAISE EXCEPTION 'Expired signing request was not safely renewed'; END IF;
END $renewal$;

-- The canonical signature-evidence function allows SIGNING, not DELIVERED.
-- A finished signature must invalidate any still-unclaimed signing notice.
UPDATE public.office_document_instances
 SET status='SIGNED',signed_at=pg_catalog.now()
 WHERE id='c1111111-1111-4111-8111-111111111111';
DO $complete$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_onboarding_signing_proofs
    WHERE public.office_onboarding_signing_source_valid(id))
 THEN RAISE EXCEPTION 'Already signed document kept a live signing request'; END IF;
END $complete$;
ROLLBACK;
SELECT 'SIGNING_LINK_PRESERVES_SIGNATURE_STATE_VERIFIED' AS result;
