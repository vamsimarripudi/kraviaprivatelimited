-- Forward-only Office security reviewer mapping after 032/033 classification.
-- Independent device approver receives a separate, disabled-by-default
-- governed notice, never the requester's private approval link or raw token.
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>70
 OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE enabled)>0
 OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Device review source requires 70 disabled mappings and empty outbox';
 END IF;
END $guard$;

ALTER TABLE public.office_lifecycle_aux_proofs
 DROP CONSTRAINT office_lifecycle_aux_proofs_event_code_check,
 ADD CONSTRAINT office_lifecycle_aux_proofs_event_code_check
 CHECK(event_code IN(
 'ROLE-07','ROLE-03','DEV-02','ONB-06','ONB-11','ONB-12','PAY-10',
 'TIME-10','DEV-08','ONB-08','ONB-03','PAY-11','PAY-12','TIME-07',
 'TIME-09','TIME-02','EXIT-01','AUTH-06'
 ));

UPDATE public.office_lifecycle_mail_policy
 SET source_ready=true
 WHERE event_code='AUTH-06' AND NOT source_ready AND NOT enabled;

-- Canonical auxiliary proof validation also handles every previous event,
-- preserving all previously enabled and time-gated source checks.
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
 ELSIF p_proof.event_code='AUTH-06' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_auth_events_v2 event
     JOIN public.office_login_device_approvals approval
       ON approval.session_id=event.session_id
       AND approval.user_id=event.user_id
     JOIN public.office_identity_users requested
       ON requested.user_id=p_proof.employee_user_id
     JOIN public.office_identity_users reviewer
       ON reviewer.user_id=p_proof.recipient_user_id
     WHERE event.id=p_proof.source_uuid::text
       AND event.event_type='DEVICE_APPROVAL_REQUESTED'
       AND event.user_id=p_proof.employee_user_id::text
       AND requested.status='ACTIVE'
       AND reviewer.status='ACTIVE'
       AND reviewer.user_id IS DISTINCT FROM requested.user_id
       AND approval.status='PENDING'
       AND approval.expires_at>pg_catalog.now()
       AND public.office_effective_permission(
         reviewer.user_id,'access.device.approve','COMPANY',NULL,NULL)
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
 ELSIF p_proof.event_code='TIME-02' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_lifecycle_attendance_reminder_sources reminder
     JOIN public.office_identity_users employee
       ON employee.user_id=reminder.employee_user_id
       AND employee.status='ACTIVE'
     JOIN public.office_employment_registry employment
       ON employment.identity_user_id=reminder.employee_user_id
       AND employment.status='ACTIVE'
       AND employment.relationship_type='EMPLOYEE'
       AND employment.start_date<=reminder.work_date
     JOIN public.office_job_assignments job
       ON job.user_id=reminder.employee_user_id
       AND job.status='ACTIVE'
       AND job.start_date<=reminder.work_date
     WHERE reminder.id=p_proof.source_uuid
       AND reminder.employee_user_id=p_proof.employee_user_id
       AND reminder.employee_user_id=p_proof.recipient_user_id
       AND extract(isodow FROM reminder.work_date) BETWEEN 1 AND 5
       AND reminder.work_date=(
         (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date
          - CASE extract(isodow FROM
             (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date)::integer
             WHEN 1 THEN 3 WHEN 2 THEN 1 WHEN 3 THEN 1
             WHEN 4 THEN 1 WHEN 5 THEN 1 ELSE -99 END
       )
       AND NOT EXISTS(
         SELECT 1 FROM public.office_attendance_sessions attendance
         WHERE attendance.user_id=reminder.employee_user_id
           AND attendance.work_date=reminder.work_date
           AND attendance.status IN ('OPEN','CLOSED')
       )
       AND NOT EXISTS(
         SELECT 1 FROM public.office_worktime_review_cases claim
         WHERE claim.employee_user_id=reminder.employee_user_id
           AND claim.status='APPROVED'
           AND (claim.work_starts_at AT TIME ZONE 'Asia/Kolkata')::date=reminder.work_date
       )
       AND NOT EXISTS(
         SELECT 1 FROM public.office_flex_day_requests leave_request
         WHERE leave_request.employee_user_id=reminder.employee_user_id
           AND leave_request.status='APPROVED'
           AND leave_request.leave_date=reminder.work_date
       )
   );
 ELSIF p_proof.event_code='EXIT-01' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_requests request
     JOIN public.office_request_events review
       ON review.request_id=request.id
       AND review.event_type='REQUEST_APPROVED'
       AND review.to_status='APPROVED'
     JOIN public.office_department_ownership owner
       ON owner.department_code='PEOPLE'
       AND owner.owner_user_id=p_proof.recipient_user_id
     JOIN public.office_identity_users reviewer
       ON reviewer.user_id=owner.owner_user_id
       AND reviewer.status='ACTIVE'
     WHERE request.id=p_proof.source_uuid
       AND request.request_type_code='EMPLOYEE_OFFBOARDING'
       AND request.status IN ('APPROVED','FULFILLED')
       AND request.target_user_id=p_proof.employee_user_id
       AND request.target_user_id IS DISTINCT FROM p_proof.recipient_user_id
       AND public.office_effective_permission(
         reviewer.user_id,'people.update','COMPANY',NULL,NULL)
   );
 END IF;
 RETURN false;
