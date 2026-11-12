-- KRAVIA Office: worker-claimed employee-ID mail delivery.
-- No messages are dispatched by applying this schema. Delivery stays OFF until
-- an explicit approved, effective-dated activation is recorded.
-- This migration preserves issued identifiers, legacy email state and all
-- existing employee/person/employment relationships.

ALTER TABLE public.office_employee_mail_outbox
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

CREATE TABLE IF NOT EXISTS public.office_employee_mail_delivery_policy (
  key text PRIMARY KEY CHECK (key='EMPLOYEE_ID_ISSUED'),
  enabled boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  approved_at timestamptz,
  effective_from timestamptz,
  CHECK (NOT enabled OR (
    approved_by IS NOT NULL AND approved_at IS NOT NULL AND effective_from IS NOT NULL
  ))
);
INSERT INTO public.office_employee_mail_delivery_policy(key,enabled)
VALUES('EMPLOYEE_ID_ISSUED',false) ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.office_employee_mail_delivery_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_employee_mail_delivery_policy FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_employee_mail_delivery_policy TO service_role;

CREATE TABLE IF NOT EXISTS public.office_employee_mail_delivery_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_id uuid NOT NULL REFERENCES public.office_employee_mail_outbox(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN (
    'CLAIMED','ACCEPTED','UNKNOWN','REJECTED','STALE_CLAIM_UNKNOWN'
  )),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS office_employee_mail_delivery_events_idx
  ON public.office_employee_mail_delivery_events(outbox_id,created_at DESC);
ALTER TABLE public.office_employee_mail_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_employee_mail_delivery_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_employee_mail_delivery_events TO service_role;

-- A corporate OWNER enables the specific event kind only after recording an
-- explicit effective-dated approval. This does not send any prior messages.
CREATE OR REPLACE FUNCTION public.office_employee_mail_policy_set(
  p_actor uuid,p_enabled boolean,p_effective_from timestamptz,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $kravia_policy$
BEGIN
  IF p_actor IS NULL OR length(pg_catalog.btrim(coalesce(p_reason,'')))<12 THEN
    RAISE EXCEPTION 'Documented corporate approval reason required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.office_identity_users u
    JOIN public.office_user_roles r ON r.user_id=u.user_id
    WHERE u.user_id=p_actor AND u.status='ACTIVE'
      AND r.role='OWNER' AND (r.expires_at IS NULL OR r.expires_at>pg_catalog.now())
  ) THEN
    RAISE EXCEPTION 'Current corporate Owner approval required';
  END IF;
  IF p_enabled AND (p_effective_from IS NULL OR p_effective_from>pg_catalog.now()) THEN
    RAISE EXCEPTION 'An effective approved activation time is required';
  END IF;
  UPDATE public.office_employee_mail_delivery_policy
    SET enabled=p_enabled,approved_by=p_actor,approved_at=pg_catalog.now(),
        effective_from=CASE WHEN p_enabled THEN p_effective_from ELSE NULL END
    WHERE key='EMPLOYEE_ID_ISSUED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Corporate delivery policy is missing'; END IF;
  RETURN true;
