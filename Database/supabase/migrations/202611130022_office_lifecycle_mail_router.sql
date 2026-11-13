-- KRAVIA Office 81-event lifecycle router, independent of existing security mail.
-- Applying this migration sends NO emails. No policy or event is enabled by seed.
-- All browser roles are excluded. Only new, verified domain audit events may
-- enter the outbox once the current corporate Owner has approved each route.

CREATE TABLE IF NOT EXISTS public.office_lifecycle_mail_policy (
  event_code text PRIMARY KEY CHECK (event_code ~ '^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-[0-9]{2}$'),
  priority text NOT NULL CHECK (priority IN ('P0','P1','P2')),
  source_ready boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  effective_from timestamptz,
  CHECK (NOT enabled OR (source_ready AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND effective_from IS NOT NULL))
);
INSERT INTO public.office_lifecycle_mail_policy(event_code,priority,source_ready)
VALUES
  ('AUTH-01','P0',false),
  ('AUTH-02','P1',false),
  ('AUTH-03','P1',false),
  ('AUTH-04','P0',false),
  ('AUTH-05','P0',false),
  ('AUTH-06','P0',false),
  ('AUTH-07','P1',false),
  ('AUTH-08','P0',false),
  ('AUTH-09','P0',false),
  ('AUTH-10','P1',false),
  ('AUTH-11','P0',true),
  ('AUTH-12','P1',false),
  ('HIRE-01','P1',false),
  ('HIRE-02','P1',false),
  ('HIRE-03','P1',false),
  ('HIRE-04','P1',false),
  ('HIRE-05','P0',false),
  ('HIRE-06','P1',false),
  ('HIRE-07','P0',false),
  ('HIRE-08','P0',false),
  ('HIRE-09','P0',false),
  ('HIRE-10','P1',false),
  ('ONB-01','P0',false),
  ('ONB-02','P0',false),
  ('ONB-03','P0',false),
  ('ONB-04','P0',false),
  ('ONB-05','P0',true),
  ('ONB-06','P0',false),
  ('ONB-07','P1',false),
  ('ONB-08','P0',false),
  ('ONB-09','P0',true),
  ('ONB-10','P0',false),
  ('ONB-11','P2',false),
  ('ONB-12','P2',false),
  ('ROLE-01','P0',true),
  ('ROLE-02','P0',false),
  ('ROLE-03','P1',false),
  ('ROLE-04','P1',true),
  ('ROLE-05','P0',true),
  ('ROLE-06','P1',true),
  ('ROLE-07','P1',false),
  ('ROLE-08','P1',false),
  ('ROLE-09','P1',true),
  ('TIME-01','P1',false),
  ('TIME-02','P2',false),
  ('TIME-03','P1',false),
  ('TIME-04','P1',true),
  ('TIME-05','P1',false),
  ('TIME-06','P1',false),
  ('TIME-07','P1',false),
  ('TIME-08','P1',false),
  ('TIME-09','P1',false),
  ('TIME-10','P1',false),
  ('PAY-01','P0',false),
  ('PAY-02','P0',false),
  ('PAY-03','P1',false),
  ('PAY-04','P0',false),
  ('PAY-05','P0',false),
  ('PAY-06','P0',false),
  ('PAY-07','P1',false),
  ('PAY-08','P0',false),
  ('PAY-09','P0',false),
  ('PAY-10','P0',false),
  ('PAY-11','P1',false),
  ('PAY-12','P2',false),
  ('DEV-01','P1',false),
  ('DEV-02','P2',false),
  ('DEV-03','P2',false),
  ('DEV-04','P2',false),
  ('DEV-05','P2',false),
  ('DEV-06','P2',false),
  ('DEV-07','P1',false),
  ('DEV-08','P1',false),
  ('EXIT-01','P1',false),
  ('EXIT-02','P1',false),
  ('EXIT-03','P1',false),
  ('EXIT-04','P0',false),
  ('EXIT-05','P1',false),
  ('EXIT-06','P1',false),
  ('EXIT-07','P1',false),
  ('EXIT-08','P2',false)
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
    'office_worktime_events','office_department_transfer_events','office_auth_events'
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

-- Restricted backend claims, following an atomic database commit before
-- provider I/O. An unacknowledged claim is quarantined, never automatically resent.
CREATE OR REPLACE FUNCTION public.office_lifecycle_mail_claim(p_limit integer DEFAULT 10)
RETURNS TABLE(
  outbox_id uuid,claim_token uuid,event_code text,recipient_email text,
  recipient_name text,source_reference text
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
    (c.source_table||':'||c.source_id::text)
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