END;
$verify$;

REVOKE ALL ON FUNCTION public.office_lifecycle_aux_proof_valid(
 public.office_lifecycle_aux_proofs
) FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

-- The immutable auth event is emitted by the backend. The approval row can
-- flush after this event: defer the pending-decision test to the claim.
CREATE OR REPLACE FUNCTION public.office_lifecycle_independent_device_review_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE
  v_requester uuid;
  v_reviewer uuid;
  v_proof bigint;
BEGIN
 IF NEW.event_type<>'DEVICE_APPROVAL_REQUESTED'
    OR NEW.user_id IS NULL OR NEW.session_id IS NULL THEN RETURN NEW; END IF;
 BEGIN v_requester:=NEW.user_id::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RETURN NEW;
 END;
 SELECT reviewer.user_id INTO v_reviewer
 FROM public.office_identity_users reviewer
 JOIN public.office_auth_users account ON account.id=reviewer.user_id::text
 WHERE reviewer.status='ACTIVE'
   AND account.status='ACTIVE'
   AND lower(account.email) LIKE '%@kraviaprivatelimited.com'
   AND reviewer.user_id IS DISTINCT FROM v_requester
   AND public.office_effective_permission(
     reviewer.user_id,'access.device.approve','COMPANY',NULL,NULL)
 ORDER BY reviewer.created_at,reviewer.user_id LIMIT 1;
 IF v_reviewer IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.office_identity_users requester
   WHERE requester.user_id=v_requester AND requester.status='ACTIVE'
 ) OR NOT EXISTS(
   SELECT 1 FROM public.office_lifecycle_mail_policy policy
   WHERE policy.event_code='AUTH-06'
     AND policy.source_ready AND policy.enabled
 ) THEN RETURN NEW; END IF;
 INSERT INTO public.office_lifecycle_aux_proofs(
  event_code,source_uuid,recipient_user_id,employee_user_id
 ) VALUES ('AUTH-06',NEW.id::uuid,v_reviewer,v_requester)
 RETURNING id INTO v_proof;
 PERFORM public.office_lifecycle_mail_enqueue(
   'AUTH-06','office_lifecycle_aux_proofs',v_proof,v_reviewer);
 RETURN NEW;
END;
$source$;

REVOKE ALL ON FUNCTION public.office_lifecycle_independent_device_review_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_lifecycle_on_independent_device_request
 AFTER INSERT ON public.office_auth_events_v2
 FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_independent_device_review_source();

DO $final$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>71
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 71 mapped events; independent device mail disabled';
 END IF;
END $final$;
