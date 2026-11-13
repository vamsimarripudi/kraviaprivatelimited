-- KRAVIA Office safe scheduled lifecycle sources, forward-only after migration 027.
-- No retroactive employee mail, identity changes, payment changes or send activation.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
    OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>43
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Unexpected lifecycle starting state, reconcile before upgrading';
 END IF;
END;
$preflight$;

ALTER TABLE public.office_lifecycle_auth_signals
 DROP CONSTRAINT office_lifecycle_auth_signals_event_code_check,
 ADD CONSTRAINT office_lifecycle_auth_signals_event_code_check
 CHECK (event_code IN ('AUTH-04','AUTH-07','AUTH-09','AUTH-10'));

CREATE TABLE public.office_lifecycle_scheduled_proofs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_code text NOT NULL CHECK(event_code IN ('DEV-02','ONB-11','ONB-12','PAY-10','TIME-07')),
 source_uuid uuid NOT NULL,
 recipient_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(event_code,source_uuid,recipient_user_id)
);
ALTER TABLE public.office_lifecycle_scheduled_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_scheduled_proofs
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON public.office_lifecycle_scheduled_proofs TO service_role;

ALTER TABLE public.office_lifecycle_mail_outbox
 DROP CONSTRAINT office_lifecycle_mail_outbox_source_table_check,
 ADD CONSTRAINT office_lifecycle_mail_outbox_source_table_check
 CHECK(source_table IN(
   'office_employee_intake_events','office_role_package_events',
   'office_worktime_events','office_department_transfer_events','office_auth_events',
   'office_people_development_events','office_payroll_events','office_task_events',
   'office_access_audit','office_lifecycle_mail_decision_events','office_recruitment_events',
   'office_lifecycle_auth_signals','office_asset_events','office_lifecycle_aux_proofs',
   'office_lifecycle_scheduled_proofs'
 ));

UPDATE public.office_lifecycle_mail_policy SET source_ready=true
 WHERE event_code IN ('AUTH-10','DEV-02','ONB-11','ONB-12','PAY-10','TIME-07')
   AND source_ready=false AND enabled=false;

