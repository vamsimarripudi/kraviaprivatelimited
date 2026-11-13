-- All 81 event definitions exist, but provider delivery starts OFF.
DO $begin$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81 THEN
    RAISE EXCEPTION 'Lifecycle catalog does not cover 81 distinct events';
  END IF;
  IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
    RAISE EXCEPTION 'Office lifecycle mail migration unexpectedly enabled delivery';
  END IF;
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>31 THEN
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
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','DEV-04',true,
 pg_catalog.now(),'Synthetic approved performance scheduling event');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','DEV-06',true,
 pg_catalog.now(),'Synthetic finalised personal development plan event');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','DEV-07',true,
 pg_catalog.now(),'Synthetic approved assigned Office task notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-06',true,
 pg_catalog.now(),'Synthetic verified immutable payslip availability notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ROLE-02',true,
 pg_catalog.now(),'Synthetic authorised access-role mutation notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ROLE-08',true,
 pg_catalog.now(),'Synthetic independently recorded access review decision');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-03',true,
 pg_catalog.now(),'Synthetic Finance preparer period opening notification');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-05',true,
 pg_catalog.now(),'Synthetic independent payroll approval completion');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-07',true,
 pg_catalog.now(),'Synthetic prepared salary batch with no bank credit');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','TIME-03',true,
 pg_catalog.now(),'Synthetic independent People owner attendance correction review');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ONB-02',true,
 pg_catalog.now(),'Synthetic required role-package checklist assignment');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','DEV-03',true,
 pg_catalog.now(),'Independent training evidence completion review notice');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','TIME-01',true,
 pg_catalog.now(),'Independent effective-dated work policy approval notice');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','TIME-08',true,
 pg_catalog.now(),'Independent reviewed flex leave decision notice');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-08',true,
 pg_catalog.now(),'Independently bank-verified full salary settlement notice');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','PAY-09',true,
 pg_catalog.now(),'Independently verified partial salary credit with unpaid balance');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ONB-10',true,
 pg_catalog.now(),'Independently verified completed joining and mandatory checklist');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','ONB-01',true,
 pg_catalog.now(),'Synthetic independently approved joining and immutable employee identity');
SELECT public.office_lifecycle_mail_policy_set(
 'a0000000-0000-4000-8000-000000000001','HIRE-07',true,
 pg_catalog.now(),'Independent internal review of a real pending employment offer');

INSERT INTO public.office_employee_intake_events(employee_user_id,event_type)
VALUES
 ('a0000000-0000-4000-8000-000000000002','PROFILE_RETURNED'),
 ('a0000000-0000-4000-8000-000000000004','PROFILE_RETURNED');
INSERT INTO public.office_employee_intake_events(employee_user_id,actor_user_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002',
       'a0000000-0000-4000-8000-000000000001','REFERENCE_ID_ISSUED');
-- A forged self-issued reference event is not an authorised welcome.
INSERT INTO public.office_employee_intake_events(employee_user_id,actor_user_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002',
       'a0000000-0000-4000-8000-000000000002','REFERENCE_ID_ISSUED');
