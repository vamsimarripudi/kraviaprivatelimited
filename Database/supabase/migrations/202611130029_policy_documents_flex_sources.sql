-- Additive Office document/policy/flex source notifications; after migration 028.
-- Existing transactional security emails remain the original sender.
-- This migration sends no email, replays no historical data and leaves all
-- policy flags disabled pending explicit Owner approval.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
   OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>49
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
  RAISE EXCEPTION 'Office document source reconciliation requires 49 disabled rules and no pending mail';
 END IF;
END;
$preflight$;

ALTER TABLE public.office_lifecycle_aux_proofs
 DROP CONSTRAINT office_lifecycle_aux_proofs_event_code_check,
 ADD CONSTRAINT office_lifecycle_aux_proofs_event_code_check
 CHECK(event_code IN (
   'ROLE-07','ROLE-03','DEV-02','ONB-06','ONB-11','ONB-12','PAY-10','TIME-10',
   'DEV-08','ONB-08','ONB-03','PAY-11','PAY-12','TIME-07','TIME-09'
 ));
CREATE UNIQUE INDEX office_lifecycle_one_document_or_flex_proof
 ON public.office_lifecycle_aux_proofs(event_code,source_uuid,recipient_user_id)
 WHERE event_code IN ('DEV-08','ONB-08','ONB-03','PAY-11','PAY-12','TIME-07','TIME-09');

ALTER TABLE public.office_lifecycle_auth_signals
 DROP CONSTRAINT office_lifecycle_auth_signals_event_code_check,
 ADD CONSTRAINT office_lifecycle_auth_signals_event_code_check
 CHECK(event_code IN ('AUTH-04','AUTH-07','AUTH-09','AUTH-10'));

UPDATE public.office_lifecycle_mail_policy SET source_ready=true
WHERE event_code IN ('AUTH-10','DEV-08','ONB-08','ONB-03',
  'PAY-11','PAY-12','TIME-07','TIME-09')
  AND NOT source_ready AND NOT enabled;

