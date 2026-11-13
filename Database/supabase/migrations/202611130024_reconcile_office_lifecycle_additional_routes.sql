-- Forward-only Office lifecycle schema update AFTER recorded migrations 022 and 023.
-- NO real mail is sent, no event is enabled and no employee or payroll row
-- is inserted or modified. Aborts if the existing private ledger needs review.
-- Recorded production migration versions must never be replayed.
DO $preflight$
DECLARE v_ready integer;
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81 THEN
   RAISE EXCEPTION 'Canonical 81-event policy inventory is incomplete';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
   RAISE EXCEPTION 'Owner-approved live delivery exists; manual reconciliation required';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Existing employee notification ledger requires manual reconciliation';
 END IF;
 SELECT count(*) INTO v_ready FROM public.office_lifecycle_mail_policy WHERE source_ready;
 IF v_ready NOT IN(27,31) THEN
   RAISE EXCEPTION 'Unexpected source readiness %; halt and investigate',v_ready;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy
   WHERE event_code='PAY-08' AND source_ready) THEN
   RAISE EXCEPTION 'Prior independently verified salary settlement mapping is missing';
 END IF;
END;
$preflight$;

ALTER TABLE public.office_lifecycle_mail_outbox
 DROP CONSTRAINT office_lifecycle_mail_outbox_source_table_check,
 ADD CONSTRAINT office_lifecycle_mail_outbox_source_table_check
 CHECK(source_table IN(
  'office_employee_intake_events','office_role_package_events',
  'office_worktime_events','office_department_transfer_events','office_auth_events',
  'office_people_development_events','office_payroll_events','office_task_events',
  'office_access_audit','office_lifecycle_mail_decision_events','office_recruitment_events'
 ));

UPDATE public.office_lifecycle_mail_policy SET source_ready=true
 WHERE event_code IN('PAY-09','ONB-10','ONB-01','HIRE-07')
   AND source_ready=false AND enabled=false;

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>31
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
   RAISE EXCEPTION 'Expected exactly 31 audited source routes, all disabled';
 END IF;
END;
$postcheck$;

