-- KRAVIA Office 81-event lifecycle router, independent of existing security mail.
-- Applying this migration sends NO emails. No policy or event is enabled by seed.
-- All browser roles are excluded. Only new, verified domain audit events may
-- enter the outbox once the current corporate Owner has approved each route.

CREATE TABLE IF NOT EXISTS public.office_lifecycle_mail_policy (
  event_code text PRIMARY KEY CHECK (event_code ~ '^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-[0-9]{2}$'),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2')),
  source_ready boolean NOT NULL DEFAULT false,
  intent text NOT NULL,
  subject text NOT NULL,
  trigger_description text NOT NULL,
  recipient_description text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  effective_from timestamptz,
  CHECK (NOT enabled OR (source_ready AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND effective_from IS NOT NULL))
);
INSERT INTO public.office_lifecycle_mail_policy(event_code,priority,source_ready,intent,subject,trigger_description,recipient_description)
VALUES
  ('AUTH-01','P0',false,'Office invitation','You are invited to KRAVIA Office','Approved invite created','Invitee'),
  ('AUTH-02','P1',false,'Invitation reminder','Reminder: Your KRAVIA Office invitation expires soon','Still PENDING near expiry; one opt-in reminder','Invitee'),
  ('AUTH-03','P1',false,'Invitation expired','Your KRAVIA Office invitation has expired','Invite moved to EXPIRED','Invitee and authorised inviter'),
  ('AUTH-04','P0',false,'Registration accepted','Your KRAVIA Office account is registered','Registration completed, identity ACTIVE','Employee'),
  ('AUTH-05','P0',false,'Corporate email sign-in code','Your KRAVIA Office verification code','Password session requests email OTP, eligible account only','Account holder'),
  ('AUTH-06','P0',false,'New device approval','Review a new KRAVIA Office device sign-in','Unrecognised device requires independent decision','Authorised reviewer'),
  ('AUTH-07','P1',false,'Device approved or declined','KRAVIA Office device review update','Review decision recorded','Account holder'),
  ('AUTH-08','P0',false,'Password reset link issued','Reset your KRAVIA Office password','Explicit authorised recovery or verified self-service request','Account holder'),
  ('AUTH-09','P0',false,'Password changed','Your KRAVIA Office password was changed','Confirmed password update','Account holder'),
  ('AUTH-10','P1',false,'Suspicious sign-in or account lock','Security alert for your KRAVIA Office account','Verified security event','Account holder and security reviewer'),
  ('AUTH-11','P0',true,'Sessions revoked / access suspended','KRAVIA Office access status updated','Authorised revocation committed','Affected employee'),
  ('AUTH-12','P1',false,'Authenticator enrollment / factor change','Your KRAVIA Office sign-in protection changed','Verified MFA enrollment or approved factor reset','Account holder'),
  ('HIRE-01','P1',false,'Application received','Application received — KRAVIA','Application recorded by recruitment system','Candidate'),
  ('HIRE-02','P1',false,'Interview scheduled','Interview details — KRAVIA','Interview record scheduled/approved','Candidate and interviewers'),
  ('HIRE-03','P1',false,'Interview rescheduled','Updated interview schedule — KRAVIA','Confirmed revised interview time','Candidate and interviewers'),
  ('HIRE-04','P1',false,'Interview cancelled','Update to your KRAVIA interview','Interview cancellation recorded','Candidate and interviewers'),
  ('HIRE-05','P0',false,'Recruitment documents requested','Document request for your KRAVIA application','Approved document request created','Candidate'),
  ('HIRE-06','P1',false,'Recruitment document needs correction','Action required: Your KRAVIA document','Document reviewer rejects or requests new evidence','Candidate'),
  ('HIRE-07','P0',false,'Offer awaiting director approval','Approval required: KRAVIA offer','Offer enters governed review state','Authorised director/reviewer'),
  ('HIRE-08','P0',false,'Approved offer available','Your KRAVIA offer letter is ready','Approved document signed/published with candidate access','Candidate'),
  ('HIRE-09','P0',false,'Offer accepted','KRAVIA offer acceptance confirmed','Acceptance is actually recorded and verified','Candidate and approved hiring owner'),
  ('HIRE-10','P1',false,'Offer declined, withdrawn or expired','Update on your KRAVIA offer','Canonical status recorded','Candidate as appropriate; hiring owner'),
  ('ONB-01','P0',false,'Welcome aboard','Welcome aboard KRAVIA, {{employee_first_name}}','Active employee identity + accepted employment + director-approved joining','Employee'),
  ('ONB-02','P0',false,'Private onboarding checklist','Your KRAVIA joining checklist','Onboarding workflow starts, assigned tasks exist','Employee'),
  ('ONB-03','P0',false,'Appointment letter ready','Your KRAVIA appointment letter is available','Signed approved appointment document stored','Employee'),
  ('ONB-04','P0',false,'E-sign requested','Signature requested: KRAVIA appointment documents','Document requires signature; permitted signing link issued','Signatory'),
  ('ONB-05','P0',true,'Evidence submitted / returned','KRAVIA onboarding document review update','Checklist evidence reaches reviewer or is returned','Employee or authorised reviewer'),
  ('ONB-06','P0',false,'First-day instructions','Your first day at KRAVIA','Actual joining date and work arrangement confirmed','Employee'),
  ('ONB-07','P1',false,'Equipment and account readiness','Your KRAVIA work setup is ready','Verified device/asset assignment or provisioning change','Employee'),
  ('ONB-08','P0',false,'Policy acknowledgement requested','Please acknowledge your KRAVIA policies','Versioned policy assigned in Office','Employee'),
  ('ONB-09','P0',true,'Assigned responsibilities available','Your KRAVIA roles and responsibilities','Role package actually applied and scoped permissions verified','Employee'),
  ('ONB-10','P0',false,'Onboarding complete','KRAVIA onboarding completed','All required checklist items verified and governance approved','Employee and hiring manager'),
  ('ONB-11','P2',false,'First-week check-in','Your first-week check-in at KRAVIA','7th calendar day after actual joining, if employed','Employee and manager'),
  ('ONB-12','P2',false,'First-month check-in','Your first-month check-in at KRAVIA','30th day after actual joining, if employed','Employee and manager'),
  ('ROLE-01','P0',true,'Position or functional duty assigned','Your KRAVIA responsibilities have been updated','Canonical role package applied / job changed','Employee'),
  ('ROLE-02','P0',true,'Permission granted or revoked','KRAVIA Office access permissions changed','Verified access-profile or scoped permission change','Employee'),
  ('ROLE-03','P1',false,'Reporting line changed','Your reporting structure at KRAVIA','Approved manager mapping changed','Employee, old/new manager where appropriate'),
  ('ROLE-04','P1',true,'Department handover proposed','Department ownership transfer awaiting acceptance','Governed transfer proposal committed','Proposed receiving head'),
  ('ROLE-05','P0',true,'Department handover accepted','Department ownership transfer completed','Receiving head accepts; former owner write rights checked','New head and former head'),
  ('ROLE-06','P1',true,'Transfer rejected or expired','KRAVIA department transfer update','Governed transfer status recorded','Requester and recipient'),
  ('ROLE-07','P1',false,'Privileged access review requested','Access review required — KRAVIA Office','Access-review record created','Independent authorised reviewer'),
  ('ROLE-08','P1',true,'Access review decision','KRAVIA access review decision','Approved or changes-required decision committed','Employee and access owner'),
  ('ROLE-09','P1',true,'Package version assigned','Your KRAVIA role package has been updated','New role-package version applied to employee','Employee'),
  ('TIME-01','P1',false,'Work schedule assigned or revised','Your KRAVIA work schedule','Approved work schedule/version effective','Employee'),
  ('TIME-02','P2',false,'Missing attendance reminder','Please review your KRAVIA attendance','Scheduled reminder; no approved/open check-in by cutoff','Employee'),
  ('TIME-03','P1',false,'Attendance correction submitted','Attendance correction awaiting review','Verified correction awaiting separate reviewer','Independent authorised reviewer'),
  ('TIME-04','P1',true,'Attendance correction decision','Your attendance correction was reviewed','Approved or rejected correction committed','Employee'),
  ('TIME-05','P1',false,'Overtime review requested','Overtime request awaiting review','Weekday/weekend/night extra work evidence submitted','Independent authorised reviewer'),
  ('TIME-06','P1',false,'Overtime approved / rejected','Your KRAVIA overtime request was reviewed','Recorded reviewer decision, approved policy in force','Employee'),
  ('TIME-07','P1',false,'Flex Day eligible','Your KRAVIA Flex Day eligibility','Five distinct approved six-hour weekdays, approved Flex policy','Employee'),
  ('TIME-08','P1',false,'Flex Day request decision','Your KRAVIA Flex Day request update','Independent decision committed','Employee'),
  ('TIME-09','P1',false,'Leave request / decision','KRAVIA leave request update','Real request or reviewer decision recorded','Approver or employee'),
  ('TIME-10','P1',false,'Payroll attendance cutoff','Attendance review closes soon','Upcoming verified period cutoff','Employee and permitted approver'),
  ('PAY-01','P0',false,'Compensation draft for review','Compensation proposal requires approval','Effective-dated compensation proposal submitted','Independent reviewer/director'),
  ('PAY-02','P0',true,'Compensation approved / rejected','Your KRAVIA compensation record was updated','Governed final decision committed','Affected employee'),
  ('PAY-03','P1',false,'Payroll period opened','KRAVIA payroll period is open','Actual period created','Finance preparer'),
  ('PAY-04','P0',false,'Payroll review required','KRAVIA payroll approval required','Locked review request sent to independent approver','Payroll reviewer/director'),
  ('PAY-05','P0',false,'Payroll approved','KRAVIA payroll run approved','All required approvals completed and results locked','Finance preparer'),
  ('PAY-06','P0',true,'Salary slip issued','Your KRAVIA payslip for {{pay_period}} is ready','Immutable approved payroll payslip exists','Employee'),
  ('PAY-07','P1',false,'Payment batch prepared','KRAVIA salary batch prepared — not yet paid','Batch only PREPARED; not bank-confirmed','Finance preparer/reviewer'),
  ('PAY-08','P0',false,'Salary credit verified','KRAVIA salary payment confirmed — {{pay_period}}','Independent bank settlement verification covers full net salary','Employee'),
  ('PAY-09','P0',false,'Partial payment / balance outstanding','Important: Outstanding KRAVIA salary balance','Verified credit is less than net; remaining amount owed','Employee and authorised Finance'),
  ('PAY-10','P0',false,'Unpaid salary overdue','Salary payment follow-up for {{pay_period}}','Pay date passed with independently unverified balance','Employee and escalation approver'),
  ('PAY-11','P1',false,'Corrected payslip issued','Updated KRAVIA payslip available','New approved correction/adjustment and new immutable issue','Employee'),
  ('PAY-12','P2',false,'Annual wage or statutory statement ready','Your annual KRAVIA payroll statement is available','Approved statement exists in private Office vault','Employee'),
  ('DEV-01','P1',true,'Training assigned','Training assigned in KRAVIA Office','Governed training assignment recorded','Employee'),
  ('DEV-02','P2',false,'Training due reminder','KRAVIA training due soon','Approved due date approaching and incomplete','Employee and assigned lead'),
  ('DEV-03','P2',false,'Training evidence accepted / rejected','Training completion review update','Reviewer records result','Employee'),
  ('DEV-04','P2',true,'Performance review scheduled','Your KRAVIA performance review','Governed review record created','Employee and reviewer'),
  ('DEV-05','P2',true,'Review outcome available','Your KRAVIA development review is ready','Review finalised and released to employee','Employee'),
  ('DEV-06','P2',true,'Development plan assigned','Your KRAVIA development plan','Approved development plan published','Employee'),
  ('DEV-07','P1',true,'Task or approval assigned','Action assigned in KRAVIA Office','Authorised Office request/task assigned','Assignee'),
  ('DEV-08','P1',false,'Controlled policy/document published','KRAVIA policy or document update','Versioned document released to recipient''s scope','Eligible staff'),
  ('EXIT-01','P1',false,'Exit workflow initiated','KRAVIA employee offboarding review','Approved departure/offboarding request started','Authorised director/people reviewer'),
  ('EXIT-02','P1',false,'Exit acknowledged','Your KRAVIA exit process','Confirmed notice and final-day details recorded','Employee'),
  ('EXIT-03','P1',false,'Asset return requested','KRAVIA equipment return checklist','Assets actually registered to employee','Employee'),
  ('EXIT-04','P0',false,'Office access withdrawn','KRAVIA Office access removed','Governed access revocation committed','Employee and Security'),
  ('EXIT-05','P1',false,'Final settlement under review','KRAVIA final settlement under review','Payroll settlement case created','Employee and authorised Finance'),
  ('EXIT-06','P1',false,'Final settlement verified','KRAVIA final settlement confirmed','Independent bank credits fully reconciled','Employee'),
  ('EXIT-07','P1',false,'Relieving/experience document available','Your KRAVIA employment document is ready','Signed, approved document stored','Former employee'),
  ('EXIT-08','P2',false,'Offboarding completed','KRAVIA exit process completed','People, assets and access steps complete','Employee, authorised director')