-- A Flex Day is earned only from five independently approved, distinct
-- six-net-hour weekdays with a separately approved effective policy.
-- Never infer eligibility from a manually submitted aggregate alone.
CREATE OR REPLACE FUNCTION public.office_lifecycle_flex_evidence_valid(p_request uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $flex$
DECLARE
 v_request public.office_flex_day_requests%ROWTYPE;
 v_policy public.office_worktime_policy_versions%ROWTYPE;
 v_index integer;
 v_start timestamptz;
 v_end timestamptz;
 v_day numeric;
 v_week numeric:=0;
BEGIN
 SELECT * INTO v_request FROM public.office_flex_day_requests WHERE id=p_request;
 IF NOT FOUND OR v_request.qualifying_work_minutes<1800
    OR v_request.earned_week_monday IS NULL
    OR extract(isodow FROM v_request.earned_week_monday)<>1 THEN
   RETURN false;
 END IF;
 SELECT * INTO v_policy
 FROM public.office_worktime_policy_versions p
 WHERE p.employee_user_id=v_request.employee_user_id
   AND p.status='APPROVED'
   AND p.effective_from<=v_request.earned_week_monday
   AND p.approved_by IS NOT NULL
   AND p.approved_at IS NOT NULL
   AND p.approved_by IS DISTINCT FROM p.proposed_by
   AND p.approved_by IS DISTINCT FROM p.employee_user_id
 ORDER BY p.effective_from DESC LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;
 FOR v_index IN 0..4 LOOP
   v_start:=(v_request.earned_week_monday+v_index)::timestamp
      AT TIME ZONE 'Asia/Kolkata';
   v_end:=(v_request.earned_week_monday+v_index+1)::timestamp
      AT TIME ZONE 'Asia/Kolkata';
   SELECT COALESCE(pg_catalog.sum(GREATEST(0,
      GREATEST(0,extract(epoch FROM
        LEAST(c.work_ends_at,v_end)-GREATEST(c.work_starts_at,v_start))/60)
      - COALESCE((
        SELECT pg_catalog.sum(GREATEST(0,extract(epoch FROM
          LEAST((b->>'endAt')::timestamptz,v_end)
          -GREATEST((b->>'startAt')::timestamptz,v_start))/60))
        FROM jsonb_array_elements(c.breaks) AS b
       ),0)
    )),0) INTO v_day
   FROM public.office_worktime_review_cases c
   WHERE c.employee_user_id=v_request.employee_user_id
     AND c.status='APPROVED'
     AND c.reviewed_at IS NOT NULL
     AND c.reviewed_by IS NOT NULL
     AND c.reviewed_by IS DISTINCT FROM c.employee_user_id
     AND c.reviewed_by IS DISTINCT FROM c.requested_by
     AND c.work_starts_at<v_end AND c.work_ends_at>v_start;
   IF v_day<v_policy.regular_daily_minutes THEN RETURN false; END IF;
   v_week:=v_week+v_day;
 END LOOP;
 RETURN v_week>=v_policy.weekly_target_minutes
   AND v_week>=1800;
EXCEPTION WHEN others THEN
 RETURN false;
END;
$flex$;
REVOKE ALL ON FUNCTION public.office_lifecycle_flex_evidence_valid(uuid)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_lifecycle_aux_proof_valid(
 p_proof public.office_lifecycle_aux_proofs
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $verify$
BEGIN
 IF p_proof.event_code='ROLE-07' THEN
   RETURN EXISTS (
     SELECT 1 FROM public.office_access_reviews review
     JOIN public.office_department_ownership owner
       ON owner.department_code='PEOPLE'
       AND owner.owner_user_id=p_proof.recipient_user_id
     JOIN public.office_identity_users reviewer
       ON reviewer.user_id=owner.owner_user_id AND reviewer.status='ACTIVE'
     WHERE review.id=p_proof.source_uuid
       AND review.user_id=p_proof.employee_user_id
       AND review.status='PENDING'
       AND review.due_at>pg_catalog.now()
       AND review.user_id IS DISTINCT FROM reviewer.user_id
       AND public.office_effective_permission(
         reviewer.user_id,'people.update','COMPANY',NULL,NULL)
   );
 ELSIF p_proof.event_code='ROLE-03' THEN
   RETURN EXISTS (
     SELECT 1 FROM public.office_job_assignments job
     JOIN public.office_identity_users employee
       ON employee.user_id=job.user_id AND employee.status='ACTIVE'
     JOIN public.office_identity_users manager
       ON manager.user_id=job.reports_to_user_id AND manager.status='ACTIVE'
     WHERE job.user_id=p_proof.source_uuid
       AND job.user_id=p_proof.employee_user_id
       AND job.status='ACTIVE'
       AND job.reports_to_user_id=p_proof.expected_manager_user_id
       AND p_proof.recipient_user_id=job.user_id
       AND job.updated_at<=p_proof.observed_at
   );
 ELSIF p_proof.event_code='DEV-02' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_training_assignments assignment
     LEFT JOIN public.office_job_assignments job
       ON job.user_id=assignment.user_id AND job.status='ACTIVE'
     WHERE assignment.id=p_proof.source_uuid
       AND assignment.user_id=p_proof.employee_user_id
       AND assignment.status IN ('ASSIGNED','IN_PROGRESS')
       AND assignment.due_on BETWEEN
         (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date
         AND (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date+3
       AND (
         p_proof.recipient_user_id=assignment.user_id OR (
           job.reports_to_user_id=p_proof.expected_manager_user_id
           AND job.reports_to_user_id=p_proof.recipient_user_id
           AND EXISTS(SELECT 1 FROM public.office_identity_users manager
             WHERE manager.user_id=job.reports_to_user_id AND manager.status='ACTIVE')
         )
       )
   );
 ELSIF p_proof.event_code IN ('ONB-06','ONB-11','ONB-12') THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_employment_registry employment
     JOIN public.office_job_assignments job
       ON job.user_id=employment.identity_user_id
     WHERE employment.employment_id=p_proof.source_uuid
       AND employment.identity_user_id=p_proof.employee_user_id
       AND employment.relationship_type='EMPLOYEE'
       AND employment.status='ACTIVE'
       AND job.status='ACTIVE'
       AND job.start_date<=
         (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date
       AND employment.start_date=(
         (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date -
         CASE p_proof.event_code
           WHEN 'ONB-06' THEN 0
           WHEN 'ONB-11' THEN 7
           ELSE 30 END
       )
       AND (
         p_proof.recipient_user_id=employment.identity_user_id OR (
           p_proof.event_code IN ('ONB-11','ONB-12')
           AND p_proof.recipient_user_id=job.reports_to_user_id
           AND p_proof.expected_manager_user_id=job.reports_to_user_id
           AND EXISTS(SELECT 1 FROM public.office_identity_users manager
             WHERE manager.user_id=job.reports_to_user_id AND manager.status='ACTIVE')
         )
       )
   );
 ELSIF p_proof.event_code='PAY-10' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_payroll_results result
     JOIN public.office_payroll_periods period ON period.id=result.period_id
     WHERE result.id=p_proof.source_uuid
       AND result.employee_user_id=p_proof.employee_user_id
       AND result.employee_user_id=p_proof.recipient_user_id
       AND result.status='LOCKED'
       AND result.net_pay_minor>0
       AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
       AND period.pay_date <
         (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date
       AND COALESCE((
         SELECT pg_catalog.sum(evidence.amount_minor)
         FROM public.office_salary_settlement_evidence evidence
         WHERE evidence.payroll_result_id=result.id
           AND evidence.status='VERIFIED'
       ),0)<result.net_pay_minor
   );
 ELSIF p_proof.event_code='TIME-10' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_payroll_periods period
     JOIN public.office_employment_registry employment
       ON employment.identity_user_id=p_proof.employee_user_id
     JOIN public.office_job_assignments job
       ON job.user_id=p_proof.employee_user_id
     WHERE period.id=p_proof.source_uuid
       AND period.status IN ('DRAFT','ATTENDANCE_READY','CALCULATED','PENDING_REVIEW','APPROVED')
       AND period.attendance_cutoff_at>pg_catalog.now()
       AND period.attendance_cutoff_at<=pg_catalog.now()+interval '24 hours'
       AND employment.status='ACTIVE'
       AND employment.relationship_type='EMPLOYEE'
       AND job.status='ACTIVE'
       AND (
         p_proof.recipient_user_id=employment.identity_user_id OR (
           p_proof.recipient_user_id=job.reports_to_user_id
           AND p_proof.expected_manager_user_id=job.reports_to_user_id
           AND EXISTS(SELECT 1 FROM public.office_identity_users manager
             WHERE manager.user_id=job.reports_to_user_id AND manager.status='ACTIVE')
         )
       )
   );
 ELSIF p_proof.event_code IN ('DEV-08','ONB-08') THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_policy_versions version
     JOIN public.office_policies policy ON policy.id=version.policy_id
     JOIN public.office_identity_users employee
       ON employee.user_id=p_proof.recipient_user_id
     WHERE version.id=p_proof.source_uuid
       AND p_proof.recipient_user_id=p_proof.employee_user_id
       AND version.status='PUBLISHED'
       AND version.published_by IS NOT NULL
       AND version.published_at IS NOT NULL
       AND policy.status='PUBLISHED'
       AND policy.current_version=version.version
       AND employee.status='ACTIVE'
       AND (
         policy.audience_type='COMPANY'
         OR (policy.audience_type='DEPARTMENT'
           AND policy.audience_key=employee.primary_department)
         OR (policy.audience_type='ROLE'
           AND EXISTS(
             SELECT 1 FROM public.office_user_roles role
             WHERE role.user_id=employee.user_id
               AND role.role=policy.audience_key
               AND (role.expires_at IS NULL OR role.expires_at>pg_catalog.now())
           ))
       )
       AND (
         p_proof.event_code='DEV-08'
         OR (
           policy.acknowledgement_required
           AND NOT EXISTS(
             SELECT 1 FROM public.office_policy_acknowledgements receipt
             WHERE receipt.policy_version_id=version.id
               AND receipt.user_id=employee.user_id
           )
         )
       )
   );
 ELSIF p_proof.event_code IN ('ONB-03','PAY-12') THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_document_instances document
     JOIN public.office_document_templates template
       ON template.id=document.template_id
     WHERE document.id=p_proof.source_uuid
       AND document.subject_reference=p_proof.employee_user_id::text
       AND document.subject_type='EMPLOYEE'
       AND p_proof.recipient_user_id=p_proof.employee_user_id
       AND document.approved_by IS NOT NULL
       AND document.approved_at IS NOT NULL
       AND (
         (p_proof.event_code='ONB-03'
           AND template.category='HR'
           AND template.template_code ILIKE '%APPOINTMENT%'
           AND document.status IN ('SIGNED','DELIVERED')
           AND document.signed_at IS NOT NULL
           AND EXISTS(SELECT 1 FROM public.office_document_signature_evidence signature
             WHERE signature.document_instance_id=document.id
               AND signature.status='VERIFIED'
               AND signature.signed_at IS NOT NULL))
         OR (p_proof.event_code='PAY-12'
           AND template.category='FINANCE'
           AND template.template_code ILIKE '%ANNUAL%'
           AND document.status='DELIVERED'
           AND document.delivered_at IS NOT NULL)
       )
   );
 ELSIF p_proof.event_code='PAY-11' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_salary_payslip_issues issue
     JOIN public.office_payroll_results result
       ON result.id=issue.payroll_result_id
     WHERE issue.id=p_proof.source_uuid
       AND issue.employee_user_id=p_proof.employee_user_id
       AND p_proof.recipient_user_id=p_proof.employee_user_id
       AND issue.issued_at IS NOT NULL
       AND issue.issued_by IS NOT NULL
       AND issue.snapshot_sha256 IS NOT NULL
       AND result.status='LOCKED'
       AND EXISTS(
         SELECT 1 FROM public.office_salary_payslip_issues earlier
         JOIN public.office_payroll_results previous
           ON previous.id=earlier.payroll_result_id
         WHERE previous.period_id=result.period_id
           AND previous.employment_id=result.employment_id
           AND previous.employee_user_id=result.employee_user_id
           AND previous.calculation_version<result.calculation_version
           AND earlier.issued_at<issue.issued_at
           AND earlier.snapshot_sha256<>issue.snapshot_sha256
       )
       AND EXISTS(
         SELECT 1 FROM public.office_payroll_adjustments adjustment
         WHERE adjustment.period_id=result.period_id
           AND adjustment.employment_id=result.employment_id
           AND adjustment.employee_user_id=result.employee_user_id
           AND adjustment.status='APPROVED'
           AND adjustment.approved_by IS NOT NULL
           AND adjustment.approved_at IS NOT NULL
           AND adjustment.approved_by IS DISTINCT FROM adjustment.created_by
       )
   );
 ELSIF p_proof.event_code IN ('TIME-07','TIME-09') THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_flex_day_requests request
     JOIN public.office_worktime_policy_versions policy
       ON policy.employee_user_id=request.employee_user_id
       AND policy.status='APPROVED'
       AND policy.effective_from<=request.earned_week_monday
     WHERE request.id=p_proof.source_uuid
       AND request.employee_user_id=p_proof.employee_user_id
       AND request.qualifying_work_minutes>=1800
       AND public.office_lifecycle_flex_evidence_valid(request.id)
       AND request.status IN ('PENDING','APPROVED')
       AND (
         (p_proof.event_code='TIME-07'
           AND p_proof.recipient_user_id=request.employee_user_id)
         OR (p_proof.event_code='TIME-09'
           AND request.status='PENDING'
           AND request.requested_by=request.employee_user_id
           AND EXISTS (
             SELECT 1 FROM public.office_department_ownership owner
             JOIN public.office_identity_users reviewer
               ON reviewer.user_id=owner.owner_user_id
             WHERE owner.department_code='PEOPLE'
               AND reviewer.status='ACTIVE'
               AND owner.owner_user_id=p_proof.recipient_user_id
               AND owner.owner_user_id IS DISTINCT FROM request.employee_user_id
               AND public.office_effective_permission(
                 reviewer.user_id,'people.update','COMPANY',NULL,NULL)
           ))
       )
   );
 END IF;
 RETURN false;
