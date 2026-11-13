-- Disposable PostgreSQL 17 fixture only; never run against live employee records.
-- No provider requests. Simulate Owner enabling six routes inside a rollback.
BEGIN;
DO $before$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>43
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 43 verified source rules, none enabled, and empty outbox';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_lifecycle_aux_proof_valid(public.office_lifecycle_aux_proofs)','EXECUTE') THEN
   RAISE EXCEPTION 'Private evidence verifier exposed to browser';
 END IF;
END;
$before$;
UPDATE public.office_lifecycle_mail_policy
 SET enabled=true,
 approved_by='a0000000-0000-4000-8000-000000000001'::uuid,
 approved_at=pg_catalog.now()-interval '2 minutes',
 effective_from=pg_catalog.now()-interval '1 minute'
WHERE event_code IN ('AUTH-12','EXIT-03','TIME-05','TIME-06','ROLE-07','ROLE-03');

-- Only the real employee's changing manager is notified, not anyone
-- submitting metadata that looks like a manager change.
INSERT INTO public.office_job_assignments(
 user_id,reports_to_user_id,status,updated_at
) VALUES(
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000001','ACTIVE',pg_catalog.now()
);
UPDATE public.office_job_assignments
 SET reports_to_user_id='a0000000-0000-4000-8000-000000000003',
 updated_at=pg_catalog.now()
 WHERE user_id='a0000000-0000-4000-8000-000000000002';

INSERT INTO public.office_access_reviews(id,user_id,status,due_at)
VALUES('b0000000-0000-4000-8000-000000000020',
 'a0000000-0000-4000-8000-000000000002','PENDING',
 pg_catalog.now()+interval '3 days');

INSERT INTO public.office_access_audit(
 actor_user_id,target_user_id,action,reason
) VALUES(
 'a0000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000002',
 'MFA_RESET','Synthetic verified independent security factor reset'
);

UPDATE public.office_employment_registry SET end_date=CURRENT_DATE+12
WHERE identity_user_id='a0000000-0000-4000-8000-000000000002';
INSERT INTO public.office_asset_lifecycle(asset_id,custodian_user_id,lifecycle_status)
VALUES('Synthetic-KRAVIA-EXIT-03',
'a0000000-0000-4000-8000-000000000002','RETURN_PENDING');
INSERT INTO public.office_asset_events(asset_id,actor_user_id,event_type,new_status,metadata)
VALUES('Synthetic-KRAVIA-EXIT-03',
'a0000000-0000-4000-8000-000000000003',
'RETURN_REQUESTED','RETURN_PENDING','{}'::jsonb);

INSERT INTO public.office_attendance_sessions(
 id,user_id,check_in_at,check_out_at,status
) VALUES(
 'b0000000-0000-4000-8000-000000000021',
 'a0000000-0000-4000-8000-000000000002',
 pg_catalog.now()-interval '26 hours',
 pg_catalog.now()-interval '18 hours',
 'CLOSED'
);
INSERT INTO public.office_worktime_review_cases(
 id,employee_user_id,requested_by,status,attendance_session_id,
 work_starts_at,work_ends_at,breaks,source_kind
) VALUES(
 'b0000000-0000-4000-8000-000000000022',
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002',
 'PENDING',
 'b0000000-0000-4000-8000-000000000021',
 pg_catalog.now()-interval '26 hours',
 pg_catalog.now()-interval '18 hours',
 '[]'::jsonb,'RECORDED_SESSION'
);
INSERT INTO public.office_worktime_events(case_id,actor_user_id,event_type)
VALUES(
 'b0000000-0000-4000-8000-000000000022',
 'a0000000-0000-4000-8000-000000000002','SUBMITTED'
);

DO $check$
DECLARE v_total integer;
BEGIN
 SELECT count(*) INTO v_total FROM public.office_lifecycle_mail_outbox;
 IF v_total<>5 THEN
   RAISE EXCEPTION 'Expected 5 correctly attributed immutable intents, got %',v_total;
 END IF;
 IF (SELECT count(DISTINCT event_code) FROM public.office_lifecycle_mail_outbox)<>5 THEN
   RAISE EXCEPTION 'Incorrect event classifications or duplicate source';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox
   WHERE recipient_user_id NOT IN(
     'a0000000-0000-4000-8000-000000000002'::uuid,
     'a0000000-0000-4000-8000-000000000003'::uuid)) THEN
   RAISE EXCEPTION 'Unauthorized recipient derived from event';
 END IF;
END;
$check$;

SET ROLE kravia_office_backend;
CREATE TEMP TABLE first_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $claims$
BEGIN
 IF (SELECT count(*) FROM pg_temp.first_claims)<>5
  OR (SELECT count(DISTINCT event_code) FROM pg_temp.first_claims)<>5 THEN
   RAISE EXCEPTION 'Unable to claim all five safe event sources';
 END IF;
END;
$claims$;

-- Review changes require an independently approved effective-dated policy,
-- documented attendance, and a reviewer other than the beneficiary/submitter.
INSERT INTO public.office_worktime_policy_versions(
 id,employee_user_id,status,proposed_by,approved_by,approved_at,
 effective_from,authority_reference
) VALUES(
 'b0000000-0000-4000-8000-000000000023',
 'a0000000-0000-4000-8000-000000000002',
 'APPROVED',
 'a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000001',
 pg_catalog.now(),
 CURRENT_DATE-3,
 'Synthetic-CI-board-approved-extra-hours-2026'
);
UPDATE public.office_worktime_review_cases
 SET status='APPROVED',
 reviewed_by='a0000000-0000-4000-8000-000000000003',
 reviewed_at=pg_catalog.now()
 WHERE id='b0000000-0000-4000-8000-000000000022';
INSERT INTO public.office_worktime_events(case_id,actor_user_id,event_type)
VALUES(
 'b0000000-0000-4000-8000-000000000022',
 'a0000000-0000-4000-8000-000000000003','APPROVED'
);
SET ROLE kravia_office_backend;
CREATE TEMP TABLE decision_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
RESET ROLE;
DO $decision$
BEGIN
 IF (SELECT count(*) FROM pg_temp.decision_claims)<>1
    OR NOT EXISTS (
      SELECT 1 FROM pg_temp.decision_claims
      WHERE event_code='TIME-06'
        AND recipient_email='synthetic.staff@kraviaprivatelimited.com'
    ) THEN
   RAISE EXCEPTION 'Independent verified overtime decision was not claimed exactly once';
 END IF;
END;
$decision$;
ROLLBACK;
SELECT 'WORKFORCE_REAL_EVIDENCE_VERIFIED' AS result;
