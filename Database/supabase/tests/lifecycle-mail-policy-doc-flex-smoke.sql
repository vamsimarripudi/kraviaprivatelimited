-- Synthetic release-gate verification; never apply to real employees.
BEGIN;
DO $before$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>57
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
  RAISE EXCEPTION 'Policy/doc release expects 57 mapped, zero enabled and empty outbox';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_lifecycle_flex_evidence_valid(uuid)','EXECUTE')
   OR pg_catalog.has_function_privilege('authenticated','public.office_lifecycle_flex_evidence_valid(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Private Flex Day verifier exposed to browser';
 END IF;
END;
$before$;

UPDATE public.office_lifecycle_mail_policy
SET enabled=true,
 approved_by='a0000000-0000-4000-8000-000000000001',
 approved_at=pg_catalog.now()-interval '2 minutes',
 effective_from=pg_catalog.now()-interval '1 minute'
WHERE event_code IN ('AUTH-10','DEV-08','ONB-08','ONB-03',
 'PAY-11','PAY-12','TIME-07','TIME-09');

-- A confirmed account lock, not a failed attempt or arbitrary free-text alert.
UPDATE public.office_auth_users SET locked_until=pg_catalog.now()+interval '30 minutes'
WHERE id='a0000000-0000-4000-8000-000000000002';
INSERT INTO public.office_auth_events_v2(
 id,user_id,session_id,event_type,metadata_json
) VALUES (
 'ci_temporarily_locked_account',
 'a0000000-0000-4000-8000-000000000002',
 NULL,'LOGIN_BLOCKED','{"reason":"temporary_lock"}'
),(
 'ci_failed_login_must_not_alert',
 'a0000000-0000-4000-8000-000000000002',
 NULL,'LOGIN_FAILED','{"reason":"invalid_password"}'
);

-- An actually published and versioned company-wide policy, with required
-- acknowledgements. Three active company identities; suspended staff excluded.
INSERT INTO public.office_policies(
 id,audience_type,audience_key,status,acknowledgement_required,current_version
) VALUES(
 'b0000000-0000-4000-8000-000000000091',
 'COMPANY',NULL,'PUBLISHED',true,1
);
INSERT INTO public.office_policy_versions(
 id,policy_id,version,status,published_by,published_at
) VALUES(
 'b0000000-0000-4000-8000-000000000092',
 'b0000000-0000-4000-8000-000000000091',1,'PUBLISHED',
 'a0000000-0000-4000-8000-000000000001',
 pg_catalog.now()
);

-- Signed appointment, with verified signature proof, unlike a draft render.
INSERT INTO public.office_document_templates(id,template_code,category,status)
VALUES(
 'b0000000-0000-4000-8000-000000000093',
 'KRAVIA_EMPLOYMENT_APPOINTMENT','HR','ACTIVE'
),(
 'b0000000-0000-4000-8000-000000000094',
 'KRAVIA_ANNUAL_WAGE_STATEMENT','FINANCE','ACTIVE'
);
INSERT INTO public.office_document_instances(
 id,template_id,subject_type,subject_reference,status,approved_by,approved_at
) VALUES (
 'b0000000-0000-4000-8000-000000000095',
 'b0000000-0000-4000-8000-000000000093','EMPLOYEE',
 'a0000000-0000-4000-8000-000000000002','DRAFT',
 'a0000000-0000-4000-8000-000000000001',pg_catalog.now()
),(
 'b0000000-0000-4000-8000-000000000096',
 'b0000000-0000-4000-8000-000000000094','EMPLOYEE',
 'a0000000-0000-4000-8000-000000000002','DRAFT',
 'a0000000-0000-4000-8000-000000000001',pg_catalog.now()
);
INSERT INTO public.office_document_signature_evidence(
 id,document_instance_id,status,signed_at
) VALUES(
 'b0000000-0000-4000-8000-000000000097',
 'b0000000-0000-4000-8000-000000000095',
 'VERIFIED',pg_catalog.now()
);
UPDATE public.office_document_instances
 SET status='SIGNED',signed_at=pg_catalog.now()
 WHERE id='b0000000-0000-4000-8000-000000000095';
UPDATE public.office_document_instances
 SET status='DELIVERED',delivered_at=pg_catalog.now()
 WHERE id='b0000000-0000-4000-8000-000000000096';

-- New immutable issue with a genuinely different signed-off payroll snapshot.
INSERT INTO public.office_salary_payslip_issues(
 id,payroll_result_id,employee_user_id,issued_by,snapshot_sha256,issued_at
) VALUES(
 'b0000000-0000-4000-8000-000000000098',
 'f0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000001',
 repeat('a',64),pg_catalog.now()-interval '3 days'
),(
 'b0000000-0000-4000-8000-000000000099',
 'f0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000001',
 repeat('b',64),pg_catalog.now()
);

-- Synthetic independently reviewed five distinct 6-hour weekdays.
UPDATE public.office_worktime_policy_versions SET
 status='APPROVED',
 approved_by='a0000000-0000-4000-8000-000000000001',
 approved_at=pg_catalog.now(),
 effective_from=date_trunc('week',(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata'))::date-7
WHERE id='b0000000-0000-4000-8000-000000000006';
DO $week$
DECLARE
 monday date:=date_trunc('week',(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata'))::date-7;
 idx integer;
BEGIN
 FOR idx IN 0..4 LOOP
   INSERT INTO public.office_worktime_review_cases(
      id,employee_user_id,requested_by,status,source_kind,
      work_starts_at,work_ends_at,breaks,reviewed_by,reviewed_at
   ) VALUES(
     pg_catalog.gen_random_uuid(),
     'a0000000-0000-4000-8000-000000000002',
     'a0000000-0000-4000-8000-000000000002',
     'APPROVED','HISTORICAL_CORRECTION',
     (monday+idx)::timestamp+'09:00:00'::time AT TIME ZONE 'Asia/Kolkata',
     (monday+idx)::timestamp+'15:00:00'::time AT TIME ZONE 'Asia/Kolkata',
     '[]'::jsonb,
     'a0000000-0000-4000-8000-000000000003',
     pg_catalog.now()
   );
 END LOOP;
END;
$week$;
INSERT INTO public.office_flex_day_requests(
 id,employee_user_id,status,requested_by,earned_week_monday,qualifying_work_minutes
) VALUES(
 'b0000000-0000-4000-8000-000000000100',
 'a0000000-0000-4000-8000-000000000002',
 'PENDING',
 'a0000000-0000-4000-8000-000000000002',
 date_trunc('week',(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata'))::date-7,
 1800
);
DO $verify$
DECLARE count_events integer;
BEGIN
 SELECT count(*) INTO count_events FROM public.office_lifecycle_mail_outbox;
 IF count_events<>12 OR
    (SELECT count(DISTINCT event_code)
      FROM public.office_lifecycle_mail_outbox)<>8 THEN
   RAISE EXCEPTION 'Expected 12 verified policy/document/auth/Flex intents across 8 codes, got %',
     count_events;
 END IF;
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox
   WHERE event_code='TIME-07')<>1
  OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox
   WHERE event_code='TIME-09')<>1 THEN
   RAISE EXCEPTION 'Five approved days did not produce audited Flex notices';
 END IF;
END;
$verify$;
SET ROLE kravia_office_backend;
CREATE TEMP TABLE verified_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $claimed$
BEGIN
 IF (SELECT count(*) FROM pg_temp.verified_claims)<>12
   OR (SELECT count(*) FROM pg_temp.verified_claims
        WHERE recipient_email='synthetic.dormant@kraviaprivatelimited.com')>0 THEN
   RAISE EXCEPTION 'Unverified document, employee or account-lock proof was claimed';
 END IF;
END;
$claimed$;
ROLLBACK;
SELECT 'OFFICE_CONTROLLED_POLICY_DOC_FLEX_VERIFIED' AS result;
