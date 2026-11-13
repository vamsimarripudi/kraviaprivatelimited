-- All 81 event definitions exist, but provider delivery starts OFF.
DO $begin$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81 THEN
    RAISE EXCEPTION 'Lifecycle catalog does not cover 81 distinct events';
  END IF;
  IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
    RAISE EXCEPTION 'Office lifecycle mail migration unexpectedly enabled delivery';
  END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>12 THEN
    RAISE EXCEPTION 'Source-ready events must be accurately distinguished from unmapped events';
  END IF;
  IF pg_catalog.has_table_privilege('anon','public.office_lifecycle_mail_outbox','SELECT') OR
     pg_catalog.has_table_privilege('authenticated','public.office_lifecycle_mail_policy','SELECT') OR
     pg_catalog.has_function_privilege('service_role','public.office_lifecycle_mail_claim(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Lifecycle database mail controls leaked to browser or wrong worker role';
  END IF;
END;
$begin$;

-- Historical event: no outbox record when gate was disabled.
INSERT INTO public.office_employee_intake_events(employee_user_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002','PROFILE_RETURNED');
DO $history$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>0 THEN
    RAISE EXCEPTION 'Historical lifecycle source unexpectedly queued mail';
 END IF;
END;
$history$;

-- An Owner cannot enable unmapped events.
DO $deny$
DECLARE refused boolean:=false;
BEGIN
  BEGIN
    PERFORM public.office_lifecycle_mail_policy_set(
      'a0000000-0000-4000-8000-000000000001','HIRE-01',true,
      pg_catalog.now(),'Synthetic, strictly isolated candidate event approval');
  EXCEPTION WHEN others THEN refused:=true;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'Unmapped lifecycle event became sendable'; END IF;
END;
$deny$;

SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ONB-05',true,
 pg_catalog.now(),'Synthetic approved onboarding review notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ROLE-09',true,
 pg_catalog.now(),'Synthetic approved role package notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','TIME-04',true,
 pg_catalog.now(),'Synthetic approved worktime review notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ROLE-05',true,
 pg_catalog.now(),'Synthetic approved department handover notice');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','AUTH-11',true,
 pg_catalog.now(),'Synthetic approved session revocation notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','DEV-01',true,
 pg_catalog.now(),'Synthetic approved training assignment event notice');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','DEV-05',true,
 pg_catalog.now(),'Synthetic reviewed performance outcome notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-02',true,
 pg_catalog.now(),'Synthetic independently approved compensation change');

INSERT INTO public.office_employee_intake_events(employee_user_id,event_type)
VALUES
 ('a0000000-0000-4000-8000-000000000002','PROFILE_RETURNED'),
 ('a0000000-0000-4000-8000-000000000004','PROFILE_RETURNED');
INSERT INTO public.office_role_package_events(target_user_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002','PACKAGE_APPLIED');
INSERT INTO public.office_worktime_events(case_id,event_type)
VALUES('b0000000-0000-4000-8000-000000000002','APPROVED');
INSERT INTO public.office_department_transfer_events(transfer_id,department_code,event_type)
VALUES('c0000000-0000-4000-8000-000000000001','ENGINEERING','ACCEPTED');
INSERT INTO public.office_auth_events(user_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002','SESSION_REVOKED');
INSERT INTO public.office_people_development_events(
  target_user_id,training_assignment_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000001','TRAINING_ASSIGNED','ASSIGNED');
INSERT INTO public.office_people_development_events(
  target_user_id,performance_review_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000002','PERFORMANCE_UPDATED','FINAL');
INSERT INTO public.office_payroll_events(
  compensation_version_id,event_type,metadata)
VALUES('d0000000-0000-4000-8000-000000000003',
 'COMPENSATION_APPROVAL_SYNCED','{"compensation_status":"APPROVED"}'::jsonb);

DO $prove$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>10 THEN
    RAISE EXCEPTION 'Expected exactly 7 grounded, committed lifecycle mail records';
  END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='ROLE-05')<>2 THEN
    RAISE EXCEPTION 'Handover did not notify both actual department parties';
  END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='ROLE-09')<>1 THEN
    RAISE EXCEPTION 'Role package event was not routed exactly once';
  END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='ONB-09')<>0 THEN
    RAISE EXCEPTION 'Unapproved role event must not be queued';
  END IF;
END;
$prove$;

SET ROLE kravia_office_backend;
CREATE TEMP TABLE ci_claims AS SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;

DO $claim$
BEGIN
 IF (SELECT count(*) FROM pg_temp.ci_claims)<>9 THEN
   RAISE EXCEPTION 'Suspended identity must not receive an employee notification';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='SENDING')<>9 THEN
   RAISE EXCEPTION 'Nine verified notifications were not claimed atomically';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_lifecycle_mail_finish(uuid,uuid,text,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Browser role can finalize provider status';
 END IF;
END;
$claim$;

SET ROLE kravia_office_backend;
SELECT public.office_lifecycle_mail_finish(outbox_id,claim_token,'SENT','ci-provider-accepted')
FROM pg_temp.ci_claims WHERE event_code='ROLE-09';
RESET ROLE;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox
    WHERE status='SENT' AND provider_message_id='ci-provider-accepted')<>1 THEN
    RAISE EXCEPTION 'Claim was not finalized from a verified worker token';
  END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_events WHERE event_type='ACCEPTED')<>1 THEN
    RAISE EXCEPTION 'Provider acceptance was not audited';
  END IF;
END;
$verify$;

-- Crashes are quarantined after the timeout. They must not be resent.
UPDATE public.office_lifecycle_mail_outbox
  SET claimed_at=pg_catalog.now()-interval '1 hour'
WHERE status='SENDING';
SET ROLE kravia_office_backend;
SELECT count(*) AS safe_claims_after_timeout FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='UNKNOWN')<>8 THEN
   RAISE EXCEPTION 'Stale submission was not quarantined rather than retried';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_events WHERE event_type='STALE_UNKNOWN')<>8 THEN
   RAISE EXCEPTION 'Stale lifecycle mail events lack audit evidence';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='SENT')<>1 THEN
   RAISE EXCEPTION 'Provider acceptance was overwritten or re-sent';
 END IF;
END;
$verify$;
SELECT 'LIFECYCLE_MAIL_ROUTES_VERIFIED' AS result;
