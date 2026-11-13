-- Source-backed attendance review and independently approved employee exit.
-- Additive after 029; does not backfill dates, enable notices, or send mail.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
   OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>57
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Unexpected Office lifecycle state; release reconciliation required';
 END IF;
END;
$preflight$;

ALTER TABLE public.office_lifecycle_aux_proofs
 DROP CONSTRAINT office_lifecycle_aux_proofs_event_code_check,
 ADD CONSTRAINT office_lifecycle_aux_proofs_event_code_check
 CHECK(event_code IN(
   'ROLE-07','ROLE-03','DEV-02','ONB-06','ONB-11','ONB-12','PAY-10','TIME-10',
   'DEV-08','ONB-08','ONB-03','PAY-11','PAY-12','TIME-07','TIME-09',
   'TIME-02','EXIT-01'
 ));

CREATE UNIQUE INDEX office_lifecycle_one_attendance_exit_proof
 ON public.office_lifecycle_aux_proofs(event_code,source_uuid,recipient_user_id)
 WHERE event_code IN ('TIME-02','EXIT-01');

CREATE TABLE public.office_lifecycle_attendance_reminder_sources(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 employee_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 work_date date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(employee_user_id,work_date),
 CHECK (extract(isodow FROM work_date) BETWEEN 1 AND 5)
);
ALTER TABLE public.office_lifecycle_attendance_reminder_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_attendance_reminder_sources
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON public.office_lifecycle_attendance_reminder_sources TO service_role;

