-- All values are synthetic. Transaction rolls back; zero emails or live signatures.
BEGIN;
DO $private$
BEGIN
 IF (SELECT count(*) FROM public.office_document_otp_challenges)<>0 OR
    (SELECT count(*) FROM public.office_document_otp_approvals)<>0 OR
    has_table_privilege('anon','public.office_document_otp_approvals','SELECT') OR
    has_table_privilege('authenticated','public.office_document_otp_challenges','SELECT') OR
    has_function_privilege('authenticated',
      'public.office_document_otp_approve(uuid,uuid,text,text,numeric,numeric,numeric,timestamptz)','EXECUTE') OR
    has_function_privilege('anon',
      'public.office_document_otp_begin(uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') OR
    NOT has_function_privilege('service_role',
      'public.office_document_otp_begin(uuid,uuid,uuid,uuid,text,text,text)','EXECUTE') OR
    EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
 THEN RAISE EXCEPTION 'OTP approval privacy, dispatch or migration default violation'; END IF;
END $private$;

DO $assignment$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
  PERFORM public.office_document_otp_begin(
   '33333333-3333-4333-8333-333333333333',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'suspended@kraviaprivatelimited.com',repeat('a',64),repeat('b',64));
 EXCEPTION WHEN others THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'Unassigned suspended person got a document OTP'; END IF;
END $assignment$;

DO $no_proxy_signing$
DECLARE refused boolean:=false;
BEGIN
 -- The document owner is a reviewer, but the employee subject is different.
 -- Even an issued employee ID must not permit signing for that person.
 BEGIN
  PERFORM public.office_document_otp_begin(
   '22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'ffffffff-ffff-4fff-8fff-ffffffffffff',
   'reviewer@kraviaprivatelimited.com',
   repeat('a',64),repeat('b',64));
 EXCEPTION WHEN others THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'Document owner bypassed the actual employee signer'; END IF;
END $no_proxy_signing$;

SELECT public.office_document_otp_begin(
 '11111111-1111-4111-8111-111111111111',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'synthetic.signer@kraviaprivatelimited.com',
 repeat('a',64),repeat('b',64)
);
DO $cooldown$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
  PERFORM public.office_document_otp_begin(
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   'synthetic.signer@kraviaprivatelimited.com',
   repeat('c',64),repeat('b',64));
 EXCEPTION WHEN others THEN refused:=true; END;
 IF NOT refused THEN RAISE EXCEPTION 'The request cooldown did not prevent duplicate OTPs'; END IF;
END $cooldown$;

SELECT public.office_document_otp_delivery_result(
 '11111111-1111-4111-8111-111111111111',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'SENT','synthetic-brevo-accepted'
);
DO $mismatch$
DECLARE id uuid;
BEGIN
 SELECT public.office_document_otp_approve(
 '11111111-1111-4111-8111-111111111111',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 repeat('c',64),repeat('b',64),
 17.3850,78.4867,20,now()
 ) INTO id;
 IF id IS NOT NULL OR (SELECT attempt_count FROM public.office_document_otp_challenges
 WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>1 THEN
  RAISE EXCEPTION 'Wrong code did not consume one of five OTP attempts';
 END IF;
END $mismatch$;

DO $no_fake$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
  PERFORM public.office_document_otp_approve(
    '11111111-1111-4111-8111-111111111111',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    repeat('a',64),repeat('b',64),
    NULL,NULL,NULL,NULL
  );
 EXCEPTION WHEN others THEN refused:=true; END;
 IF NOT refused OR EXISTS(SELECT 1 FROM public.office_document_otp_approvals)
 THEN RAISE EXCEPTION 'Missing device coordinates yielded a false approval'; END IF;
END $no_fake$;

DO $wrong_session$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
  PERFORM public.office_document_otp_approve(
    '11111111-1111-4111-8111-111111111111',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    repeat('a',64),repeat('d',64),
    17.3850,78.4867,20,now()
  );
 EXCEPTION WHEN others THEN refused:=true; END;
 IF NOT refused OR EXISTS(SELECT 1 FROM public.office_document_otp_approvals)
 THEN RAISE EXCEPTION 'OTP was approved from an unrelated authenticated session'; END IF;
END $wrong_session$;

-- Coordinates in this file are arbitrary CI fixtures, NEVER production location.
CREATE TEMP TABLE synthetic_approval AS
 SELECT public.office_document_otp_approve(
  '11111111-1111-4111-8111-111111111111',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  repeat('a',64),repeat('b',64),
  17.3850,78.4867,20,now()
 ) AS approval_id;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_temp.synthetic_approval WHERE approval_id IS NOT NULL)<>1
 OR (SELECT count(*) FROM public.office_document_otp_approvals)<>1
 OR NOT EXISTS(
  SELECT 1 FROM public.office_document_otp_approvals a
  WHERE a.signer_name='Synthetic Signer'
    AND a.employee_reference='KRV-E26-SYN01'
    AND a.status='APPROVED'
    AND a.method='FIRST_PARTY_EMAIL_OTP'
    AND a.location_source='BROWSER_REPORTED_UNVERIFIED'
    AND a.render_sha256=repeat('a',64)
    AND a.latitude=17.3850
    AND a.longitude=78.4867
    AND a.accuracy_m=20
    AND a.approved_at>=now()-interval '1 minute'
 )
 OR NOT EXISTS(SELECT 1 FROM public.office_document_otp_challenges
   WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' AND status='USED' AND verified_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.office_document_engine_events
   WHERE event_type='INTERNAL_EMAIL_OTP_APPROVED')
 OR NOT EXISTS(SELECT 1 FROM public.office_document_instances
   WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     AND status='RENDERED' AND signed_at IS NULL)
 THEN RAISE EXCEPTION 'OTP approval receipt, identity, server timestamp or document state invalid'; END IF;
END $verify$;
DO $no_replay$
DECLARE refused boolean:=false;
BEGIN
 BEGIN
  PERFORM public.office_document_otp_approve(
   '11111111-1111-4111-8111-111111111111',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   repeat('a',64),repeat('b',64),17.3850,78.4867,20,now()
  );
 EXCEPTION WHEN others THEN refused:=true; END;
 IF NOT refused OR (SELECT count(*) FROM public.office_document_otp_approvals)<>1
 THEN RAISE EXCEPTION 'Used OTP could create another approval receipt'; END IF;
END $no_replay$;
ROLLBACK;
SELECT 'OFFICE_DOCUMENT_OTP_APPROVAL_GATES_VERIFIED' AS result;