-- The current verified canonical functions retain their signatures. Replacing
-- them updates the pre-existing triggers without recreating earlier events.
CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_source_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE v_recipient uuid;
DECLARE v_from uuid;
DECLARE v_to uuid;
DECLARE v_reviewer uuid;
BEGIN
  IF TG_TABLE_NAME='office_employee_intake_events' THEN
    IF NEW.event_type IN ('PROFILE_SUBMITTED','PROFILE_RETURNED') THEN
      PERFORM public.office_lifecycle_mail_enqueue('ONB-05',TG_TABLE_NAME,NEW.id,NEW.employee_user_id);
    ELSIF NEW.event_type='REFERENCE_ID_ISSUED' AND NEW.actor_user_id IS NOT NULL
        AND NEW.actor_user_id IS DISTINCT FROM NEW.employee_user_id THEN
      IF EXISTS(SELECT 1 FROM public.office_employee_reference_ids reference
        WHERE reference.employee_user_id=NEW.employee_user_id
          AND reference.issued_by=NEW.actor_user_id
          AND reference.issued_at IS NOT NULL)
        AND EXISTS(SELECT 1 FROM public.office_employee_intake_profiles profile
          WHERE profile.employee_user_id=NEW.employee_user_id
            AND profile.status='VERIFIED')
        AND EXISTS(SELECT 1 FROM public.office_employment_registry employment
          WHERE employment.identity_user_id=NEW.employee_user_id
            AND employment.status='ACTIVE'
            AND employment.relationship_type='EMPLOYEE'
            AND employment.start_date<=CURRENT_DATE) THEN
        PERFORM public.office_lifecycle_mail_enqueue('ONB-01',TG_TABLE_NAME,NEW.id,NEW.employee_user_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_role_package_events' THEN
    IF NEW.event_type='PACKAGE_APPLIED' AND NEW.target_user_id IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
           WHERE task.application_id=NEW.application_id
             AND task.employee_user_id=NEW.target_user_id AND task.required) THEN
        PERFORM public.office_lifecycle_mail_enqueue('ONB-02',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      END IF;
      PERFORM public.office_lifecycle_mail_enqueue('ONB-09',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-01',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-09',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
    ELSIF NEW.event_type='TASK_VERIFIED' AND NEW.target_user_id IS NOT NULL
        AND NEW.task_id IS NOT NULL AND NEW.application_id IS NOT NULL
        AND NEW.actor_user_id IS DISTINCT FROM NEW.target_user_id THEN
      IF EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks completed
        WHERE completed.id=NEW.task_id
          AND completed.application_id=NEW.application_id
          AND completed.employee_user_id=NEW.target_user_id
          AND completed.required AND completed.status='VERIFIED'
          AND completed.reviewed_by=NEW.actor_user_id
          AND completed.reviewed_by IS DISTINCT FROM completed.submitted_by
          AND completed.reviewed_at IS NOT NULL)
        AND EXISTS(SELECT 1 FROM public.office_employee_intake_profiles profile
          WHERE profile.employee_user_id=NEW.target_user_id AND profile.status='VERIFIED')
        AND EXISTS(SELECT 1 FROM public.office_employee_reference_ids ref
          WHERE ref.employee_user_id=NEW.target_user_id)
        AND EXISTS(SELECT 1 FROM public.office_employment_registry employment
          WHERE employment.identity_user_id=NEW.target_user_id
            AND employment.status='ACTIVE'
            AND employment.start_date<=CURRENT_DATE)
        AND EXISTS(SELECT 1 FROM public.office_employee_role_package_applications application
          WHERE application.id=NEW.application_id
            AND application.employee_user_id=NEW.target_user_id)
        AND EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
          WHERE task.application_id=NEW.application_id
            AND task.employee_user_id=NEW.target_user_id AND task.required)
        AND NOT EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
          WHERE task.application_id=NEW.application_id
            AND task.employee_user_id=NEW.target_user_id
            AND task.required AND task.status<>'VERIFIED') THEN
        PERFORM public.office_lifecycle_mail_enqueue('ONB-10',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      END IF;
    ELSIF NEW.event_type='TASK_RETURNED' AND NEW.target_user_id IS NOT NULL THEN
      PERFORM public.office_lifecycle_mail_enqueue('ONB-05',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
    END IF;
  ELSIF TG_TABLE_NAME='office_recruitment_events' THEN
    IF NEW.event_type='OFFER_SUBMITTED' AND NEW.offer_id IS NOT NULL
        AND NEW.new_status='PENDING_APPROVAL' THEN
      SELECT step.assigned_user_id INTO v_recipient
      FROM public.office_offer_proposals offer
      JOIN public.office_requests request
        ON request.id=offer.approval_request_id
      JOIN public.office_request_steps step
        ON step.request_id=request.id AND step.step_order=request.current_step_order
      JOIN public.office_identity_users reviewer ON reviewer.user_id=step.assigned_user_id
      WHERE offer.id=NEW.offer_id AND offer.status='PENDING_APPROVAL'
        AND offer.created_by IS DISTINCT FROM step.assigned_user_id
        AND step.assigned_user_id IS DISTINCT FROM NEW.actor_user_id
        AND reviewer.status='ACTIVE'
        AND request.request_type_code='EMPLOYMENT_OFFER_APPROVAL'
        AND request.status IN ('PENDING','IN_REVIEW')
        AND request.id::text=NEW.metadata->>'approval_request_id'
        AND step.status='PENDING' AND step.required_permission='hiring.offer.review'
        AND public.office_effective_permission(
          step.assigned_user_id,'hiring.offer.review','COMPANY',NULL,NULL);
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('HIRE-07',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_worktime_events' THEN
    IF NEW.event_type='SUBMITTED' THEN
      SELECT owner.owner_user_id INTO v_recipient
      FROM public.office_department_ownership owner
      JOIN public.office_worktime_review_cases c ON c.id=NEW.case_id
      JOIN public.office_identity_users reviewer ON reviewer.user_id=owner.owner_user_id
      WHERE owner.department_code='PEOPLE' AND reviewer.status='ACTIVE'
        AND c.status='PENDING' AND c.requested_by=NEW.actor_user_id
        AND owner.owner_user_id IS DISTINCT FROM c.employee_user_id
        AND owner.owner_user_id IS DISTINCT FROM NEW.actor_user_id
        AND public.office_effective_permission(owner.owner_user_id,'people.update','COMPANY',NULL,NULL);
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('TIME-03',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type IN ('APPROVED','REJECTED') THEN
      SELECT c.employee_user_id INTO v_recipient
        FROM public.office_worktime_review_cases c WHERE c.id=NEW.case_id;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('TIME-04',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_department_transfer_events' THEN
    SELECT tr.from_owner_user_id,tr.to_owner_user_id INTO v_from,v_to
    FROM public.office_department_transfer_requests tr
    WHERE tr.id=NEW.transfer_id AND tr.department_code=NEW.department_code;
    IF NEW.event_type='PROPOSED' AND v_to IS NOT NULL THEN
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-04',TG_TABLE_NAME,NEW.id,v_to);
    ELSIF NEW.event_type IN ('ACCEPTED','CANCELLED') THEN
      IF v_to IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue(
          CASE WHEN NEW.event_type='ACCEPTED' THEN 'ROLE-05' ELSE 'ROLE-06' END,
          TG_TABLE_NAME,NEW.id,v_to);
      END IF;
      IF v_from IS NOT NULL AND v_from IS DISTINCT FROM v_to THEN
        PERFORM public.office_lifecycle_mail_enqueue(
          CASE WHEN NEW.event_type='ACCEPTED' THEN 'ROLE-05' ELSE 'ROLE-06' END,
          TG_TABLE_NAME,NEW.id,v_from);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_people_development_events' THEN
    IF NEW.event_type='TRAINING_ASSIGNED' AND NEW.training_assignment_id IS NOT NULL THEN
      PERFORM public.office_lifecycle_mail_enqueue('DEV-01',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
    ELSIF NEW.event_type='TRAINING_UPDATED' AND NEW.new_status='COMPLETED'
        AND NEW.training_assignment_id IS NOT NULL
        AND NEW.actor_user_id IS DISTINCT FROM NEW.target_user_id THEN
      IF EXISTS(SELECT 1 FROM public.office_training_assignments a
        WHERE a.id=NEW.training_assignment_id AND a.user_id=NEW.target_user_id
          AND a.status='COMPLETED'
          AND nullif(pg_catalog.btrim(a.completion_evidence_reference),'') IS NOT NULL) THEN
        PERFORM public.office_lifecycle_mail_enqueue('DEV-03',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      END IF;
    ELSIF NEW.event_type='PERFORMANCE_CREATED' AND NEW.performance_review_id IS NOT NULL THEN
      SELECT r.reviewer_user_id INTO v_reviewer FROM public.office_performance_reviews r
      WHERE r.id=NEW.performance_review_id AND r.user_id=NEW.target_user_id
        AND r.reviewer_user_id IS DISTINCT FROM NEW.target_user_id;
      IF v_reviewer IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('DEV-04',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
        PERFORM public.office_lifecycle_mail_enqueue('DEV-04',TG_TABLE_NAME,NEW.id,v_reviewer);
      END IF;
    ELSIF NEW.event_type='PERFORMANCE_UPDATED' AND NEW.new_status='FINAL'
        AND NEW.performance_review_id IS NOT NULL THEN
      IF EXISTS(SELECT 1 FROM public.office_performance_reviews r
        WHERE r.id=NEW.performance_review_id AND r.user_id=NEW.target_user_id
          AND r.status='FINAL' AND r.finalized_by IS NOT NULL) THEN
        PERFORM public.office_lifecycle_mail_enqueue('DEV-05',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
        IF EXISTS(SELECT 1 FROM public.office_performance_reviews r
          WHERE r.id=NEW.performance_review_id AND r.user_id=NEW.target_user_id
            AND r.status='FINAL' AND nullif(pg_catalog.btrim(r.development_plan),'') IS NOT NULL) THEN
          PERFORM public.office_lifecycle_mail_enqueue('DEV-06',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
        END IF;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_task_events' THEN
    IF NEW.event_type='CREATED' THEN
      SELECT t.assigned_user_id INTO v_recipient FROM public.office_tasks t
      WHERE t.id=NEW.task_id AND t.status NOT IN ('CANCELLED','COMPLETED');
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('DEV-07',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_payroll_events' THEN
    IF NEW.event_type='COMPENSATION_APPROVAL_SYNCED'
        AND NEW.compensation_version_id IS NOT NULL
        AND NEW.metadata->>'compensation_status'='APPROVED' THEN
      SELECT c.employee_user_id INTO v_recipient
      FROM public.office_compensation_versions c
      WHERE c.id=NEW.compensation_version_id AND c.status='APPROVED'
        AND c.approved_by IS NOT NULL AND c.approved_at IS NOT NULL;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-02',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type='PAYROLL_PERIOD_OPENED' AND NEW.period_id IS NOT NULL THEN
      SELECT p.created_by INTO v_recipient FROM public.office_payroll_periods p
      WHERE p.id=NEW.period_id AND p.status IN ('DRAFT','ATTENDANCE_READY','CALCULATED','PENDING_REVIEW')
        AND p.created_by=NEW.actor_user_id;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-03',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type='PAYROLL_APPROVAL_SYNCED'
        AND NEW.period_id IS NOT NULL AND NEW.metadata->>'payroll_status'='APPROVED' THEN
      SELECT p.created_by INTO v_recipient FROM public.office_payroll_periods p
      WHERE p.id=NEW.period_id AND p.status IN ('APPROVED','PAYMENT_PREPARED')
        AND p.approved_by IS NOT NULL AND p.approved_at IS NOT NULL;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-05',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type='SALARY_BATCH_PREPARED' AND NEW.batch_id IS NOT NULL
        AND NEW.metadata->>'bank_execution'='false' THEN
      SELECT batch.prepared_by INTO v_recipient FROM public.office_salary_payment_batches batch
      JOIN public.office_payroll_periods p ON p.id=batch.period_id
      WHERE batch.id=NEW.batch_id AND batch.status='PREPARED'
        AND p.id=NEW.period_id AND p.status IN ('APPROVED','PAYMENT_PREPARED');
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-07',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type='BANK_SALARY_CREDIT_VERIFIED'
        AND NEW.metadata->>'settlement_id' IS NOT NULL THEN
      SELECT result.employee_user_id INTO v_recipient
      FROM public.office_salary_settlement_evidence se
      JOIN public.office_payroll_results result ON result.id=se.payroll_result_id
      JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE se.id::text=NEW.metadata->>'settlement_id'
        AND se.status='VERIFIED' AND se.verified_by=NEW.actor_user_id
        AND se.verified_at IS NOT NULL
        AND se.verified_by IS DISTINCT FROM se.submitted_by
        AND se.verified_by IS DISTINCT FROM result.employee_user_id
        AND nullif(pg_catalog.btrim(se.evidence_reference),'') IS NOT NULL
        AND nullif(pg_catalog.btrim(se.masked_bank_reference),'') IS NOT NULL
        AND se.amount_minor>0
        AND NEW.period_id=result.period_id AND NEW.employment_id=result.employment_id
        AND result.status='LOCKED' AND result.net_pay_minor>0
        AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
        AND nullif(pg_catalog.btrim(period.period_code),'') IS NOT NULL
        AND (SELECT coalesce(pg_catalog.sum(credit.amount_minor),0)
             FROM public.office_salary_settlement_evidence credit
             WHERE credit.payroll_result_id=result.id AND credit.status='VERIFIED')
            =result.net_pay_minor;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-08',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type='BANK_SALARY_PARTIAL_VERIFIED'
        AND NEW.metadata->>'settlement_id' IS NOT NULL THEN
      SELECT result.employee_user_id INTO v_recipient
      FROM public.office_salary_settlement_evidence se
      JOIN public.office_payroll_results result ON result.id=se.payroll_result_id
      JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE se.id::text=NEW.metadata->>'settlement_id'
        AND se.status='VERIFIED' AND se.verified_by=NEW.actor_user_id
        AND se.verified_at IS NOT NULL
        AND se.verified_by IS DISTINCT FROM se.submitted_by
        AND se.verified_by IS DISTINCT FROM result.employee_user_id
        AND nullif(pg_catalog.btrim(se.evidence_reference),'') IS NOT NULL
        AND nullif(pg_catalog.btrim(se.masked_bank_reference),'') IS NOT NULL
        AND se.amount_minor>0
        AND NEW.period_id=result.period_id AND NEW.employment_id=result.employment_id
        AND result.status='LOCKED' AND result.net_pay_minor>0
        AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
        AND nullif(pg_catalog.btrim(period.period_code),'') IS NOT NULL
        AND (SELECT coalesce(sum(credit.amount_minor),0)
             FROM public.office_salary_settlement_evidence credit
             WHERE credit.payroll_result_id=result.id AND credit.status='VERIFIED')
            BETWEEN 1 AND result.net_pay_minor-1;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-09',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    ELSIF NEW.event_type='PAYSLIP_ISSUED' AND NEW.metadata->>'payslip_issue_id' IS NOT NULL THEN
      SELECT issue.employee_user_id INTO v_recipient
      FROM public.office_salary_payslip_issues issue
      JOIN public.office_payroll_results result ON result.id=issue.payroll_result_id
      JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE issue.id::text=NEW.metadata->>'payslip_issue_id'
        AND issue.snapshot_sha256 IS NOT NULL
        AND issue.issued_at IS NOT NULL
        AND issue.issued_by=NEW.actor_user_id
        AND NEW.period_id=result.period_id
        AND NEW.employment_id=result.employment_id
        AND result.status='LOCKED'
        AND period.status IN ('APPROVED','PAYMENT_PREPARED')
        AND period.period_code IS NOT NULL;
      IF v_recipient IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue('PAY-06',TG_TABLE_NAME,NEW.id,v_recipient);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_access_audit' THEN
    IF NEW.target_user_id IS NOT NULL AND NEW.action IN ('ROLE_GRANTED','ROLE_REVOKED') THEN
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-02',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
    ELSIF NEW.target_user_id IS NOT NULL
        AND NEW.action IN ('ACCESS_REVIEW_APPROVED','ACCESS_REVIEW_CHANGES_REQUIRED') THEN
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-08',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      IF NEW.actor_user_id IS NOT NULL AND NEW.actor_user_id IS DISTINCT FROM NEW.target_user_id THEN
        PERFORM public.office_lifecycle_mail_enqueue('ROLE-08',TG_TABLE_NAME,NEW.id,NEW.actor_user_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_auth_events' THEN
    IF NEW.event_type='SESSION_REVOKED' THEN
      PERFORM public.office_lifecycle_mail_enqueue('AUTH-11',TG_TABLE_NAME,NEW.id,NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$source$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_source_trigger()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_bank_settlement_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $settled$
DECLARE v_result public.office_payroll_results%ROWTYPE;
DECLARE v_period public.office_payroll_periods%ROWTYPE;
DECLARE v_paid bigint;
BEGIN
  IF NEW.status<>'VERIFIED' OR OLD.status IS NOT DISTINCT FROM NEW.status
     OR NEW.verified_by IS NULL OR NEW.verified_at IS NULL
     OR NEW.verified_by IS NOT DISTINCT FROM NEW.submitted_by
     OR NEW.amount_minor<=0 OR NEW.credited_at IS NULL
     OR NEW.credited_at>pg_catalog.now()+interval '5 minutes'
     OR nullif(pg_catalog.btrim(NEW.evidence_reference),'') IS NULL
     OR nullif(pg_catalog.btrim(NEW.masked_bank_reference),'') IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_result FROM public.office_payroll_results
    WHERE id=NEW.payroll_result_id AND status='LOCKED' AND net_pay_minor>0;
  IF NOT FOUND OR NEW.verified_by IS NOT DISTINCT FROM v_result.employee_user_id THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_period FROM public.office_payroll_periods
    WHERE id=v_result.period_id AND status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
      AND nullif(pg_catalog.btrim(period_code),'') IS NOT NULL;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT coalesce(pg_catalog.sum(s.amount_minor),0) INTO v_paid
    FROM public.office_salary_settlement_evidence s
    WHERE s.payroll_result_id=NEW.payroll_result_id AND s.status='VERIFIED';
  IF v_paid=v_result.net_pay_minor
     AND EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy
       WHERE event_code='PAY-08' AND enabled AND source_ready
         AND effective_from<=pg_catalog.now()) THEN
    INSERT INTO public.office_payroll_events(
      actor_user_id,period_id,employment_id,event_type,metadata
    ) VALUES (
      NEW.verified_by,v_result.period_id,v_result.employment_id,
      'BANK_SALARY_CREDIT_VERIFIED',
      pg_catalog.jsonb_build_object('settlement_id',NEW.id)
    );
  ELSIF v_paid>0 AND v_paid<v_result.net_pay_minor
     AND EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy
       WHERE event_code='PAY-09' AND enabled AND source_ready
         AND effective_from<=pg_catalog.now()) THEN
    INSERT INTO public.office_payroll_events(
      actor_user_id,period_id,employment_id,event_type,metadata
    ) VALUES (
      NEW.verified_by,v_result.period_id,v_result.employment_id,
      'BANK_SALARY_PARTIAL_VERIFIED',
      pg_catalog.jsonb_build_object('settlement_id',NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$settled$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_bank_settlement_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_claim(p_limit integer DEFAULT 10)
RETURNS TABLE(
  outbox_id uuid,claim_token uuid,event_code text,recipient_email text,
  recipient_name text,source_reference text,pay_period text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $claim$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Invalid bounded lifecycle mail batch';
  END IF;
  WITH stale AS (
    UPDATE public.office_lifecycle_mail_outbox o SET status='UNKNOWN',finalized_at=pg_catalog.now()
    WHERE o.status='SENDING' AND o.claimed_at<pg_catalog.now()-interval '15 minutes'
    RETURNING o.id
  )
  INSERT INTO public.office_lifecycle_mail_events(outbox_id,event_type)
    SELECT stale.id,'STALE_UNKNOWN' FROM stale;

  RETURN QUERY
  WITH candidates AS(
    SELECT o.id FROM public.office_lifecycle_mail_outbox o
    JOIN public.office_lifecycle_mail_policy p
      ON p.event_code=o.event_code AND p.enabled AND p.source_ready
      AND p.effective_from<=o.created_at
    JOIN public.office_identity_users i
      ON i.user_id=o.recipient_user_id AND i.status='ACTIVE'
    JOIN public.office_auth_users a
      ON a.id=o.recipient_user_id::text AND a.status='ACTIVE'
      AND pg_catalog.lower(a.email) LIKE '%@kraviaprivatelimited.com'
    WHERE o.status='PENDING'
      AND (
        (o.source_table='office_employee_intake_events'
          AND EXISTS(SELECT 1 FROM public.office_employee_intake_events ev
            WHERE ev.id=o.source_id AND ev.employee_user_id=o.recipient_user_id
              AND ((o.event_code='ONB-05'
                AND ev.event_type IN ('PROFILE_SUBMITTED','PROFILE_RETURNED'))
                OR (o.event_code='ONB-01' AND ev.event_type='REFERENCE_ID_ISSUED'
                  AND ev.actor_user_id IS NOT NULL
                  AND ev.actor_user_id IS DISTINCT FROM ev.employee_user_id
                  AND EXISTS(SELECT 1 FROM public.office_employee_reference_ids reference
                    WHERE reference.employee_user_id=o.recipient_user_id
                      AND reference.issued_by=ev.actor_user_id
                      AND reference.issued_at IS NOT NULL)
                  AND EXISTS(SELECT 1 FROM public.office_employee_intake_profiles profile
                    WHERE profile.employee_user_id=o.recipient_user_id
                      AND profile.status='VERIFIED')
                  AND EXISTS(SELECT 1 FROM public.office_employment_registry employment
                    WHERE employment.identity_user_id=o.recipient_user_id
                      AND employment.status='ACTIVE'
                      AND employment.relationship_type='EMPLOYEE'
                      AND employment.start_date<=CURRENT_DATE)))))
        OR (o.source_table='office_role_package_events'
          AND EXISTS(SELECT 1 FROM public.office_role_package_events ev
            WHERE ev.id=o.source_id AND ev.target_user_id=o.recipient_user_id
              AND ((o.event_code IN ('ONB-09','ROLE-01','ROLE-09')
                     AND ev.event_type='PACKAGE_APPLIED')
                OR (o.event_code='ONB-02' AND ev.event_type='PACKAGE_APPLIED'
                  AND EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
                    WHERE task.application_id=ev.application_id
                      AND task.employee_user_id=ev.target_user_id AND task.required))
                OR (o.event_code='ONB-10' AND ev.event_type='TASK_VERIFIED'
                  AND ev.task_id IS NOT NULL AND ev.application_id IS NOT NULL
                  AND ev.actor_user_id IS DISTINCT FROM ev.target_user_id
                  AND EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks completed
                    WHERE completed.id=ev.task_id AND completed.application_id=ev.application_id
                      AND completed.employee_user_id=o.recipient_user_id
                      AND completed.required AND completed.status='VERIFIED'
                      AND completed.reviewed_by=ev.actor_user_id
                      AND completed.reviewed_by IS DISTINCT FROM completed.submitted_by
                      AND completed.reviewed_at IS NOT NULL)
                  AND EXISTS(SELECT 1 FROM public.office_employee_intake_profiles profile
                    WHERE profile.employee_user_id=o.recipient_user_id AND profile.status='VERIFIED')
                  AND EXISTS(SELECT 1 FROM public.office_employee_reference_ids ref
                    WHERE ref.employee_user_id=o.recipient_user_id)
                  AND EXISTS(SELECT 1 FROM public.office_employment_registry employment
                    WHERE employment.identity_user_id=o.recipient_user_id
                      AND employment.status='ACTIVE'
                      AND employment.start_date<=CURRENT_DATE)
                  AND EXISTS(SELECT 1 FROM public.office_employee_role_package_applications application
                    WHERE application.id=ev.application_id
                      AND application.employee_user_id=o.recipient_user_id)
                  AND EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
                    WHERE task.application_id=ev.application_id
                      AND task.employee_user_id=o.recipient_user_id AND task.required)
                  AND NOT EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
                    WHERE task.application_id=ev.application_id
                      AND task.employee_user_id=o.recipient_user_id
                      AND task.required AND task.status<>'VERIFIED'))
                OR (o.event_code='ONB-05' AND ev.event_type='TASK_RETURNED'))))
        OR (o.source_table='office_recruitment_events' AND o.event_code='HIRE-07'
          AND EXISTS(SELECT 1 FROM public.office_recruitment_events ev
            JOIN public.office_offer_proposals offer ON offer.id=ev.offer_id
            JOIN public.office_requests request ON request.id=offer.approval_request_id
            JOIN public.office_request_steps step
              ON step.request_id=request.id AND step.step_order=request.current_step_order
            JOIN public.office_identity_users reviewer ON reviewer.user_id=step.assigned_user_id
            WHERE ev.id=o.source_id AND ev.event_type='OFFER_SUBMITTED'
              AND ev.new_status='PENDING_APPROVAL' AND offer.status='PENDING_APPROVAL'
              AND ev.metadata->>'approval_request_id'=request.id::text
              AND request.request_type_code='EMPLOYMENT_OFFER_APPROVAL'
              AND request.status IN ('PENDING','IN_REVIEW')
              AND step.assigned_user_id=o.recipient_user_id
              AND step.status='PENDING'
              AND step.required_permission='hiring.offer.review'
              AND reviewer.status='ACTIVE'
              AND step.assigned_user_id IS DISTINCT FROM offer.created_by
              AND step.assigned_user_id IS DISTINCT FROM ev.actor_user_id
              AND public.office_effective_permission(
                step.assigned_user_id,'hiring.offer.review','COMPANY',NULL,NULL)))
        OR (o.source_table='office_worktime_events' AND o.event_code='TIME-03'
          AND EXISTS(SELECT 1 FROM public.office_worktime_events ev
            JOIN public.office_worktime_review_cases c ON c.id=ev.case_id
            JOIN public.office_department_ownership owner ON owner.department_code='PEOPLE'
            JOIN public.office_identity_users reviewer ON reviewer.user_id=owner.owner_user_id
            WHERE ev.id=o.source_id AND ev.event_type='SUBMITTED'
              AND c.status='PENDING' AND c.requested_by=ev.actor_user_id
              AND reviewer.status='ACTIVE'
              AND owner.owner_user_id=o.recipient_user_id
              AND owner.owner_user_id IS DISTINCT FROM c.employee_user_id
              AND owner.owner_user_id IS DISTINCT FROM ev.actor_user_id
              AND public.office_effective_permission(owner.owner_user_id,'people.update','COMPANY',NULL,NULL)))
        OR (o.source_table='office_worktime_events' AND o.event_code='TIME-04'
          AND EXISTS(SELECT 1 FROM public.office_worktime_events ev
            JOIN public.office_worktime_review_cases c ON c.id=ev.case_id
            WHERE ev.id=o.source_id AND c.employee_user_id=o.recipient_user_id
              AND ev.event_type IN ('APPROVED','REJECTED')))
        OR (o.source_table='office_department_transfer_events'
          AND EXISTS(SELECT 1 FROM public.office_department_transfer_events ev
            JOIN public.office_department_transfer_requests tr
              ON tr.id=ev.transfer_id AND tr.department_code=ev.department_code
            WHERE ev.id=o.source_id
              AND o.recipient_user_id IN (tr.from_owner_user_id,tr.to_owner_user_id)
              AND ((o.event_code='ROLE-04' AND ev.event_type='PROPOSED')
                OR (o.event_code='ROLE-05' AND ev.event_type='ACCEPTED')
                OR (o.event_code='ROLE-06' AND ev.event_type='CANCELLED'))))
        OR (o.source_table='office_people_development_events'
          AND EXISTS(SELECT 1 FROM public.office_people_development_events ev
            WHERE ev.id=o.source_id
              AND ((o.event_code='DEV-01' AND ev.target_user_id=o.recipient_user_id
                AND ev.event_type='TRAINING_ASSIGNED' AND ev.training_assignment_id IS NOT NULL)
                OR (o.event_code='DEV-03' AND ev.target_user_id=o.recipient_user_id
                  AND ev.event_type='TRAINING_UPDATED' AND ev.new_status='COMPLETED'
                  AND ev.actor_user_id IS DISTINCT FROM ev.target_user_id
                  AND EXISTS(SELECT 1 FROM public.office_training_assignments a
                    WHERE a.id=ev.training_assignment_id AND a.user_id=o.recipient_user_id
                      AND a.status='COMPLETED'
                      AND nullif(pg_catalog.btrim(a.completion_evidence_reference),'') IS NOT NULL))
                OR (o.event_code='DEV-04' AND ev.event_type='PERFORMANCE_CREATED'
                  AND EXISTS(SELECT 1 FROM public.office_performance_reviews pr
                    WHERE pr.id=ev.performance_review_id AND pr.user_id=ev.target_user_id
                      AND pr.reviewer_user_id IS DISTINCT FROM pr.user_id
                      AND o.recipient_user_id IN (pr.user_id,pr.reviewer_user_id)))
                OR (o.event_code IN ('DEV-05','DEV-06') AND ev.target_user_id=o.recipient_user_id
                  AND ev.event_type='PERFORMANCE_UPDATED' AND ev.new_status='FINAL'
                  AND EXISTS(SELECT 1 FROM public.office_performance_reviews pr
                    WHERE pr.id=ev.performance_review_id AND pr.user_id=o.recipient_user_id
                      AND pr.status='FINAL' AND pr.finalized_by IS NOT NULL
                      AND (o.event_code='DEV-05' OR
                        nullif(pg_catalog.btrim(pr.development_plan),'') IS NOT NULL))))))
        OR (o.source_table='office_task_events' AND o.event_code='DEV-07'
          AND EXISTS(SELECT 1 FROM public.office_task_events ev
            JOIN public.office_tasks task ON task.id=ev.task_id
            WHERE ev.id=o.source_id AND ev.event_type='CREATED'
              AND task.assigned_user_id=o.recipient_user_id
              AND task.status NOT IN ('CANCELLED','COMPLETED')))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-02'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_compensation_versions cv ON cv.id=ev.compensation_version_id
            WHERE ev.id=o.source_id
              AND cv.employee_user_id=o.recipient_user_id
              AND cv.status='APPROVED' AND cv.approved_by IS NOT NULL AND cv.approved_at IS NOT NULL
              AND ev.event_type='COMPENSATION_APPROVAL_SYNCED'
              AND ev.metadata->>'compensation_status'='APPROVED'))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-03'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_payroll_periods p ON p.id=ev.period_id
            WHERE ev.id=o.source_id AND ev.event_type='PAYROLL_PERIOD_OPENED'
              AND p.created_by=o.recipient_user_id AND p.created_by=ev.actor_user_id
              AND p.status IN ('DRAFT','ATTENDANCE_READY','CALCULATED','PENDING_REVIEW')))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-05'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_payroll_periods p ON p.id=ev.period_id
            WHERE ev.id=o.source_id AND ev.event_type='PAYROLL_APPROVAL_SYNCED'
              AND ev.metadata->>'payroll_status'='APPROVED'
              AND p.created_by=o.recipient_user_id
              AND p.approved_by IS NOT NULL AND p.approved_at IS NOT NULL
              AND p.status IN ('APPROVED','PAYMENT_PREPARED')))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-07'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_salary_payment_batches batch ON batch.id=ev.batch_id
            JOIN public.office_payroll_periods p ON p.id=batch.period_id
            WHERE ev.id=o.source_id AND ev.event_type='SALARY_BATCH_PREPARED'
              AND ev.metadata->>'bank_execution'='false'
              AND batch.prepared_by=o.recipient_user_id
              AND batch.status='PREPARED'
              AND p.id=ev.period_id AND p.status IN ('APPROVED','PAYMENT_PREPARED')))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-09'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_salary_settlement_evidence se
              ON se.id::text=ev.metadata->>'settlement_id'
            JOIN public.office_payroll_results result ON result.id=se.payroll_result_id
            JOIN public.office_payroll_periods period ON period.id=result.period_id
            WHERE ev.id=o.source_id
              AND ev.event_type='BANK_SALARY_PARTIAL_VERIFIED'
              AND result.employee_user_id=o.recipient_user_id
              AND se.status='VERIFIED' AND se.verified_by=ev.actor_user_id
              AND se.verified_at IS NOT NULL
              AND se.verified_by IS DISTINCT FROM se.submitted_by
              AND se.verified_by IS DISTINCT FROM result.employee_user_id
              AND se.amount_minor>0
              AND nullif(pg_catalog.btrim(se.evidence_reference),'') IS NOT NULL
              AND nullif(pg_catalog.btrim(se.masked_bank_reference),'') IS NOT NULL
              AND ev.period_id=result.period_id AND ev.employment_id=result.employment_id
              AND result.status='LOCKED' AND result.net_pay_minor>0
              AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
              AND nullif(pg_catalog.btrim(period.period_code),'') IS NOT NULL
              AND (SELECT coalesce(sum(v.amount_minor),0)
                   FROM public.office_salary_settlement_evidence v
                   WHERE v.payroll_result_id=result.id AND v.status='VERIFIED')
                  BETWEEN 1 AND result.net_pay_minor-1))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-08'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_salary_settlement_evidence se
              ON se.id::text=ev.metadata->>'settlement_id'
            JOIN public.office_payroll_results result ON result.id=se.payroll_result_id
            JOIN public.office_payroll_periods period ON period.id=result.period_id
            WHERE ev.id=o.source_id
              AND ev.event_type='BANK_SALARY_CREDIT_VERIFIED'
              AND result.employee_user_id=o.recipient_user_id
              AND se.status='VERIFIED' AND se.verified_by=ev.actor_user_id
              AND se.verified_at IS NOT NULL
              AND se.verified_by IS DISTINCT FROM se.submitted_by
              AND se.verified_by IS DISTINCT FROM result.employee_user_id
              AND se.amount_minor>0
              AND nullif(pg_catalog.btrim(se.evidence_reference),'') IS NOT NULL
              AND nullif(pg_catalog.btrim(se.masked_bank_reference),'') IS NOT NULL
              AND ev.period_id=result.period_id AND ev.employment_id=result.employment_id
              AND result.status='LOCKED' AND result.net_pay_minor>0
              AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
              AND nullif(pg_catalog.btrim(period.period_code),'') IS NOT NULL
              AND (SELECT coalesce(pg_catalog.sum(v.amount_minor),0)
                   FROM public.office_salary_settlement_evidence v
                   WHERE v.payroll_result_id=result.id AND v.status='VERIFIED')
                  =result.net_pay_minor))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-06'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_salary_payslip_issues issue
              ON issue.id::text=ev.metadata->>'payslip_issue_id'
            JOIN public.office_payroll_results result ON result.id=issue.payroll_result_id
            JOIN public.office_payroll_periods period ON period.id=result.period_id
            WHERE ev.id=o.source_id AND ev.event_type='PAYSLIP_ISSUED'
              AND issue.employee_user_id=o.recipient_user_id
              AND ev.actor_user_id=issue.issued_by
              AND issue.snapshot_sha256 IS NOT NULL AND issue.issued_at IS NOT NULL
              AND ev.period_id=result.period_id AND ev.employment_id=result.employment_id
              AND result.status='LOCKED'
              AND period.status IN ('APPROVED','PAYMENT_PREPARED')
              AND nullif(pg_catalog.btrim(period.period_code),'') IS NOT NULL))
        OR (o.source_table='office_access_audit'
          AND EXISTS(SELECT 1 FROM public.office_access_audit ev WHERE ev.id=o.source_id
            AND ((o.event_code='ROLE-02'
              AND ev.action IN ('ROLE_GRANTED','ROLE_REVOKED')
              AND ev.target_user_id=o.recipient_user_id)
            OR (o.event_code='ROLE-08'
              AND ev.action IN ('ACCESS_REVIEW_APPROVED','ACCESS_REVIEW_CHANGES_REQUIRED')
              AND ev.target_user_id IS NOT NULL
              AND o.recipient_user_id IN (ev.target_user_id,ev.actor_user_id)))))
        OR (o.source_table='office_lifecycle_mail_decision_events'
          AND EXISTS(SELECT 1 FROM public.office_lifecycle_mail_decision_events d
            WHERE d.id=o.source_id AND d.recipient_user_id=o.recipient_user_id
              AND (
                (o.event_code='TIME-01' AND d.source_kind='WORKTIME_POLICY'
                  AND d.result_status='APPROVED'
                  AND EXISTS(SELECT 1 FROM public.office_worktime_policy_versions p
                    WHERE p.id=d.source_uuid AND p.employee_user_id=o.recipient_user_id
                      AND p.status='APPROVED' AND p.approved_by IS NOT NULL
                      AND p.approved_at IS NOT NULL
                      AND p.approved_by IS DISTINCT FROM p.employee_user_id
                      AND p.approved_by IS DISTINCT FROM p.proposed_by
                      AND nullif(pg_catalog.btrim(p.authority_reference),'') IS NOT NULL))
                OR (o.event_code='TIME-08' AND d.source_kind='FLEX_DAY'
                  AND d.result_status IN ('APPROVED','REJECTED')
                  AND EXISTS(SELECT 1 FROM public.office_flex_day_requests f
                    WHERE f.id=d.source_uuid AND f.employee_user_id=o.recipient_user_id
                      AND f.status=d.result_status
                      AND f.reviewed_by IS NOT NULL AND f.reviewed_at IS NOT NULL
                      AND f.reviewed_by IS DISTINCT FROM f.employee_user_id
                      AND f.reviewed_by IS DISTINCT FROM f.requested_by)))))
        OR (o.source_table='office_auth_events' AND o.event_code='AUTH-11'
          AND EXISTS(SELECT 1 FROM public.office_auth_events ev
            WHERE ev.id=o.source_id AND ev.user_id=o.recipient_user_id
              AND ev.event_type='SESSION_REVOKED'))
      )
    ORDER BY o.created_at,o.id
    FOR UPDATE OF o SKIP LOCKED LIMIT p_limit
  ), claimed AS(
    UPDATE public.office_lifecycle_mail_outbox o
      SET status='SENDING',claim_token=pg_catalog.gen_random_uuid(),
        claimed_at=pg_catalog.now()
      FROM candidates c WHERE c.id=o.id
      RETURNING o.id,o.claim_token,o.event_code,o.source_table,o.source_id,o.recipient_user_id
  ), logged AS(
    INSERT INTO public.office_lifecycle_mail_events AS events(outbox_id,event_type)
      SELECT c.id,'CLAIMED' FROM claimed c RETURNING events.outbox_id
  )
  SELECT c.id,c.claim_token,c.event_code,a.email,
    coalesce(nullif(pg_catalog.btrim(i.display_name),''),'Colleague'),
    (c.source_table||':'||c.source_id::text),
    CASE WHEN c.event_code='PAY-06' THEN (
      SELECT period.period_code FROM public.office_payroll_events ev
        JOIN public.office_salary_payslip_issues issue
          ON issue.id::text=ev.metadata->>'payslip_issue_id'
        JOIN public.office_payroll_results result ON result.id=issue.payroll_result_id
        JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE ev.id=c.source_id AND ev.event_type='PAYSLIP_ISSUED' LIMIT 1
    )
    WHEN c.event_code='PAY-09' THEN (
      SELECT period.period_code FROM public.office_payroll_events ev
        JOIN public.office_salary_settlement_evidence se
          ON se.id::text=ev.metadata->>'settlement_id'
        JOIN public.office_payroll_results result ON result.id=se.payroll_result_id
        JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE ev.id=c.source_id AND ev.event_type='BANK_SALARY_PARTIAL_VERIFIED'
      LIMIT 1
    )
    WHEN c.event_code='PAY-08' THEN (
      SELECT period.period_code FROM public.office_payroll_events ev
        JOIN public.office_salary_settlement_evidence se
          ON se.id::text=ev.metadata->>'settlement_id'
        JOIN public.office_payroll_results result ON result.id=se.payroll_result_id
        JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE ev.id=c.source_id AND ev.event_type='BANK_SALARY_CREDIT_VERIFIED'
      LIMIT 1
    )
    ELSE NULL END
    FROM claimed c JOIN logged l ON l.outbox_id=c.id
    JOIN public.office_identity_users i ON i.user_id=c.recipient_user_id
    JOIN public.office_auth_users a ON a.id=c.recipient_user_id::text;
END;
$claim$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_claim(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_mail_claim(integer)
 TO kravia_office_backend;

DROP TRIGGER IF EXISTS office_lifecycle_mail_on_recruitment ON public.office_recruitment_events;
CREATE TRIGGER office_lifecycle_mail_on_recruitment
 AFTER INSERT ON public.office_recruitment_events
 FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
COMMENT ON FUNCTION public.office_lifecycle_mail_claim(integer) IS
 'Private 31-source employee lifecycle claims: provider-unknown results must never be retried automatically.';
