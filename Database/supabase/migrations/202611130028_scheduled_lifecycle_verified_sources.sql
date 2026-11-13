-- KRAVIA Office 6 scheduled, source-verified HR/payroll reminders.
-- Forward-only after migration 027. Never backfill past due messages.
-- No message is enabled/sent until separately authorised by Owner and worker.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
   OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>43
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
  RAISE EXCEPTION 'Unexpected source or delivery state; manual reconciliation required';
 END IF;
END;
$preflight$;

ALTER TABLE public.office_lifecycle_aux_proofs
 DROP CONSTRAINT office_lifecycle_aux_proofs_event_code_check,
 ADD CONSTRAINT office_lifecycle_aux_proofs_event_code_check
 CHECK(event_code IN (
   'ROLE-07','ROLE-03',
   'DEV-02','ONB-06','ONB-11','ONB-12','PAY-10','TIME-10'
 ));

-- At most one pending reminder per immutable canonical source per recipient,
-- even across repeated worker ticks and restarted containers.
CREATE UNIQUE INDEX office_lifecycle_one_scheduled_proof
 ON public.office_lifecycle_aux_proofs(event_code,source_uuid,recipient_user_id)
 WHERE event_code IN ('DEV-02','ONB-06','ONB-11','ONB-12','PAY-10','TIME-10');

UPDATE public.office_lifecycle_mail_policy
 SET source_ready=true
 WHERE event_code IN ('DEV-02','ONB-06','ONB-11','ONB-12','PAY-10','TIME-10')
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
 END IF;
 RETURN false;
END;
$verify$;

-- Tick only while global delivery is explicitly enabled. Each result is
-- independently revalidated by office_lifecycle_aux_proof_valid() at claim.
-- Sources are canonical scheduled/deadline/financial records, never login idle.
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
REVOKE ALL ON FUNCTION public.office_lifecycle_reminder_tick(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_reminder_tick(integer)
 TO kravia_office_backend;

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>49
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Expected 49 verified, disabled lifecycle routes and no queued mail';
 END IF;
END;
$postcheck$;