END;
$verify$;
CREATE OR REPLACE FUNCTION public.office_lifecycle_auth_v2_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $auth$
DECLARE
 v_code text;
 v_recipient uuid;
 v_source bigint;
BEGIN
  v_code:=CASE NEW.event_type
   WHEN 'INVITATION_ACCEPTED' THEN 'AUTH-04'
   WHEN 'DEVICE_APPROVAL_APPROVED' THEN 'AUTH-07'
   WHEN 'DEVICE_APPROVAL_DECLINED' THEN 'AUTH-07'
   WHEN 'PASSWORD_RECOVERY_COMPLETED' THEN 'AUTH-09'
   WHEN 'LOGIN_BLOCKED' THEN 'AUTH-10'
   ELSE NULL END;
  IF v_code IS NULL OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT identity.user_id INTO v_recipient
  FROM public.office_identity_users identity
  JOIN public.office_auth_users account ON account.id=identity.user_id::text
  WHERE identity.user_id::text=NEW.user_id
    AND identity.status='ACTIVE' AND account.status='ACTIVE'
    AND pg_catalog.lower(account.email) LIKE '%@kraviaprivatelimited.com';
  IF v_recipient IS NULL THEN RETURN NEW; END IF;
  -- The evidence row may flush before the device-approval UPDATE in the
  -- same first-party transaction. Record the immutable event atomically now,
  -- and verify the committed, independently approved decision when the
  -- private worker claims the message (the claim function retains that check).
  IF v_code='AUTH-10' THEN
    -- Genuine temporary account locks only, max one source event per six
    -- hours per corporate identity to prevent attacker-triggered mail floods.
    IF NEW.metadata_json::jsonb->>'reason' IS DISTINCT FROM 'temporary_lock'
      OR NOT EXISTS(
        SELECT 1 FROM public.office_auth_users account
        WHERE account.id=NEW.user_id AND account.status='ACTIVE'
          AND account.locked_until>NEW.created_at
      )
      OR EXISTS(
        SELECT 1 FROM public.office_lifecycle_auth_signals prior
        WHERE prior.event_code='AUTH-10'
          AND prior.recipient_user_id=v_recipient
          AND prior.created_at>NEW.created_at-interval '6 hours'
      ) THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.office_lifecycle_auth_signals(auth_event_id,event_code,recipient_user_id)
  VALUES(NEW.id,v_code,v_recipient)
  ON CONFLICT(auth_event_id) DO NOTHING
  RETURNING id INTO v_source;
  IF v_source IS NOT NULL THEN
    PERFORM public.office_lifecycle_mail_enqueue(
      v_code,'office_lifecycle_auth_signals',v_source,v_recipient
    );
  END IF;
  RETURN NEW;