INSERT INTO public.office_role_package_events(target_user_id,application_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000008','PACKAGE_APPLIED');
INSERT INTO public.office_recruitment_events(
  offer_id,actor_user_id,event_type,new_status,metadata)
VALUES('c0000000-0000-4000-8000-000000000013',
 'a0000000-0000-4000-8000-000000000002',
 'OFFER_SUBMITTED','PENDING_APPROVAL',
 '{"approval_request_id":"c0000000-0000-4000-8000-000000000011"}'::jsonb);
-- Only the independently assigned corporate reviewer is a recipient.
-- The last required task must be signed off independently before onboarding
-- may be recorded as complete. This is not the same as the initial assignment.
UPDATE public.office_role_package_onboarding_tasks SET
 status='VERIFIED',reviewed_by='a0000000-0000-4000-8000-000000000003',
 submitted_by='a0000000-0000-4000-8000-000000000002',
 reviewed_at=pg_catalog.now()
WHERE id='e0000000-0000-4000-8000-000000000009';
INSERT INTO public.office_role_package_events(
 target_user_id,application_id,task_id,actor_user_id,event_type
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000008',
 'e0000000-0000-4000-8000-000000000009',
 'a0000000-0000-4000-8000-000000000003',
 'TASK_VERIFIED'
);
INSERT INTO public.office_worktime_events(case_id,event_type)
VALUES('b0000000-0000-4000-8000-000000000002','APPROVED');
INSERT INTO public.office_worktime_events(case_id,actor_user_id,event_type)
VALUES('b0000000-0000-4000-8000-000000000005',
 'a0000000-0000-4000-8000-000000000002','SUBMITTED');
INSERT INTO public.office_department_transfer_events(transfer_id,department_code,event_type)
VALUES('c0000000-0000-4000-8000-000000000001','ENGINEERING','ACCEPTED');
INSERT INTO public.office_auth_events(user_id,event_type)
VALUES('a0000000-0000-4000-8000-000000000002','SESSION_REVOKED');
INSERT INTO public.office_people_development_events(
  target_user_id,training_assignment_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000001','TRAINING_ASSIGNED','ASSIGNED');
INSERT INTO public.office_people_development_events(
  target_user_id,actor_user_id,training_assignment_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000003',
 'd0000000-0000-4000-8000-000000000005','TRAINING_UPDATED','COMPLETED');
-- Self-completed records are not evidence of an independent reviewer decision.
INSERT INTO public.office_people_development_events(
  target_user_id,actor_user_id,training_assignment_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000005','TRAINING_UPDATED','COMPLETED');
INSERT INTO public.office_people_development_events(
  target_user_id,performance_review_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000002','PERFORMANCE_UPDATED','FINAL');
INSERT INTO public.office_payroll_events(
  compensation_version_id,event_type,metadata)
VALUES('d0000000-0000-4000-8000-000000000003',
 'COMPENSATION_APPROVAL_SYNCED','{"compensation_status":"APPROVED"}'::jsonb);
INSERT INTO public.office_people_development_events(
  target_user_id,performance_review_id,event_type,new_status)
VALUES('a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000004','PERFORMANCE_CREATED','DRAFT');
INSERT INTO public.office_task_events(task_id,event_type)
VALUES('e0000000-0000-4000-8000-000000000001','CREATED');
INSERT INTO public.office_salary_payslip_issues(
  id,payroll_result_id,employee_user_id,issued_by,snapshot_sha256,issued_at
) VALUES('f0000000-0000-4000-8000-000000000004',
 'f0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000001',repeat('a',64),pg_catalog.now());
INSERT INTO public.office_access_audit(actor_user_id,target_user_id,action)
VALUES('a0000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000002','ROLE_GRANTED');
INSERT INTO public.office_access_audit(actor_user_id,target_user_id,action)
VALUES('a0000000-0000-4000-8000-000000000003',
 'a0000000-0000-4000-8000-000000000002','ACCESS_REVIEW_APPROVED');
INSERT INTO public.office_payroll_events(actor_user_id,period_id,event_type,metadata)
VALUES('a0000000-0000-4000-8000-000000000003',
 'f0000000-0000-4000-8000-000000000006','PAYROLL_PERIOD_OPENED','{}'::jsonb);
INSERT INTO public.office_payroll_events(actor_user_id,period_id,event_type,metadata)
VALUES('a0000000-0000-4000-8000-000000000001',
 'f0000000-0000-4000-8000-000000000001','PAYROLL_APPROVAL_SYNCED',
 '{"payroll_status":"APPROVED"}'::jsonb);
INSERT INTO public.office_payroll_events(actor_user_id,period_id,batch_id,event_type,metadata)
VALUES('a0000000-0000-4000-8000-000000000003',
 'f0000000-0000-4000-8000-000000000001',
 'f0000000-0000-4000-8000-000000000007',
 'SALARY_BATCH_PREPARED','{"bank_execution":false}'::jsonb);

UPDATE public.office_worktime_policy_versions
  SET status='APPROVED',approved_by='a0000000-0000-4000-8000-000000000001',
      approved_at=pg_catalog.now()
WHERE id='b0000000-0000-4000-8000-000000000006';
UPDATE public.office_flex_day_requests
  SET status='APPROVED',reviewed_by='a0000000-0000-4000-8000-000000000001',
      reviewed_at=pg_catalog.now()
WHERE id='b0000000-0000-4000-8000-000000000007';
-- A self-reviewed flex decision must never produce a corporate notification.
UPDATE public.office_flex_day_requests
  SET status='APPROVED',reviewed_by='a0000000-0000-4000-8000-000000000002',
      reviewed_at=pg_catalog.now()
WHERE id='b0000000-0000-4000-8000-000000000008';

-- Only independent confirmed full-net salary credit creates PAY-08.
UPDATE public.office_salary_settlement_evidence SET
  status='VERIFIED',
  verified_by='a0000000-0000-4000-8000-000000000001',
  verified_at=pg_catalog.now()
WHERE id='f0000000-0000-4000-8000-000000000009';

-- A verified but partial credit is not evidence of fully paid salary.
UPDATE public.office_salary_settlement_evidence SET
  status='VERIFIED',verified_by='a0000000-0000-4000-8000-000000000001',
  verified_at=pg_catalog.now()
WHERE id='f0000000-0000-4000-8000-000000000011';
-- An employee's own approval is not independent bank evidence.
UPDATE public.office_salary_settlement_evidence SET
  status='VERIFIED',verified_by='a0000000-0000-4000-8000-000000000002',
  verified_at=pg_catalog.now()
WHERE id='f0000000-0000-4000-8000-000000000015';


DO $prove$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>31 THEN
    RAISE EXCEPTION 'Expected thirty-one grounded, committed lifecycle mail records';
  END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='PAY-06')<>1 THEN
   RAISE EXCEPTION 'Immutable approved payslip did not create one private notice';
 END IF;
  IF (SELECT count(*) FROM public.office_payroll_events WHERE event_type='BANK_SALARY_CREDIT_VERIFIED')<>1 THEN
  RAISE EXCEPTION 'Partial or self-reviewed settlements fabricated paid-salary audit evidence';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='PAY-08')<>1 THEN
   RAISE EXCEPTION 'Salary paid notice requires independently verified full net bank credit';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox
   WHERE event_code='HIRE-07' AND recipient_user_id='a0000000-0000-4000-8000-000000000003')<>1 THEN
   RAISE EXCEPTION 'Offer approval review must target one independently assigned internal reviewer';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='ONB-01')<>1 THEN
   RAISE EXCEPTION 'Welcome aboard requires independently issued real employee reference and active joining';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='ONB-10')<>1 THEN
   RAISE EXCEPTION 'Verified intake and mandatory onboarding evidence did not complete safely';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='PAY-09')<>1 THEN
   RAISE EXCEPTION 'Partial bank credit must remain outstanding until fully paid';
 END IF;
 IF (SELECT count(*) FROM public.office_payroll_events WHERE event_type='BANK_SALARY_PARTIAL_VERIFIED')<>1 THEN
   RAISE EXCEPTION 'Independently verified partial credit audit missing';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='TIME-01')<>1
   OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='TIME-08')<>1 THEN
   RAISE EXCEPTION 'Independent effective work-policy and Flex decisions must each be recorded once';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE event_code='DEV-03')<>1 THEN
   RAISE EXCEPTION 'Training evidence notification requires independent reviewer';
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
-- The private worker deliberately caps a single claim at 25; exhaust a
-- second batch without duplicating any accepted provider submission.
INSERT INTO ci_claims SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;