-- Independently recompute actual weekday work from approved, break-adjusted
-- evidence: five separate six-hour days, never compressed overtime.
CREATE OR REPLACE FUNCTION public.office_lifecycle_flex_evidence_verified(p_request uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $flexproof$
DECLARE
 req public.office_flex_day_requests%ROWTYPE;
 approved_policy public.office_worktime_policy_versions%ROWTYPE;
 day_index integer;
 day_start timestamptz;
 day_finish timestamptz;
 day_minutes numeric;
 worked numeric:=0;
BEGIN
 SELECT * INTO req FROM public.office_flex_day_requests
 WHERE id=p_request;
 IF NOT FOUND OR req.status NOT IN ('PENDING','APPROVED')
   OR req.requested_by IS DISTINCT FROM req.employee_user_id
   OR req.qualifying_work_minutes<1800
   OR req.earned_week_monday IS NULL
   OR EXTRACT(ISODOW FROM req.earned_week_monday)<>1 THEN
  RETURN false;
 END IF;
 SELECT * INTO approved_policy FROM public.office_worktime_policy_versions
 WHERE employee_user_id=req.employee_user_id
   AND status='APPROVED'
   AND effective_from<=req.earned_week_monday
   AND regular_daily_minutes=360 AND weekly_target_minutes=1800
   AND approved_by IS NOT NULL AND approved_at IS NOT NULL
   AND approved_by IS DISTINCT FROM employee_user_id
   AND approved_by IS DISTINCT FROM proposed_by
   AND NULLIF(btrim(authority_reference),'') IS NOT NULL
 ORDER BY effective_from DESC LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;
 FOR day_index IN 0..4 LOOP
   day_start:=(req.earned_week_monday+day_index)::timestamp
     AT TIME ZONE 'Asia/Kolkata';
   day_finish:=(req.earned_week_monday+day_index+1)::timestamp
     AT TIME ZONE 'Asia/Kolkata';
   SELECT COALESCE(SUM(GREATEST(0,
     GREATEST(0,EXTRACT(epoch FROM
       LEAST(c.work_ends_at,day_finish)
       - GREATEST(c.work_starts_at,day_start))/60)
       - COALESCE((
         SELECT SUM(GREATEST(0,EXTRACT(epoch FROM
           LEAST((b->>'endAt')::timestamptz,day_finish)
           - GREATEST((b->>'startAt')::timestamptz,day_start))/60))
         FROM jsonb_array_elements(c.breaks) b
       ),0)
   )),0) INTO day_minutes
   FROM public.office_worktime_review_cases c
   WHERE c.employee_user_id=req.employee_user_id
     AND c.status='APPROVED'
     AND c.work_starts_at<day_finish AND c.work_ends_at>day_start;
   IF day_minutes<360 THEN RETURN false; END IF;
   worked:=worked+day_minutes;
 END LOOP;
 RETURN worked>=1800;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format THEN
 RETURN false;
END;
$flexproof$;
REVOKE ALL ON FUNCTION public.office_lifecycle_flex_evidence_verified(uuid)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

-- Canonical source rows, independently checked immediately before provider claim.
CREATE OR REPLACE FUNCTION public.office_lifecycle_scheduled_proof_valid(
 p public.office_lifecycle_scheduled_proofs
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $proof$
DECLARE local_day date:=(p.created_at AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 IF p.event_code='TIME-07' THEN
   RETURN EXISTS (
     SELECT 1 FROM public.office_flex_day_requests request
     WHERE request.id=p.source_uuid
       AND request.employee_user_id=p.recipient_user_id
       AND request.earned_week_monday<=local_day
       AND public.office_lifecycle_flex_evidence_verified(request.id)
   );
 ELSIF p.event_code='DEV-02' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_training_assignments a
     WHERE a.id=p.source_uuid AND a.status IN ('ASSIGNED','IN_PROGRESS')
       AND a.due_on BETWEEN local_day AND local_day+2
       AND (
         a.user_id=p.recipient_user_id
         OR EXISTS(
           SELECT 1 FROM public.office_job_assignments job
           WHERE job.user_id=a.user_id
             AND job.reports_to_user_id=p.recipient_user_id
             AND job.status='ACTIVE'
             AND job.start_date<=local_day
             AND (job.end_date IS NULL OR job.end_date>=local_day)
         )
       )
   );
 ELSIF p.event_code IN ('ONB-11','ONB-12') THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_employment_registry e
     WHERE e.employment_id=p.source_uuid
       AND e.status='ACTIVE' AND e.relationship_type='EMPLOYEE'
       AND e.start_date IS NOT NULL
       AND e.end_date IS NULL
       AND e.start_date+(CASE WHEN p.event_code='ONB-11' THEN 7 ELSE 30 END)=local_day
       AND (
         e.identity_user_id=p.recipient_user_id
         OR EXISTS(
           SELECT 1 FROM public.office_job_assignments job
           WHERE job.user_id=e.identity_user_id
             AND job.reports_to_user_id=p.recipient_user_id
             AND job.status='ACTIVE'
             AND job.start_date<=local_day
             AND (job.end_date IS NULL OR job.end_date>=local_day)
         )
       )
   );
 ELSIF p.event_code='PAY-10' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_payroll_results result
     JOIN public.office_payroll_periods period ON period.id=result.period_id
     WHERE result.id=p.source_uuid AND result.status='LOCKED'
       AND result.net_pay_minor>0
       AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
       AND period.pay_date=local_day-1
       AND nullif(pg_catalog.btrim(period.period_code),'') IS NOT NULL
       AND (
         result.employee_user_id=p.recipient_user_id
         OR EXISTS(
           SELECT 1 FROM public.office_department_ownership owner
           JOIN public.office_identity_users reviewer ON reviewer.user_id=owner.owner_user_id
           WHERE owner.department_code='FINANCE'
             AND owner.owner_user_id=p.recipient_user_id
             AND reviewer.status='ACTIVE'
             AND reviewer.user_id IS DISTINCT FROM result.employee_user_id
             AND public.office_effective_permission(
               reviewer.user_id,'payroll.run.review','COMPANY',NULL,NULL)
         )
       )
       AND (SELECT COALESCE(SUM(evidence.amount_minor),0)
            FROM public.office_salary_settlement_evidence evidence
            WHERE evidence.payroll_result_id=result.id
              AND evidence.status='VERIFIED'
              AND evidence.verified_by IS NOT NULL
              AND evidence.verified_at IS NOT NULL
              AND evidence.verified_by IS DISTINCT FROM evidence.submitted_by)
           <result.net_pay_minor
   );
 END IF;
 RETURN false;