END;
$auth$;

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
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-01'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_compensation_versions cv ON cv.id=ev.compensation_version_id
            JOIN public.office_requests request ON request.id=cv.approval_request_id
            JOIN public.office_request_steps step ON step.request_id=request.id
                AND step.step_order=request.current_step_order
            JOIN public.office_identity_users reviewer ON reviewer.user_id=step.assigned_user_id
            WHERE ev.id=o.source_id AND ev.event_type='COMPENSATION_SUBMITTED'
              AND ev.metadata->>'approval_request_id'=request.id::text
              AND cv.status='PENDING_APPROVAL' AND cv.created_by=ev.actor_user_id
              AND request.request_type_code='COMPENSATION_CHANGE'
              AND request.status IN ('PENDING','IN_REVIEW')
              AND step.status='PENDING'
              AND step.required_permission='payroll.compensation.review'
              AND reviewer.status='ACTIVE'
              AND step.assigned_user_id=o.recipient_user_id
              AND step.assigned_user_id IS DISTINCT FROM cv.created_by
              AND step.assigned_user_id IS DISTINCT FROM cv.employee_user_id
              AND public.office_effective_permission(
                o.recipient_user_id,'payroll.compensation.review','COMPANY',NULL,NULL)))
        OR (o.source_table='office_payroll_events' AND o.event_code='PAY-04'
          AND EXISTS(SELECT 1 FROM public.office_payroll_events ev
            JOIN public.office_payroll_periods period ON period.id=ev.period_id
            JOIN public.office_requests request ON request.id=period.approval_request_id
            JOIN public.office_request_steps step ON step.request_id=request.id
                AND step.step_order=request.current_step_order
            JOIN public.office_identity_users reviewer ON reviewer.user_id=step.assigned_user_id
            WHERE ev.id=o.source_id AND ev.event_type='PAYROLL_SUBMITTED'
              AND ev.metadata->>'approval_request_id'=request.id::text
              AND period.status='PENDING_REVIEW'
              AND period.created_by=ev.actor_user_id
              AND request.request_type_code='PAYROLL_RUN_APPROVAL'
              AND request.status IN ('PENDING','IN_REVIEW')
              AND step.status='PENDING' AND step.required_permission='payroll.run.review'
              AND reviewer.status='ACTIVE'
              AND step.assigned_user_id=o.recipient_user_id
              AND step.assigned_user_id IS DISTINCT FROM period.created_by
              AND public.office_effective_permission(
                o.recipient_user_id,'payroll.run.review','COMPANY',NULL,NULL)))
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
        OR (o.source_table='office_lifecycle_auth_signals'
          AND EXISTS (
            SELECT 1 FROM public.office_lifecycle_auth_signals signal
            JOIN public.office_auth_events_v2 ev
              ON ev.id=signal.auth_event_id
             AND ev.user_id=signal.recipient_user_id::text
            WHERE signal.id=o.source_id
              AND signal.recipient_user_id=o.recipient_user_id
              AND signal.event_code=o.event_code
              AND (
                (signal.event_code='AUTH-04' AND ev.event_type='INVITATION_ACCEPTED')
                OR (signal.event_code='AUTH-09' AND ev.event_type='PASSWORD_RECOVERY_COMPLETED')
                OR (signal.event_code='AUTH-10' AND ev.event_type='LOGIN_BLOCKED'
                  AND ev.metadata_json::jsonb->>'reason'='temporary_lock'
                  AND EXISTS(
                    SELECT 1 FROM public.office_auth_users account
                    WHERE account.id=ev.user_id AND account.status='ACTIVE'
                      AND account.locked_until>ev.created_at
                  ))
                OR (signal.event_code='AUTH-07'
                  AND ev.event_type IN ('DEVICE_APPROVAL_APPROVED','DEVICE_APPROVAL_DECLINED')
                  AND EXISTS (
                    SELECT 1 FROM public.office_login_device_approvals approval
                    WHERE approval.session_id=ev.session_id
                      AND approval.user_id=ev.user_id
                      AND (
                        (ev.event_type='DEVICE_APPROVAL_APPROVED'
                          AND approval.status IN ('APPROVED','TRUSTED')
                          AND approval.approved_at IS NOT NULL)
                        OR (ev.event_type='DEVICE_APPROVAL_DECLINED'
                          AND approval.status='DECLINED'
                          AND approval.declined_at IS NOT NULL)
                      )
                  ))
              )
          ))
        OR (o.source_table='office_asset_events' AND o.event_code='ONB-07'
          AND EXISTS (
            SELECT 1 FROM public.office_asset_events event
            JOIN public.office_asset_lifecycle asset ON asset.asset_id=event.asset_id
            JOIN public.office_employment_registry employment
              ON employment.identity_user_id=asset.custodian_user_id
             AND employment.status='ACTIVE'
             AND employment.relationship_type='EMPLOYEE'
            WHERE event.id=o.source_id AND event.event_type='ASSIGNED'
              AND event.new_status='ASSIGNED'
              AND asset.lifecycle_status='ASSIGNED'
              AND asset.custodian_user_id=o.recipient_user_id
              AND event.metadata->>'custodian_user_id'=o.recipient_user_id::text
          ))
        OR (o.source_table='office_lifecycle_aux_proofs'
          AND EXISTS (
            SELECT 1 FROM public.office_lifecycle_aux_proofs proof
            WHERE proof.id=o.source_id
              AND proof.event_code=o.event_code
              AND proof.recipient_user_id=o.recipient_user_id
              AND public.office_lifecycle_aux_proof_valid(proof)
          ))
        OR (o.source_table='office_access_audit' AND o.event_code='AUTH-12'
          AND EXISTS (
            SELECT 1 FROM public.office_access_audit ev
            WHERE ev.id=o.source_id
              AND ev.action='MFA_RESET'
              AND ev.target_user_id=o.recipient_user_id
              AND ev.actor_user_id IS DISTINCT FROM ev.target_user_id
              AND pg_catalog.length(pg_catalog.btrim(COALESCE(ev.reason,'')))>=8
          ))
        OR (o.source_table='office_asset_events' AND o.event_code='EXIT-03'
          AND EXISTS (
            SELECT 1 FROM public.office_asset_events ev
            JOIN public.office_asset_lifecycle asset ON asset.asset_id=ev.asset_id
            JOIN public.office_employment_registry employment
              ON employment.identity_user_id=asset.custodian_user_id
            WHERE ev.id=o.source_id AND ev.event_type='RETURN_REQUESTED'
              AND ev.new_status='RETURN_PENDING'
              AND asset.lifecycle_status='RETURN_PENDING'
              AND asset.custodian_user_id=o.recipient_user_id
              AND employment.end_date IS NOT NULL
              AND employment.relationship_type='EMPLOYEE'
              AND employment.status IN ('ACTIVE','ON_LEAVE')
          ))
        OR (o.source_table='office_worktime_events' AND o.event_code='TIME-05'
          AND EXISTS (
            SELECT 1 FROM public.office_worktime_events ev
            JOIN public.office_worktime_review_cases claim ON claim.id=ev.case_id
            JOIN public.office_attendance_sessions attendance
              ON attendance.id=claim.attendance_session_id
              AND attendance.user_id=claim.employee_user_id
              AND attendance.status='CLOSED'
              AND attendance.check_in_at<=claim.work_starts_at
              AND attendance.check_out_at>=claim.work_ends_at
            JOIN public.office_department_ownership owner
              ON owner.department_code='PEOPLE'
            JOIN public.office_identity_users reviewer
              ON reviewer.user_id=owner.owner_user_id
            WHERE ev.id=o.source_id AND ev.event_type='SUBMITTED'
              AND claim.status='PENDING' AND claim.requested_by=ev.actor_user_id
              AND claim.source_kind='RECORDED_SESSION'
              AND public.office_lifecycle_worktime_net_minutes(claim.id)>360
              AND reviewer.status='ACTIVE'
              AND owner.owner_user_id=o.recipient_user_id
              AND owner.owner_user_id IS DISTINCT FROM ev.actor_user_id
              AND owner.owner_user_id IS DISTINCT FROM claim.employee_user_id
              AND public.office_effective_permission(
                owner.owner_user_id,'people.update','COMPANY',NULL,NULL)
          ))
        OR (o.source_table='office_worktime_events' AND o.event_code='TIME-06'
          AND EXISTS (
            SELECT 1 FROM public.office_worktime_events ev
            JOIN public.office_worktime_review_cases claim ON claim.id=ev.case_id
            JOIN public.office_attendance_sessions attendance
              ON attendance.id=claim.attendance_session_id
              AND attendance.user_id=claim.employee_user_id
              AND attendance.status='CLOSED'
              AND attendance.check_in_at<=claim.work_starts_at
              AND attendance.check_out_at>=claim.work_ends_at
            WHERE ev.id=o.source_id AND ev.event_type IN ('APPROVED','REJECTED')
              AND claim.employee_user_id=o.recipient_user_id
              AND claim.status=ev.event_type
              AND claim.reviewed_by=ev.actor_user_id
              AND claim.reviewed_at IS NOT NULL
              AND claim.reviewed_by IS DISTINCT FROM claim.employee_user_id
              AND claim.reviewed_by IS DISTINCT FROM claim.requested_by
              AND claim.source_kind='RECORDED_SESSION'
              AND public.office_lifecycle_worktime_net_minutes(claim.id)>360
              AND EXISTS (
                SELECT 1 FROM public.office_worktime_policy_versions policy
                WHERE policy.employee_user_id=claim.employee_user_id
                  AND policy.status='APPROVED'
                  AND policy.effective_from<=
                    (claim.work_starts_at AT TIME ZONE 'Asia/Kolkata')::date
                  AND policy.approved_by IS NOT NULL
                  AND policy.approved_at IS NOT NULL
                  AND policy.approved_by IS DISTINCT FROM policy.proposed_by
                  AND policy.approved_by IS DISTINCT FROM policy.employee_user_id
              )
          ))
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
    CASE WHEN c.event_code='PAY-10' THEN (
      SELECT period.period_code
      FROM public.office_lifecycle_aux_proofs proof
      JOIN public.office_payroll_results result
        ON result.id=proof.source_uuid
      JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE proof.id=c.source_id
        AND proof.event_code='PAY-10'
        AND result.employee_user_id=c.recipient_user_id
        AND period.period_code IS NOT NULL
      LIMIT 1
    )
    WHEN c.event_code='PAY-06' THEN (
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

-- Trigger-only, non-callable-from-browser emission of canonical policy,
-- signed-document, payslip correction and verified Flex Day evidence.
CREATE OR REPLACE FUNCTION public.office_lifecycle_document_policy_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $notify$
DECLARE
 v_code text;
 v_id bigint;
 v_recipient uuid;
 v_policy public.office_policies%ROWTYPE;
 v_source uuid;
 v_employee uuid;
 v_expected_manager uuid;
 v_doc public.office_document_instances%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='office_policy_versions' THEN
   IF NEW.status<>'PUBLISHED'
     OR NEW.published_by IS NULL OR NEW.published_at IS NULL THEN
      RETURN NEW;
   END IF;
   IF TG_OP='UPDATE' AND OLD.status='PUBLISHED' THEN RETURN NEW; END IF;
   SELECT * INTO v_policy FROM public.office_policies
   WHERE id=NEW.policy_id AND status='PUBLISHED'
     AND current_version=NEW.version;
   IF NOT FOUND THEN RETURN NEW; END IF;
   FOR v_recipient IN
      SELECT identity.user_id
      FROM public.office_identity_users identity
      JOIN public.office_auth_users account
        ON account.id=identity.user_id::text
      WHERE identity.status='ACTIVE'
        AND account.status='ACTIVE'
        AND pg_catalog.lower(account.email) LIKE '%@kraviaprivatelimited.com'
        AND (
          v_policy.audience_type='COMPANY'
          OR (v_policy.audience_type='DEPARTMENT'
            AND v_policy.audience_key=identity.primary_department)
          OR (v_policy.audience_type='ROLE'
            AND EXISTS(SELECT 1 FROM public.office_user_roles r
              WHERE r.user_id=identity.user_id
                AND r.role=v_policy.audience_key
                AND (r.expires_at IS NULL OR r.expires_at>pg_catalog.now())))
        )
   LOOP
     FOR v_code IN SELECT code FROM (
       VALUES('DEV-08'::text),('ONB-08'::text)
     ) routes(code)
     WHERE code='DEV-08'
       OR (v_policy.acknowledgement_required AND NOT EXISTS(
         SELECT 1 FROM public.office_policy_acknowledgements receipt
         WHERE receipt.policy_version_id=NEW.id
           AND receipt.user_id=v_recipient))
     LOOP
       IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy p
          WHERE p.event_code=v_code AND p.source_ready AND p.enabled) THEN
         INSERT INTO public.office_lifecycle_aux_proofs(
           event_code,source_uuid,recipient_user_id,employee_user_id
         ) VALUES(v_code,NEW.id,v_recipient,v_recipient)
         ON CONFLICT DO NOTHING RETURNING id INTO v_id;
         IF v_id IS NOT NULL THEN
           PERFORM public.office_lifecycle_mail_enqueue(
             v_code,'office_lifecycle_aux_proofs',v_id,v_recipient);
           v_id:=NULL;
         END IF;
       END IF;
     END LOOP;
   END LOOP;
 ELSIF TG_TABLE_NAME='office_document_instances'
    OR TG_TABLE_NAME='office_document_signature_evidence' THEN
   IF TG_TABLE_NAME='office_document_instances' THEN
     IF NEW.status NOT IN ('SIGNED','DELIVERED')
        OR (TG_OP='UPDATE' AND OLD.status=NEW.status) THEN RETURN NEW; END IF;
     SELECT * INTO v_doc FROM public.office_document_instances WHERE id=NEW.id;
   ELSE
     IF NEW.status<>'VERIFIED' OR NEW.signed_at IS NULL THEN RETURN NEW; END IF;
     SELECT * INTO v_doc FROM public.office_document_instances
     WHERE id=NEW.document_instance_id;
   END IF;
   IF v_doc.id IS NULL OR v_doc.subject_type<>'EMPLOYEE'
      OR v_doc.approved_by IS NULL OR v_doc.approved_at IS NULL
      OR v_doc.subject_reference IS NULL THEN RETURN NEW; END IF;
   SELECT identity.user_id INTO v_recipient
   FROM public.office_identity_users identity
   JOIN public.office_auth_users account ON account.id=identity.user_id::text
   WHERE identity.user_id::text=v_doc.subject_reference
     AND identity.status='ACTIVE' AND account.status='ACTIVE'
     AND pg_catalog.lower(account.email) LIKE '%@kraviaprivatelimited.com';
   IF v_recipient IS NULL THEN RETURN NEW; END IF;
   SELECT CASE
      WHEN template.category='HR'
       AND template.template_code ILIKE '%APPOINTMENT%'
       AND v_doc.status IN ('SIGNED','DELIVERED')
       AND v_doc.signed_at IS NOT NULL
       AND EXISTS(SELECT 1 FROM public.office_document_signature_evidence evidence
         WHERE evidence.document_instance_id=v_doc.id
           AND evidence.status='VERIFIED' AND evidence.signed_at IS NOT NULL)
         THEN 'ONB-03'
      WHEN template.category='FINANCE'
       AND template.template_code ILIKE '%ANNUAL%'
       AND v_doc.status='DELIVERED'
       AND v_doc.delivered_at IS NOT NULL THEN 'PAY-12'
      ELSE NULL END
   INTO v_code
   FROM public.office_document_templates template WHERE template.id=v_doc.template_id;
   IF v_code IS NOT NULL AND EXISTS(
     SELECT 1 FROM public.office_lifecycle_mail_policy policy
     WHERE policy.event_code=v_code AND policy.enabled AND policy.source_ready
   ) THEN
     INSERT INTO public.office_lifecycle_aux_proofs(
       event_code,source_uuid,recipient_user_id,employee_user_id
     ) VALUES(v_code,v_doc.id,v_recipient,v_recipient)
     ON CONFLICT DO NOTHING RETURNING id INTO v_id;
     IF v_id IS NOT NULL THEN
       PERFORM public.office_lifecycle_mail_enqueue(
         v_code,'office_lifecycle_aux_proofs',v_id,v_recipient);
     END IF;
   END IF;
 ELSIF TG_TABLE_NAME='office_salary_payslip_issues' THEN
   IF NEW.issued_at IS NULL OR NEW.issued_by IS NULL
      OR NEW.snapshot_sha256 IS NULL THEN RETURN NEW; END IF;
   SELECT result.employee_user_id INTO v_recipient
   FROM public.office_payroll_results result
   WHERE result.id=NEW.payroll_result_id AND result.status='LOCKED'
     AND result.employee_user_id=NEW.employee_user_id
     AND EXISTS(SELECT 1 FROM public.office_salary_payslip_issues older
       JOIN public.office_payroll_results previous
         ON previous.id=older.payroll_result_id
       WHERE previous.period_id=result.period_id
         AND previous.employment_id=result.employment_id
         AND previous.employee_user_id=result.employee_user_id
         AND previous.calculation_version<result.calculation_version
         AND older.issued_at<NEW.issued_at
         AND older.snapshot_sha256<>NEW.snapshot_sha256)
     AND EXISTS(SELECT 1 FROM public.office_payroll_adjustments adjustment
       WHERE adjustment.period_id=result.period_id
         AND adjustment.employment_id=result.employment_id
         AND adjustment.employee_user_id=result.employee_user_id
         AND adjustment.status='APPROVED'
         AND adjustment.approved_by IS NOT NULL
         AND adjustment.approved_at IS NOT NULL
         AND adjustment.approved_by IS DISTINCT FROM adjustment.created_by);
   IF v_recipient IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.office_lifecycle_mail_policy p
     WHERE p.event_code='PAY-11' AND p.enabled AND p.source_ready
   ) THEN RETURN NEW; END IF;
   INSERT INTO public.office_lifecycle_aux_proofs(
     event_code,source_uuid,recipient_user_id,employee_user_id
   ) VALUES('PAY-11',NEW.id,v_recipient,v_recipient)
   ON CONFLICT DO NOTHING RETURNING id INTO v_id;
   IF v_id IS NOT NULL THEN
     PERFORM public.office_lifecycle_mail_enqueue(
       'PAY-11','office_lifecycle_aux_proofs',v_id,v_recipient);
   END IF;
 ELSIF TG_TABLE_NAME='office_flex_day_requests' THEN
   IF NEW.status<>'PENDING' OR NEW.qualifying_work_minutes<1800
     OR NEW.requested_by IS DISTINCT FROM NEW.employee_user_id
     OR NOT public.office_lifecycle_flex_evidence_valid(NEW.id)
     OR NOT EXISTS(SELECT 1 FROM public.office_worktime_policy_versions p
       WHERE p.employee_user_id=NEW.employee_user_id
         AND p.status='APPROVED'
         AND p.effective_from<=NEW.earned_week_monday) THEN
       RETURN NEW;
   END IF;
   FOR v_code IN SELECT code FROM (VALUES('TIME-07'::text),('TIME-09'::text)) routes(code)
   LOOP
      IF v_code='TIME-07' THEN
        v_recipient:=NEW.employee_user_id;
      ELSE
        SELECT owner.owner_user_id INTO v_recipient
        FROM public.office_department_ownership owner
        JOIN public.office_identity_users reviewer
          ON reviewer.user_id=owner.owner_user_id
        WHERE owner.department_code='PEOPLE' AND reviewer.status='ACTIVE'
          AND owner.owner_user_id IS DISTINCT FROM NEW.employee_user_id
          AND public.office_effective_permission(
            reviewer.user_id,'people.update','COMPANY',NULL,NULL);
      END IF;
      IF v_recipient IS NULL OR NOT EXISTS(
        SELECT 1 FROM public.office_lifecycle_mail_policy p
        WHERE p.event_code=v_code AND p.enabled AND p.source_ready) THEN
        CONTINUE;
      END IF;
      INSERT INTO public.office_lifecycle_aux_proofs(
        event_code,source_uuid,recipient_user_id,employee_user_id
      ) VALUES(v_code,NEW.id,v_recipient,NEW.employee_user_id)
      ON CONFLICT DO NOTHING RETURNING id INTO v_id;
      IF v_id IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue(
          v_code,'office_lifecycle_aux_proofs',v_id,v_recipient);
      END IF;
   END LOOP;
 END IF;
 RETURN NEW;
