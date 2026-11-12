-- Explicit policy starts disabled and cannot dispatch existing events.
INSERT INTO public.office_employee_mail_outbox(employee_user_id,recipient_email,kind,reference_code,status)
VALUES('a0000000-0000-4000-8000-000000000004',
 'synthetic.historical@kraviaprivatelimited.com','EMPLOYEE_ID_ISSUED','KRV-E26-AAAABBBBCCCCDDDD','PENDING');
DO $check$
BEGIN
 IF (SELECT enabled FROM public.office_employee_mail_delivery_policy WHERE key='EMPLOYEE_ID_ISSUED')
 THEN RAISE EXCEPTION 'New corporate mail delivery policy was enabled by migration'; END IF;
 IF (SELECT count(*) FROM public.office_employee_mail_claim(10))<>0
 THEN RAISE EXCEPTION 'Disabled corporate mail gate returned claims'; END IF;
 IF pg_catalog.has_table_privilege('kravia_office_backend','public.office_employee_mail_outbox','SELECT') OR
    pg_catalog.has_table_privilege('kravia_office_backend','public.office_employee_mail_outbox','UPDATE')
 THEN RAISE EXCEPTION 'Backend should only call restricted outbox functions'; END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_employee_mail_claim(integer)','EXECUTE') OR
    pg_catalog.has_function_privilege('authenticated','public.office_employee_mail_finish(uuid,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Browser roles may dispatch corporate emails'; END IF;
END;
$check$;

-- New, explicitly effective policy cannot trigger old messages.
SELECT public.office_employee_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001',true,pg_catalog.now(),
 'Synthetic isolated worker integration test approval'
);
INSERT INTO public.office_employee_mail_outbox(employee_user_id,recipient_email,kind,reference_code,status)
VALUES
 ('a0000000-0000-4000-8000-000000000002','synthetic.employee@kraviaprivatelimited.com',
  'EMPLOYEE_ID_ISSUED','KRV-E26-0123456789ABCDEF','PENDING'),
 ('a0000000-0000-4000-8000-000000000003','synthetic.unverified@kraviaprivatelimited.com',
  'EMPLOYEE_ID_ISSUED','KRV-E26-FEDCBA9876543210','PENDING');

SET ROLE kravia_office_backend;
CREATE TEMP TABLE ci_claims AS
SELECT * FROM public.office_employee_mail_claim(25);
RESET ROLE;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_temp.ci_claims)<>1
 THEN RAISE EXCEPTION 'Expected exactly one newly approved verified employee outbox claim'; END IF;
 IF (SELECT count(*) FROM pg_temp.ci_claims WHERE recipient_email='synthetic.employee@kraviaprivatelimited.com')<>1
 THEN RAISE EXCEPTION 'Claim did not bind exact eligible corporate email'; END IF;
 IF (SELECT count(*) FROM public.office_employee_mail_outbox WHERE status='SENDING')<>1
 THEN RAISE EXCEPTION 'Claim is not recorded as SENDING'; END IF;
 IF (SELECT count(*) FROM public.office_employee_mail_outbox WHERE status='PENDING')<>2
 THEN RAISE EXCEPTION 'Historical and unverified notices were not preserved'; END IF;
END;
$verify$;

SET ROLE kravia_office_backend;
SELECT public.office_employee_mail_finish(outbox_id,claim_token,'SENT','ci-provider-accepted')
FROM pg_temp.ci_claims;
RESET ROLE;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.office_employee_mail_outbox
     WHERE status='SENT' AND provider_message_id='ci-provider-accepted')<>1
 THEN RAISE EXCEPTION 'Provider acceptance did not finalize exact one claimed message'; END IF;
 IF (SELECT count(*) FROM public.office_employee_mail_delivery_events WHERE event_type='ACCEPTED')<>1
 THEN RAISE EXCEPTION 'Provider acceptance audit event missing'; END IF;
END;
$verify$;

-- A crash after starting provider submission is an UNKNOWN, never auto-resend.
UPDATE public.office_employee_mail_outbox SET status='SENDING',
 claim_token=pg_catalog.gen_random_uuid(),
 claimed_at=pg_catalog.now()-interval '1 hour'
WHERE status='PENDING' AND employee_user_id='a0000000-0000-4000-8000-000000000003';

SET ROLE kravia_office_backend;
SELECT count(*) AS new_claims_after_finalization
FROM public.office_employee_mail_claim(25);
RESET ROLE;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.office_employee_mail_outbox WHERE status='UNKNOWN')<>1
 THEN RAISE EXCEPTION 'Stale mail claim was not quarantined as UNKNOWN'; END IF;
 IF (SELECT count(*) FROM public.office_employee_mail_outbox WHERE status='SENT')<>1
 THEN RAISE EXCEPTION 'Accepted provider notification was not idempotent'; END IF;
 IF (SELECT count(*) FROM public.office_employee_mail_delivery_events
     WHERE event_type='STALE_CLAIM_UNKNOWN')<>1
 THEN RAISE EXCEPTION 'Stale-claim audit record missing'; END IF;
END;
$verify$;
SELECT 'EMPLOYEE_MAIL_DELIVERY_VERIFIED' AS verification;