END;
$proof$;
REVOKE ALL ON FUNCTION public.office_lifecycle_scheduled_proof_valid(public.office_lifecycle_scheduled_proofs)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

-- The Flex Day request function only inserts after an independent five-day
-- evidence check. The source proof is still revalidated by the claim function.
CREATE OR REPLACE FUNCTION public.office_lifecycle_flex_eligibility_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $flex$
DECLARE source_id bigint;
BEGIN
 IF NEW.status NOT IN ('PENDING','APPROVED')
    OR NEW.qualifying_work_minutes<1800
    OR NEW.requested_by IS DISTINCT FROM NEW.employee_user_id
    OR NOT public.office_lifecycle_flex_evidence_verified(NEW.id)
    OR NOT EXISTS(
      SELECT 1 FROM public.office_lifecycle_mail_policy policy
      WHERE policy.event_code='TIME-07'
        AND policy.enabled AND policy.source_ready
        AND policy.effective_from<=pg_catalog.now()
    ) THEN RETURN NEW; END IF;
 INSERT INTO public.office_lifecycle_scheduled_proofs(event_code,source_uuid,recipient_user_id)
 VALUES('TIME-07',NEW.id,NEW.employee_user_id)
 ON CONFLICT(event_code,source_uuid,recipient_user_id) DO NOTHING
 RETURNING id INTO source_id;
 IF source_id IS NOT NULL THEN
   PERFORM public.office_lifecycle_mail_enqueue(
     'TIME-07','office_lifecycle_scheduled_proofs',source_id,NEW.employee_user_id
   );
 END IF;
 RETURN NEW;