DO $claim$
BEGIN
 IF (SELECT count(*) FROM pg_temp.ci_claims)<>30 THEN
   RAISE EXCEPTION 'Employee lifecycle claim count mismatch: observed %, still pending codes %, total pending %',
      (SELECT count(*) FROM pg_temp.ci_claims),
      (SELECT pg_catalog.string_agg(event_code,',') FROM public.office_lifecycle_mail_outbox WHERE status='PENDING'),
      (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='PENDING');
 END IF;
 IF (SELECT count(*) FROM pg_temp.ci_claims WHERE event_code='PAY-08' AND pay_period='2026-11')<>1 THEN
   RAISE EXCEPTION 'Real payroll period missing from independently verified paid-salary claim';
 END IF;
 IF (SELECT count(*) FROM pg_temp.ci_claims WHERE event_code='PAY-09' AND pay_period='2026-11')<>1 THEN
   RAISE EXCEPTION 'Independently verified partial-credit period missing';
 END IF;
 IF (SELECT count(*) FROM pg_temp.ci_claims WHERE event_code='PAY-06' AND pay_period='2026-11')<>1 THEN
   RAISE EXCEPTION 'Verified payroll period missing from approved notice claim';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='SENDING')<>30 THEN
   RAISE EXCEPTION 'Twenty-two verified notifications were not claimed atomically';
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
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='UNKNOWN')<>29 THEN
   RAISE EXCEPTION 'Stale submission was not quarantined rather than retried';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_events WHERE event_type='STALE_UNKNOWN')<>29 THEN
   RAISE EXCEPTION 'Stale lifecycle mail events lack audit evidence';
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox WHERE status='SENT')<>1 THEN
   RAISE EXCEPTION 'Provider acceptance was overwritten or re-sent';
 END IF;
END;
$verify$;
SELECT 'LIFECYCLE_MAIL_ROUTES_VERIFIED' AS result;