END;
$notify$;
REVOKE ALL ON FUNCTION public.office_lifecycle_document_policy_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_lifecycle_notify_policy_insert
 AFTER INSERT ON public.office_policy_versions FOR EACH ROW
 EXECUTE FUNCTION public.office_lifecycle_document_policy_source();
CREATE TRIGGER office_lifecycle_notify_policy_publish
 AFTER UPDATE OF status ON public.office_policy_versions FOR EACH ROW
 EXECUTE FUNCTION public.office_lifecycle_document_policy_source();
CREATE TRIGGER office_lifecycle_notify_document_publish
 AFTER UPDATE OF status ON public.office_document_instances FOR EACH ROW
 EXECUTE FUNCTION public.office_lifecycle_document_policy_source();
CREATE TRIGGER office_lifecycle_notify_document_signed
 AFTER INSERT ON public.office_document_signature_evidence FOR EACH ROW
 EXECUTE FUNCTION public.office_lifecycle_document_policy_source();
CREATE TRIGGER office_lifecycle_notify_corrected_payslip
 AFTER INSERT ON public.office_salary_payslip_issues FOR EACH ROW
 EXECUTE FUNCTION public.office_lifecycle_document_policy_source();
CREATE TRIGGER office_lifecycle_notify_flex_request
 AFTER INSERT ON public.office_flex_day_requests FOR EACH ROW
 EXECUTE FUNCTION public.office_lifecycle_document_policy_source();

REVOKE ALL ON FUNCTION public.office_lifecycle_auth_v2_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
-- Existing trigger retains the updated first-party auth function.
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_claim(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_mail_claim(integer)
 TO kravia_office_backend;
DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>57
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 57 mapped sources (8 additional verified routes) with sending disabled';
 END IF;
END;
$postcheck$;