END;
$flex$;
REVOKE ALL ON FUNCTION public.office_lifecycle_flex_eligibility_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_lifecycle_mail_on_flex_eligibility
 AFTER INSERT ON public.office_flex_day_requests
 FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_flex_eligibility_source();


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
  IF v_code='AUTH-10' THEN
    -- Only actual temporary lockouts, not arbitrary failed sign-ins,
    -- and no more than one lock alert per account in six hours.
    IF (NEW.metadata_json::jsonb->>'reason')<>'temporary_lock'
       OR NOT EXISTS(
         SELECT 1 FROM public.office_auth_users current_account
         WHERE current_account.id=NEW.user_id
           AND current_account.locked_until>NEW.created_at
       )
       OR EXISTS(
         SELECT 1 FROM public.office_lifecycle_auth_signals prior
         WHERE prior.recipient_user_id=v_recipient
           AND prior.event_code='AUTH-10'
           AND prior.created_at>pg_catalog.now()-interval '6 hours'
       ) THEN RETURN NEW; END IF;
  END IF;
  -- The evidence row may flush before the device-approval UPDATE in the
  -- same first-party transaction. Record the immutable event atomically now,
  -- and verify the committed, independently approved decision when the
  -- private worker claims the message (the claim function retains that check).
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
-- Scheduler uses only current IST dates and committed source rows. No backfill.
-- It cannot be invoked by browsers or the Supabase service role.
CREATE OR REPLACE FUNCTION public.office_lifecycle_schedule_due(p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $schedule$
DECLARE
 v_day date:=(pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_item record;
 v_id bigint;
 v_count integer:=0;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN
   RAISE EXCEPTION 'Invalid bounded lifecycle scheduling batch';
 END IF;
 FOR v_item IN
  WITH due AS (
    SELECT 'DEV-02'::text event_code,a.id source_uuid,a.user_id recipient
    FROM public.office_training_assignments a
    WHERE a.status IN ('ASSIGNED','IN_PROGRESS')
      AND a.due_on BETWEEN v_day AND v_day+2
    UNION ALL
    SELECT 'DEV-02',a.id,job.reports_to_user_id
    FROM public.office_training_assignments a
    JOIN public.office_job_assignments job ON job.user_id=a.user_id
      AND job.status='ACTIVE' AND job.reports_to_user_id IS NOT NULL
      AND job.reports_to_user_id IS DISTINCT FROM a.user_id
      AND job.start_date<=v_day
      AND (job.end_date IS NULL OR job.end_date>=v_day)
    WHERE a.status IN ('ASSIGNED','IN_PROGRESS')
      AND a.due_on BETWEEN v_day AND v_day+2
    UNION ALL
    SELECT CASE WHEN e.start_date+7=v_day THEN 'ONB-11' ELSE 'ONB-12' END,
      e.employment_id,e.identity_user_id
    FROM public.office_employment_registry e
    WHERE e.status='ACTIVE' AND e.relationship_type='EMPLOYEE'
      AND e.end_date IS NULL AND e.start_date IS NOT NULL
      AND e.start_date+7=v_day OR (
        e.status='ACTIVE' AND e.relationship_type='EMPLOYEE'
        AND e.end_date IS NULL AND e.start_date+30=v_day
      )
    UNION ALL
    SELECT CASE WHEN e.start_date+7=v_day THEN 'ONB-11' ELSE 'ONB-12' END,
      e.employment_id,job.reports_to_user_id
    FROM public.office_employment_registry e
    JOIN public.office_job_assignments job ON job.user_id=e.identity_user_id
      AND job.status='ACTIVE'
      AND job.reports_to_user_id IS NOT NULL
      AND job.reports_to_user_id IS DISTINCT FROM e.identity_user_id
      AND job.start_date<=v_day AND (job.end_date IS NULL OR job.end_date>=v_day)
    WHERE e.status='ACTIVE' AND e.relationship_type='EMPLOYEE'
      AND e.end_date IS NULL AND e.start_date IS NOT NULL
      AND e.start_date+7=v_day OR (
        e.status='ACTIVE' AND e.relationship_type='EMPLOYEE'
        AND e.end_date IS NULL AND e.start_date+30=v_day
      )
    UNION ALL
    SELECT 'PAY-10',result.id,result.employee_user_id
    FROM public.office_payroll_results result
    JOIN public.office_payroll_periods period ON period.id=result.period_id
    WHERE result.status='LOCKED' AND result.net_pay_minor>0
      AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
      AND period.pay_date=v_day-1
      AND (SELECT COALESCE(SUM(ev.amount_minor),0)
           FROM public.office_salary_settlement_evidence ev
           WHERE ev.payroll_result_id=result.id
             AND ev.status='VERIFIED'
             AND ev.verified_by IS NOT NULL AND ev.verified_at IS NOT NULL
             AND ev.verified_by IS DISTINCT FROM ev.submitted_by)<result.net_pay_minor
    UNION ALL
    SELECT 'PAY-10',result.id,owner.owner_user_id
    FROM public.office_payroll_results result
    JOIN public.office_payroll_periods period ON period.id=result.period_id
    JOIN public.office_department_ownership owner ON owner.department_code='FINANCE'
    WHERE result.status='LOCKED' AND result.net_pay_minor>0
      AND period.status IN ('APPROVED','PAYMENT_PREPARED','CLOSED')
      AND period.pay_date=v_day-1
      AND owner.owner_user_id IS DISTINCT FROM result.employee_user_id
      AND public.office_effective_permission(
        owner.owner_user_id,'payroll.run.review','COMPANY',NULL,NULL)
      AND (SELECT COALESCE(SUM(ev.amount_minor),0)
           FROM public.office_salary_settlement_evidence ev
           WHERE ev.payroll_result_id=result.id
             AND ev.status='VERIFIED'
             AND ev.verified_by IS NOT NULL AND ev.verified_at IS NOT NULL
             AND ev.verified_by IS DISTINCT FROM ev.submitted_by)<result.net_pay_minor
  )
  SELECT due.event_code,due.source_uuid,due.recipient
  FROM due
  JOIN public.office_lifecycle_mail_policy policy
    ON policy.event_code=due.event_code
    AND policy.enabled AND policy.source_ready
    AND policy.effective_from<=pg_catalog.now()
  JOIN public.office_identity_users identity
    ON identity.user_id=due.recipient AND identity.status='ACTIVE'
  JOIN public.office_auth_users account
    ON account.id=identity.user_id::text
    AND account.status='ACTIVE'
    AND pg_catalog.lower(account.email) LIKE '%@kraviaprivatelimited.com'
  WHERE due.source_uuid IS NOT NULL AND due.recipient IS NOT NULL
  ORDER BY due.event_code,due.source_uuid,due.recipient
  LIMIT p_limit
 LOOP
   v_id:=NULL;
   INSERT INTO public.office_lifecycle_scheduled_proofs(
     event_code,source_uuid,recipient_user_id
   ) VALUES(v_item.event_code,v_item.source_uuid,v_item.recipient)
   ON CONFLICT(event_code,source_uuid,recipient_user_id) DO NOTHING
   RETURNING id INTO v_id;
   IF v_id IS NOT NULL THEN
     IF public.office_lifecycle_mail_enqueue(
       v_item.event_code,'office_lifecycle_scheduled_proofs',v_id,v_item.recipient
     ) THEN v_count:=v_count+1; END IF;
   END IF;
 END LOOP;
 RETURN v_count;
END;
$schedule$;
REVOKE ALL ON FUNCTION public.office_lifecycle_schedule_due(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_schedule_due(integer)
 TO kravia_office_backend;


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
        OR (o.source_table='office_lifecycle_scheduled_proofs'
          AND EXISTS(
            SELECT 1 FROM public.office_lifecycle_scheduled_proofs proof
            WHERE proof.id=o.source_id
              AND proof.recipient_user_id=o.recipient_user_id
              AND proof.event_code=o.event_code
              AND public.office_lifecycle_scheduled_proof_valid(proof)
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
    CASE WHEN c.event_code='PAY-06' THEN (
      SELECT period.period_code FROM public.office_payroll_events ev
        JOIN public.office_salary_payslip_issues issue
          ON issue.id::text=ev.metadata->>'payslip_issue_id'
        JOIN public.office_payroll_results result ON result.id=issue.payroll_result_id
        JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE ev.id=c.source_id AND ev.event_type='PAYSLIP_ISSUED' LIMIT 1
    )
    WHEN c.event_code='PAY-10' THEN (
      SELECT period.period_code
      FROM public.office_lifecycle_scheduled_proofs proof
      JOIN public.office_payroll_results result ON result.id=proof.source_uuid
      JOIN public.office_payroll_periods period ON period.id=result.period_id
      WHERE proof.id=c.source_id AND proof.event_code='PAY-10'
      LIMIT 1
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

REVOKE ALL ON FUNCTION public.office_lifecycle_auth_v2_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_claim(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_mail_claim(integer)
 TO kravia_office_backend;
DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>49
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox)
    OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='office_lifecycle_mail_on_auth_v2' AND NOT tgisinternal) THEN
  RAISE EXCEPTION 'Expected 49 grounded source policies, zero enabled messages and preserved auth event trigger';
 END IF;
END;
$postcheck$;