ON CONFLICT(event_code) DO NOTHING;
ALTER TABLE public.office_lifecycle_mail_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_mail_policy FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_lifecycle_mail_policy TO service_role;

CREATE TABLE IF NOT EXISTS public.office_lifecycle_mail_policy_history(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_code text NOT NULL REFERENCES public.office_lifecycle_mail_policy(event_code),
  enabled boolean NOT NULL,
  approved_by uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  effective_from timestamptz,
  reason text NOT NULL CHECK(length(reason) BETWEEN 12 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_lifecycle_mail_policy_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_mail_policy_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_lifecycle_mail_policy_history TO service_role;

CREATE TABLE IF NOT EXISTS public.office_lifecycle_mail_outbox(
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  event_code text NOT NULL REFERENCES public.office_lifecycle_mail_policy(event_code),
  source_table text NOT NULL CHECK(source_table IN (
    'office_employee_intake_events','office_role_package_events',
    'office_worktime_events','office_department_transfer_events','office_auth_events',
    'office_people_development_events','office_payroll_events','office_task_events',
    'office_access_audit'
  )),
  source_id bigint NOT NULL CHECK(source_id>0),
  recipient_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','SENDING','SENT','REJECTED','UNKNOWN')),
  claim_token uuid,
  claimed_at timestamptz,
  finalized_at timestamptz,
  provider_message_id text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_lifecycle_mail_outbox_once UNIQUE(event_code,source_table,source_id,recipient_user_id)
);
CREATE INDEX IF NOT EXISTS office_lifecycle_mail_claim_idx
  ON public.office_lifecycle_mail_outbox(status,created_at,id);
ALTER TABLE public.office_lifecycle_mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_mail_outbox FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT SELECT ON public.office_lifecycle_mail_outbox TO service_role;

CREATE TABLE IF NOT EXISTS public.office_lifecycle_mail_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_id uuid NOT NULL REFERENCES public.office_lifecycle_mail_outbox(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN ('CLAIMED','ACCEPTED','REJECTED','UNKNOWN','STALE_UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_lifecycle_mail_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_mail_events FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT SELECT ON public.office_lifecycle_mail_events TO service_role;

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
      PERFORM public.office_lifecycle_mail_enqueue('ONB-09',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-01',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
      PERFORM public.office_lifecycle_mail_enqueue('ROLE-09',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
    ELSIF NEW.event_type='TASK_RETURNED' AND NEW.target_user_id IS NOT NULL THEN
      PERFORM public.office_lifecycle_mail_enqueue('ONB-05',TG_TABLE_NAME,NEW.id,NEW.target_user_id);
    END IF;
  ELSIF TG_TABLE_NAME='office_worktime_events' THEN
    IF NEW.event_type IN ('APPROVED','REJECTED') THEN
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

-- Restricted backend claims, following an atomic database commit before
-- provider I/O. An unacknowledged claim is quarantined, never automatically resent.
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
                OR (o.event_code='ONB-05' AND ev.event_type='TASK_RETURNED'))))
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
    ) ELSE NULL END
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

COMMENT ON TABLE public.office_lifecycle_mail_policy IS
 '81 distinct event codes; only verified, source-ready events are Owner-approvable and all start disabled.';
COMMENT ON TABLE public.office_lifecycle_mail_outbox IS
 'Committed Office source event, authorised recipient and idempotent delivery intent. No documents, bank details or OTP content.';
