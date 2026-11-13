-- KRAVIA Office forward-only production schema reconciliation.
-- The original 202611130022 migration has already been recorded and MUST NOT
-- be rerun as a historical migration. This delta mirrors the vetted source
-- procedures from the current canonical migration in a new version.
-- It does NOT send emails, enable routes, backfill notifications or retry
-- provider-unknown outcomes. Existing approvals/employee records are preserved.
-- Trigger and function changes are atomic. A mismatch aborts the entire migration.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81 THEN
   RAISE EXCEPTION 'Lifecycle catalog does not contain the reviewed 81 event IDs';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
   RAISE EXCEPTION 'Explicit live owner-approved mail policies detected: manual reconciliation required';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Outstanding lifecycle mail ledger requires manual reconciliation before schema upgrade';
 END IF;
END;
$preflight$;

-- The initial production catalog forbids two newly grounded source kinds.
-- Retain every legacy source type and add only the vetted audit/decision kinds.
ALTER TABLE public.office_lifecycle_mail_outbox
 DROP CONSTRAINT office_lifecycle_mail_outbox_source_table_check,
 ADD CONSTRAINT office_lifecycle_mail_outbox_source_table_check
 CHECK (source_table IN (
   'office_employee_intake_events','office_role_package_events',
   'office_worktime_events','office_department_transfer_events','office_auth_events',
   'office_people_development_events','office_payroll_events','office_task_events',
   'office_access_audit','office_lifecycle_mail_decision_events'
 ));

-- Only canonical, source-verified routes are marked ready.
-- Every delivery toggle remains disabled; the Owner must independently approve
-- any subsequent activation on a later effective date.
WITH vetted(code) AS (
 VALUES
    ('AUTH-11'),
    ('ONB-02'),
    ('ONB-05'),
    ('ONB-09'),
    ('ROLE-01'),
    ('ROLE-02'),
    ('ROLE-04'),
    ('ROLE-05'),
    ('ROLE-06'),
    ('ROLE-08'),
    ('ROLE-09'),
    ('TIME-01'),
    ('TIME-03'),
    ('TIME-04'),
    ('TIME-08'),
    ('PAY-02'),
    ('PAY-03'),
    ('PAY-05'),
    ('PAY-06'),
    ('PAY-07'),
    ('PAY-08'),
    ('DEV-01'),
    ('DEV-03'),
    ('DEV-04'),
    ('DEV-05'),
    ('DEV-06'),
    ('DEV-07')
)
UPDATE public.office_lifecycle_mail_policy p
 SET source_ready=true
 FROM vetted v WHERE p.event_code=v.code AND p.source_ready=false;

CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_policy_set(
  p_actor uuid,p_event text,p_enabled boolean,p_effective_from timestamptz,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $set_policy$
DECLARE v_ready boolean;
BEGIN
  IF p_actor IS NULL OR p_enabled IS NULL OR length(pg_catalog.btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 500 THEN
    RAISE EXCEPTION 'Recorded corporate lifecycle policy approval is required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.office_identity_users u
      JOIN public.office_user_roles r ON r.user_id=u.user_id
    WHERE u.user_id=p_actor AND u.status='ACTIVE' AND r.role='OWNER'
      AND (r.expires_at IS NULL OR r.expires_at>pg_catalog.now())
  ) THEN RAISE EXCEPTION 'Active Owner authority required'; END IF;
  SELECT source_ready INTO v_ready FROM public.office_lifecycle_mail_policy
    WHERE event_code=p_event FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown lifecycle event'; END IF;
  IF p_enabled AND NOT v_ready THEN
    RAISE EXCEPTION 'This lifecycle event lacks a verified canonical source';
  END IF;
  IF p_enabled AND (p_effective_from IS NULL OR p_effective_from>pg_catalog.now()
      OR p_effective_from<pg_catalog.now()-interval '1 minute') THEN
    RAISE EXCEPTION 'A newly effective approved start is required';
  END IF;
  UPDATE public.office_lifecycle_mail_policy
    SET enabled=p_enabled,approved_by=p_actor,approved_at=pg_catalog.now(),
      effective_from=CASE WHEN p_enabled THEN p_effective_from ELSE NULL END
    WHERE event_code=p_event;
  INSERT INTO public.office_lifecycle_mail_policy_history(event_code,enabled,approved_by,effective_from,reason)
    VALUES(p_event,p_enabled,p_actor,CASE WHEN p_enabled THEN p_effective_from ELSE NULL END,
      pg_catalog.btrim(p_reason));
  RETURN true;
END;
$set_policy$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_policy_set(uuid,text,boolean,timestamptz,text)
  FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_mail_policy_set(uuid,text,boolean,timestamptz,text)
  TO service_role;

-- Trigger-only publishing boundary: backend API and client roles cannot forge
-- lifecycle email rows. The actual source audit must be committed alongside it.
CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_enqueue(
  p_code text,p_table text,p_source bigint,p_target uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $enqueue$
BEGIN
  IF p_source IS NULL OR p_source<=0 OR p_target IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.office_lifecycle_mail_policy
    WHERE event_code=p_code AND source_ready AND enabled
      AND effective_from IS NOT NULL AND effective_from<=pg_catalog.now()
  ) THEN RETURN false; END IF;
  INSERT INTO public.office_lifecycle_mail_outbox(event_code,source_table,source_id,recipient_user_id)
    VALUES(p_code,p_table,p_source,p_target)
    ON CONFLICT(event_code,source_table,source_id,recipient_user_id) DO NOTHING;
  RETURN true;
END;
$enqueue$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_enqueue(text,text,bigint,uuid)
  FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
-- Dedicated immutable source evidence for effective-dated workforce decisions.
-- This is populated ONLY by verified table triggers, not by web requests.
CREATE TABLE IF NOT EXISTS public.office_lifecycle_mail_decision_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_kind text NOT NULL CHECK(source_kind IN ('WORKTIME_POLICY','FLEX_DAY')),
  source_uuid uuid NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  result_status text NOT NULL CHECK(result_status IN ('APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE(source_kind,source_uuid,result_status)
);
ALTER TABLE public.office_lifecycle_mail_decision_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_mail_decision_events
  FROM PUBLIC,anon,authenticated,kravia_office_backend,service_role;
GRANT SELECT ON public.office_lifecycle_mail_decision_events TO service_role;

CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_decision_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $decision$
DECLARE v_id bigint;
BEGIN
  IF TG_TABLE_NAME='office_worktime_policy_versions' THEN
    IF NEW.status='APPROVED' AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.approved_by IS NOT NULL AND NEW.approved_at IS NOT NULL
       AND NEW.approved_by IS DISTINCT FROM NEW.employee_user_id
       AND NEW.approved_by IS DISTINCT FROM NEW.proposed_by
       AND nullif(pg_catalog.btrim(NEW.authority_reference),'') IS NOT NULL THEN
      INSERT INTO public.office_lifecycle_mail_decision_events
        (source_kind,source_uuid,recipient_user_id,result_status)
      VALUES('WORKTIME_POLICY',NEW.id,NEW.employee_user_id,'APPROVED')
      ON CONFLICT(source_kind,source_uuid,result_status) DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue(
          'TIME-01','office_lifecycle_mail_decision_events',v_id,NEW.employee_user_id);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME='office_flex_day_requests' THEN
    IF NEW.status IN ('APPROVED','REJECTED')
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.reviewed_by IS NOT NULL AND NEW.reviewed_at IS NOT NULL
       AND NEW.reviewed_by IS DISTINCT FROM NEW.employee_user_id
       AND NEW.reviewed_by IS DISTINCT FROM NEW.requested_by THEN
      INSERT INTO public.office_lifecycle_mail_decision_events
        (source_kind,source_uuid,recipient_user_id,result_status)
      VALUES('FLEX_DAY',NEW.id,NEW.employee_user_id,NEW.status)
      ON CONFLICT(source_kind,source_uuid,result_status) DO NOTHING
      RETURNING id INTO v_id;
      IF v_id IS NOT NULL THEN
        PERFORM public.office_lifecycle_mail_enqueue(
          'TIME-08','office_lifecycle_mail_decision_events',v_id,NEW.employee_user_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$decision$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_decision_source()
  FROM PUBLIC,anon,authenticated,kravia_office_backend,service_role;
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_policy_approval
  ON public.office_worktime_policy_versions;
CREATE TRIGGER office_lifecycle_mail_on_policy_approval
  AFTER UPDATE OF status ON public.office_worktime_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_decision_source();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_flex_decision
  ON public.office_flex_day_requests;
CREATE TRIGGER office_lifecycle_mail_on_flex_decision
  AFTER UPDATE OF status ON public.office_flex_day_requests
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_decision_source();

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
    ELSIF NEW.event_type='TASK_RETURNED' AND NEW.target_user_id IS NOT NULL THEN
      PERFORM public.office_lifecycle_mail_enqueue('ONB-05',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
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

DROP TRIGGER IF EXISTS office_lifecycle_mail_on_intake ON public.office_employee_intake_events;
CREATE TRIGGER office_lifecycle_mail_on_intake AFTER INSERT ON public.office_employee_intake_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_role_package ON public.office_role_package_events;
CREATE TRIGGER office_lifecycle_mail_on_role_package AFTER INSERT ON public.office_role_package_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_worktime ON public.office_worktime_events;
CREATE TRIGGER office_lifecycle_mail_on_worktime AFTER INSERT ON public.office_worktime_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_department_transfer ON public.office_department_transfer_events;
CREATE TRIGGER office_lifecycle_mail_on_department_transfer AFTER INSERT ON public.office_department_transfer_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_auth ON public.office_auth_events;
CREATE TRIGGER office_lifecycle_mail_on_auth AFTER INSERT ON public.office_auth_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();

DROP TRIGGER IF EXISTS office_lifecycle_mail_on_development ON public.office_people_development_events;
CREATE TRIGGER office_lifecycle_mail_on_development AFTER INSERT ON public.office_people_development_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_payroll ON public.office_payroll_events;
CREATE TRIGGER office_lifecycle_mail_on_payroll AFTER INSERT ON public.office_payroll_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_task ON public.office_task_events;
CREATE TRIGGER office_lifecycle_mail_on_task AFTER INSERT ON public.office_task_events
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_access_audit ON public.office_access_audit;
CREATE TRIGGER office_lifecycle_mail_on_access_audit AFTER INSERT ON public.office_access_audit
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_source_trigger();

-- A payslip is eligible only once its immutable issue is actually inserted.
-- This trigger writes a canonical audit event only while its specific Owner
-- policy is enabled; it never sends a mail itself or marks wages as paid.
CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_payslip_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $issue$
BEGIN
  IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy
    WHERE event_code='PAY-06' AND source_ready AND enabled AND
      effective_from IS NOT NULL AND effective_from<=pg_catalog.now()) THEN
    INSERT INTO public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata)
      SELECT NEW.issued_by,r.period_id,r.employment_id,'PAYSLIP_ISSUED',
        pg_catalog.jsonb_build_object('payslip_issue_id',NEW.id)
      FROM public.office_payroll_results r
      JOIN public.office_payroll_periods p ON p.id=r.period_id
      WHERE r.id=NEW.payroll_result_id AND r.employee_user_id=NEW.employee_user_id
        AND r.status='LOCKED' AND p.status IN ('APPROVED','PAYMENT_PREPARED')
        AND NEW.issued_at IS NOT NULL AND NEW.snapshot_sha256 IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$issue$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_payslip_source()
  FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_payslip ON public.office_salary_payslip_issues;
CREATE TRIGGER office_lifecycle_mail_on_payslip AFTER INSERT ON public.office_salary_payslip_issues
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_payslip_source();

-- The separate approved bank settlement transition creates a verifiable
-- payroll audit event. Never classify a prepared batch as a bank credit.
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
  END IF;
  RETURN NEW;
END;
$settled$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_bank_settlement_source()
  FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
DROP TRIGGER IF EXISTS office_lifecycle_mail_on_bank_credit
  ON public.office_salary_settlement_evidence;
CREATE TRIGGER office_lifecycle_mail_on_bank_credit
  AFTER UPDATE OF status ON public.office_salary_settlement_evidence
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_mail_bank_settlement_source();
-- Replacing the 6-column legacy return type with the 7-column source-bound
-- claim result requires DROP + CREATE, not CREATE OR REPLACE.
-- RESTRICT (the default) deliberately aborts if unexpected dependencies exist.
DROP FUNCTION public.office_lifecycle_mail_claim(integer);

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
              AND o.event_code='ONB-05'
              AND ev.event_type IN ('PROFILE_SUBMITTED','PROFILE_RETURNED')))
        OR (o.source_table='office_role_package_events'
          AND EXISTS(SELECT 1 FROM public.office_role_package_events ev
            WHERE ev.id=o.source_id AND ev.target_user_id=o.recipient_user_id
              AND ((o.event_code IN ('ONB-09','ROLE-01','ROLE-09')
                     AND ev.event_type='PACKAGE_APPLIED')
                OR (o.event_code='ONB-02' AND ev.event_type='PACKAGE_APPLIED'
                  AND EXISTS(SELECT 1 FROM public.office_role_package_onboarding_tasks task
                    WHERE task.application_id=ev.application_id
                      AND task.employee_user_id=ev.target_user_id AND task.required))
                OR (o.event_code='ONB-05' AND ev.event_type='TASK_RETURNED'))))
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
CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_finish(
  p_outbox uuid,p_claim uuid,p_outcome text,p_message_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $finish$
BEGIN
  IF p_outbox IS NULL OR p_claim IS NULL OR p_outcome NOT IN ('SENT','REJECTED','UNKNOWN') THEN
    RAISE EXCEPTION 'Invalid lifecycle delivery completion';
  END IF;
  UPDATE public.office_lifecycle_mail_outbox o
    SET status=p_outcome,provider_message_id=CASE WHEN p_outcome='SENT'
          THEN pg_catalog.left(p_message_id,320) ELSE NULL END,
        submitted_at=CASE WHEN p_outcome='SENT' THEN pg_catalog.now() ELSE NULL END,
        finalized_at=pg_catalog.now()
  WHERE o.id=p_outbox AND o.status='SENDING' AND o.claim_token=p_claim;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle mail claim already finalised or expired'; END IF;
  INSERT INTO public.office_lifecycle_mail_events(outbox_id,event_type)
    VALUES(p_outbox,CASE WHEN p_outcome='SENT' THEN 'ACCEPTED' ELSE p_outcome END);
  RETURN true;
END;
$finish$;
REVOKE ALL ON FUNCTION public.office_lifecycle_mail_claim(integer),
  public.office_lifecycle_mail_finish(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_lifecycle_mail_claim(integer),
  public.office_lifecycle_mail_finish(uuid,uuid,text,text)
  TO kravia_office_backend;
-- Validate strictly bounded permissions and zero activation in this release.
DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>27 THEN
   RAISE EXCEPTION 'Expected exactly 27 independently source-backed lifecycle routes';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Upgrade must not activate or queue mail';
 END IF;
 IF pg_catalog.has_function_privilege('anon','public.office_lifecycle_mail_claim(integer)','EXECUTE')
   OR pg_catalog.has_function_privilege('authenticated','public.office_lifecycle_mail_claim(integer)','EXECUTE')
   OR pg_catalog.has_function_privilege('service_role','public.office_lifecycle_mail_claim(integer)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('kravia_office_backend','public.office_lifecycle_mail_claim(integer)','EXECUTE') THEN
   RAISE EXCEPTION 'Lifecycle claim execution must remain backend-only';
 END IF;
END;
$postcheck$;