END;
$kravia_policy$;
REVOKE ALL ON FUNCTION public.office_employee_mail_policy_set(uuid,boolean,timestamptz,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_employee_mail_policy_set(uuid,boolean,timestamptz,text)
  TO service_role;

-- Claim-then-commit before external I/O. A stale SENDING row becomes UNKNOWN,
-- never automatically PENDING, because Brevo may already have accepted it.
CREATE OR REPLACE FUNCTION public.office_employee_mail_claim(p_limit integer DEFAULT 10)
RETURNS TABLE (
  outbox_id uuid,claim_token uuid,recipient_email text,reference_code text,recipient_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $kravia_claim$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Invalid bounded corporate mail batch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.office_employee_mail_delivery_policy
    WHERE key='EMPLOYEE_ID_ISSUED' AND enabled
      AND approved_by IS NOT NULL AND approved_at IS NOT NULL
      AND effective_from<=pg_catalog.now()
  ) THEN RETURN; END IF;

  WITH stale AS (
    UPDATE public.office_employee_mail_outbox o SET
      status='UNKNOWN',finalized_at=pg_catalog.now()
    WHERE o.status='SENDING'
      AND o.claimed_at<pg_catalog.now()-interval '15 minutes'
    RETURNING o.id
  )
  INSERT INTO public.office_employee_mail_delivery_events(outbox_id,event_type)
  SELECT s.id,'STALE_CLAIM_UNKNOWN' FROM stale s;

  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.office_employee_mail_outbox o
    JOIN public.office_employee_reference_ids i
      ON i.employee_user_id=o.employee_user_id AND i.reference_code=o.reference_code
    JOIN public.office_employee_intake_profiles p
      ON p.employee_user_id=o.employee_user_id AND p.status='VERIFIED'
    JOIN public.office_employment_registry e
      ON e.employment_id=i.employment_id AND e.identity_user_id=o.employee_user_id
      AND e.status='ACTIVE' AND e.start_date IS NOT NULL
    JOIN public.office_auth_users a
      ON a.id=o.employee_user_id::text AND a.status='ACTIVE'
      AND pg_catalog.lower(a.email)=pg_catalog.lower(o.recipient_email)
    JOIN public.office_employee_mail_delivery_policy policy
      ON policy.key=o.kind AND policy.enabled
      AND o.created_at>=policy.effective_from
    WHERE o.status='PENDING' AND o.kind='EMPLOYEE_ID_ISSUED'
    ORDER BY o.created_at,o.id
    FOR UPDATE OF o SKIP LOCKED
    LIMIT p_limit
  ), claimed AS (
    UPDATE public.office_employee_mail_outbox o
      SET status='SENDING',
          claim_token=pg_catalog.gen_random_uuid(),claimed_at=pg_catalog.now()
      FROM candidates c WHERE c.id=o.id
      RETURNING o.id,o.claim_token,o.recipient_email,o.reference_code,o.employee_user_id
  ), recorded AS (
    INSERT INTO public.office_employee_mail_delivery_events(outbox_id,event_type)
      SELECT c.id,'CLAIMED' FROM claimed c RETURNING outbox_id
  )
  SELECT c.id,c.claim_token,c.recipient_email,c.reference_code,
    pg_catalog.coalesce(pg_catalog.nullif(pg_catalog.btrim(u.display_name),''),'Colleague')
  FROM claimed c
  JOIN public.office_identity_users u ON u.user_id=c.employee_user_id
  JOIN recorded r ON r.outbox_id=c.id;
END;
$kravia_claim$;

CREATE OR REPLACE FUNCTION public.office_employee_mail_finish(
  p_outbox uuid,p_claim uuid,p_outcome text,p_message_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $kravia_finish$
DECLARE v_status text;
BEGIN
  IF p_outbox IS NULL OR p_claim IS NULL OR
     p_outcome NOT IN ('SENT','UNKNOWN','REJECTED') THEN
    RAISE EXCEPTION 'Invalid corporate mail completion';
  END IF;
  UPDATE public.office_employee_mail_outbox
    SET status=p_outcome,
        provider_message_id=CASE WHEN p_outcome='SENT' THEN pg_catalog.left(p_message_id,320) ELSE NULL END,
        submitted_at=CASE WHEN p_outcome='SENT' THEN pg_catalog.now() ELSE NULL END,
        finalized_at=pg_catalog.now()
  WHERE id=p_outbox AND status='SENDING' AND claim_token=p_claim
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Mail claim expired or was already resolved'; END IF;
  INSERT INTO public.office_employee_mail_delivery_events(outbox_id,event_type,provider_message_id)
    VALUES(p_outbox,CASE WHEN p_outcome='SENT' THEN 'ACCEPTED' ELSE p_outcome END,
           CASE WHEN p_outcome='SENT' THEN pg_catalog.left(p_message_id,320) ELSE NULL END);
  RETURN true;
END;
$kravia_finish$;

REVOKE ALL ON FUNCTION public.office_employee_mail_claim(integer),
  public.office_employee_mail_finish(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_employee_mail_claim(integer),
  public.office_employee_mail_finish(uuid,uuid,text,text)
  TO kravia_office_backend;

-- Browser roles must never read direct outbox email addresses or claim tokens.
REVOKE ALL ON public.office_employee_mail_outbox,
  public.office_employee_mail_delivery_events FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.office_employee_mail_claim(integer) IS
  'Leased restricted backend-only, Owner-enabled, real-record-verified mail claims. Stale claims become UNKNOWN.';
COMMENT ON TABLE public.office_employee_mail_delivery_events IS
  'No personal bank details, password reset tokens, OTPs, document contents or speculative message deliveries.';
