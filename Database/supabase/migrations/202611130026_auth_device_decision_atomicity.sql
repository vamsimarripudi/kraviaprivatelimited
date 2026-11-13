-- Forward-only reliability update after 025. The authoritative auth event and
-- approval state are committed in one transaction, but SQLAlchemy may flush
-- their INSERT/UPDATE in either order. Do not drop authentic device events.
-- Private claim still requires a persisted approved/declined decision.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>37
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Office auth evidence upgrade requires 37 disabled mappings and no pending mail';
 END IF;
END;
$preflight$;

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
REVOKE ALL ON FUNCTION public.office_lifecycle_auth_v2_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
-- Existing AFTER INSERT trigger retains the replaced function reference.
DO $postcheck$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgname='office_lifecycle_mail_on_auth_v2' AND NOT tgisinternal)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled) THEN
   RAISE EXCEPTION 'Auth evidence trigger or zero-send gate missing';
 END IF;
END;
$postcheck$;