UPDATE public.office_lifecycle_mail_policy SET source_ready=true
 WHERE event_code IN ('TIME-02','EXIT-01')
   AND NOT source_ready AND NOT enabled;


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
CREATE OR REPLACE FUNCTION public.office_lifecycle_reminder_tick(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $tick$
DECLARE
 v_count integer:=0;
 v_row record;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION 'Scheduled source tick must be bounded 1..50';
 END IF;
 FOR v_row IN
   WITH reference_time AS(
     SELECT pg_catalog.now() AS checked_at,
       (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date AS local_date
   ), missing_attendance AS(
     INSERT INTO public.office_lifecycle_attendance_reminder_sources(
       employee_user_id,work_date
     )
     SELECT DISTINCT identity.user_id, day_prior.work_date
     FROM public.office_identity_users identity
     JOIN public.office_auth_users account
       ON account.id=identity.user_id::text
       AND account.status='ACTIVE'
       AND pg_catalog.lower(account.email) LIKE '%@kraviaprivatelimited.com'
     JOIN public.office_employment_registry employment
       ON employment.identity_user_id=identity.user_id
       AND employment.status='ACTIVE'
       AND employment.relationship_type='EMPLOYEE'
     JOIN public.office_job_assignments job
       ON job.user_id=identity.user_id
       AND job.status='ACTIVE'
     CROSS JOIN reference_time clock
     CROSS JOIN LATERAL (
       SELECT CASE extract(isodow FROM clock.local_date)::integer
         WHEN 1 THEN clock.local_date-3
         WHEN 2 THEN clock.local_date-1
         WHEN 3 THEN clock.local_date-1
         WHEN 4 THEN clock.local_date-1
         WHEN 5 THEN clock.local_date-1
         ELSE NULL::date END AS work_date
     ) day_prior
     JOIN public.office_lifecycle_mail_policy policy
       ON policy.event_code='TIME-02'
       AND policy.source_ready AND policy.enabled
       AND policy.effective_from<=clock.checked_at
     WHERE identity.status='ACTIVE'
       AND day_prior.work_date IS NOT NULL
       AND employment.start_date<=day_prior.work_date
       AND job.start_date<=day_prior.work_date
       AND NOT EXISTS (
         SELECT 1 FROM public.office_attendance_sessions attendance
         WHERE attendance.user_id=identity.user_id
           AND attendance.work_date=day_prior.work_date
           AND attendance.status IN ('OPEN','CLOSED')
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.office_worktime_review_cases claim
         WHERE claim.employee_user_id=identity.user_id
           AND claim.status='APPROVED'
           AND (claim.work_starts_at AT TIME ZONE 'Asia/Kolkata')::date=day_prior.work_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.office_flex_day_requests leave_request
         WHERE leave_request.employee_user_id=identity.user_id
           AND leave_request.status='APPROVED'
           AND leave_request.leave_date=day_prior.work_date
       )
     ORDER BY identity.user_id,day_prior.work_date
     LIMIT p_limit
     ON CONFLICT(employee_user_id,work_date) DO NOTHING
     RETURNING id,employee_user_id
   ), candidate AS (
     SELECT 'DEV-02'::text AS event_code,
       training.id AS source_uuid, training.user_id AS employee_user_id,
       recipients.recipient AS recipient_user_id,
       recipients.manager AS expected_manager_user_id
     FROM public.office_training_assignments training
     JOIN public.office_identity_users identity
       ON identity.user_id=training.user_id AND identity.status='ACTIVE'
     JOIN public.office_employment_registry employment
       ON employment.identity_user_id=training.user_id
       AND employment.status='ACTIVE' AND employment.relationship_type='EMPLOYEE'
     LEFT JOIN public.office_job_assignments job
       ON job.user_id=training.user_id AND job.status='ACTIVE'
     CROSS JOIN reference_time clock
     CROSS JOIN LATERAL (
       VALUES (training.user_id,NULL::uuid),
              (job.reports_to_user_id,job.reports_to_user_id)
     ) recipients(recipient,manager)
     WHERE training.status IN ('ASSIGNED','IN_PROGRESS')
       AND training.due_on BETWEEN clock.local_date AND clock.local_date+3
     UNION ALL
     SELECT
       (CASE WHEN employment.start_date=clock.local_date THEN 'ONB-06'
         WHEN employment.start_date=clock.local_date-7 THEN 'ONB-11'
         WHEN employment.start_date=clock.local_date-30 THEN 'ONB-12'
         ELSE NULL END)::text,
       employment.employment_id,employment.identity_user_id,
       recipients.recipient,recipients.manager
     FROM public.office_employment_registry employment
     JOIN public.office_identity_users identity
       ON identity.user_id=employment.identity_user_id AND identity.status='ACTIVE'
     JOIN public.office_job_assignments job
       ON job.user_id=employment.identity_user_id AND job.status='ACTIVE'
     CROSS JOIN reference_time clock
     CROSS JOIN LATERAL(
       VALUES (employment.identity_user_id,NULL::uuid),
              (job.reports_to_user_id,job.reports_to_user_id)
     ) recipients(recipient,manager)
     WHERE employment.status='ACTIVE'
       AND employment.relationship_type='EMPLOYEE'
       AND job.start_date<=clock.local_date
       AND employment.start_date IN(
         clock.local_date,clock.local_date-7,clock.local_date-30
       )
       AND (employment.start_date<>clock.local_date
         OR recipients.recipient=employment.identity_user_id)
     UNION ALL
     SELECT 'PAY-10'::text,
       result.id,result.employee_user_id,
       result.employee_user_id,NULL::uuid
     FROM public.office_payroll_results result
     JOIN public.office_payroll_periods period ON period.id=result.period_id
     JOIN public.office_identity_users identity
       ON identity.user_id=result.employee_user_id AND identity.status='ACTIVE'
     CROSS JOIN reference_time clock
     WHERE result.status='LOCKED' AND result.net_pay_minor>0
       AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
       AND period.pay_date<clock.local_date
       AND COALESCE((
         SELECT pg_catalog.sum(evidence.amount_minor)
         FROM public.office_salary_settlement_evidence evidence
         WHERE evidence.payroll_result_id=result.id AND evidence.status='VERIFIED'
       ),0)<result.net_pay_minor
     UNION ALL
     SELECT 'TIME-10'::text,
       period.id,employment.identity_user_id,
       recipients.recipient,recipients.manager
     FROM public.office_payroll_periods period
     JOIN public.office_employment_registry employment
       ON employment.status='ACTIVE'
       AND employment.relationship_type='EMPLOYEE'
     JOIN public.office_identity_users identity
       ON identity.user_id=employment.identity_user_id AND identity.status='ACTIVE'
     JOIN public.office_job_assignments job
       ON job.user_id=employment.identity_user_id AND job.status='ACTIVE'
     CROSS JOIN reference_time clock
     CROSS JOIN LATERAL(
       VALUES (employment.identity_user_id,NULL::uuid),
              (job.reports_to_user_id,job.reports_to_user_id)
     ) recipients(recipient,manager)
     WHERE period.status IN ('DRAFT','ATTENDANCE_READY','CALCULATED','PENDING_REVIEW','APPROVED')
       AND period.attendance_cutoff_at>clock.checked_at
       AND period.attendance_cutoff_at<=clock.checked_at+interval '24 hours'
     UNION ALL
     SELECT 'TIME-02'::text,reminder.id,reminder.employee_user_id,
       reminder.employee_user_id,NULL::uuid
     FROM missing_attendance reminder
   ), scoped AS (
     SELECT candidate.* FROM candidate
     JOIN public.office_lifecycle_mail_policy policy
       ON policy.event_code=candidate.event_code
       AND policy.source_ready AND policy.enabled
       AND policy.effective_from<=pg_catalog.now()
     JOIN public.office_identity_users recipient
       ON recipient.user_id=candidate.recipient_user_id
       AND recipient.status='ACTIVE'
     WHERE candidate.event_code IS NOT NULL
       AND candidate.source_uuid IS NOT NULL
       AND candidate.recipient_user_id IS NOT NULL
       AND (
         candidate.recipient_user_id=candidate.employee_user_id
         OR (candidate.expected_manager_user_id=candidate.recipient_user_id
           AND EXISTS (
             SELECT 1 FROM public.office_job_assignments manager_job
             WHERE manager_job.user_id=candidate.employee_user_id
               AND manager_job.reports_to_user_id=candidate.recipient_user_id
               AND manager_job.status='ACTIVE'
           ))
       )
   ), eligible AS (
     SELECT scoped.* FROM scoped
     WHERE NOT EXISTS (
       SELECT 1 FROM public.office_lifecycle_aux_proofs existing
       WHERE existing.event_code=scoped.event_code
         AND existing.source_uuid=scoped.source_uuid
         AND existing.recipient_user_id=scoped.recipient_user_id
     )
   ), inserted AS (
     INSERT INTO public.office_lifecycle_aux_proofs(
       event_code,source_uuid,recipient_user_id,employee_user_id,
       expected_manager_user_id
     )
     SELECT eligible.event_code,eligible.source_uuid,
       eligible.recipient_user_id,eligible.employee_user_id,
       eligible.expected_manager_user_id
     FROM eligible
     ORDER BY eligible.event_code,eligible.source_uuid,eligible.recipient_user_id
     LIMIT p_limit
     ON CONFLICT DO NOTHING
     RETURNING id,event_code,recipient_user_id
   )
   SELECT id,event_code,recipient_user_id FROM inserted
 LOOP
   PERFORM public.office_lifecycle_mail_enqueue(
     v_row.event_code,'office_lifecycle_aux_proofs',
     v_row.id,v_row.recipient_user_id
   );
   v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END;
$tick$;

CREATE OR REPLACE FUNCTION public.office_lifecycle_approved_offboarding_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $exit$
DECLARE v_recipient uuid;v_proof bigint;v_employee uuid;v_request uuid;
BEGIN
 IF NEW.event_type<>'REQUEST_APPROVED' OR NEW.to_status<>'APPROVED' THEN
   RETURN NEW;
 END IF;
 SELECT request.target_user_id,request.id
   INTO v_employee,v_request
 FROM public.office_requests request
 WHERE request.id=NEW.request_id
   AND request.request_type_code='EMPLOYEE_OFFBOARDING'
   AND request.status='APPROVED'
   AND request.target_user_id IS NOT NULL;
 IF v_request IS NULL THEN RETURN NEW; END IF;
 SELECT owner.owner_user_id INTO v_recipient
 FROM public.office_department_ownership owner
 JOIN public.office_identity_users reviewer
   ON reviewer.user_id=owner.owner_user_id
 WHERE owner.department_code='PEOPLE'
   AND reviewer.status='ACTIVE'
   AND owner.owner_user_id IS DISTINCT FROM v_employee
   AND public.office_effective_permission(
     reviewer.user_id,'people.update','COMPANY',NULL,NULL);
 IF v_recipient IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.office_lifecycle_mail_policy policy
    WHERE policy.event_code='EXIT-01' AND policy.enabled AND policy.source_ready
 ) THEN RETURN NEW; END IF;
 INSERT INTO public.office_lifecycle_aux_proofs(
   event_code,source_uuid,recipient_user_id,employee_user_id
 ) VALUES('EXIT-01',v_request,v_recipient,v_employee)
 ON CONFLICT DO NOTHING RETURNING id INTO v_proof;
 IF v_proof IS NOT NULL THEN
   PERFORM public.office_lifecycle_mail_enqueue(
     'EXIT-01','office_lifecycle_aux_proofs',v_proof,v_recipient);
 END IF;
 RETURN NEW;
END;
$exit$;
REVOKE ALL ON FUNCTION public.office_lifecycle_approved_offboarding_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_lifecycle_on_approved_offboarding
 AFTER INSERT ON public.office_request_events
 FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_approved_offboarding_source();

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>59
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 59 source-ready, disabled lifecycle routes and zero sent';
 END IF;
END;
$postcheck$;
