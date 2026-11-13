-- Existing KRAVIA Office security emails already use the first-party
-- authenticated transaction boundary. Do not send them again via lifecycle.
-- This forward-only catalog reconciliation does NOT send or queue messages.
-- Install after 030; never change the recorded 022-030 migrations.
DO $preflight$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
     OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>59
     OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
     OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
    RAISE EXCEPTION 'Expected 59 mapped, 81 total, zero enabled and no queued lifecycle mail';
  END IF;
END;
$preflight$;

ALTER TABLE public.office_lifecycle_mail_policy
  ADD COLUMN delivery_owner text NOT NULL DEFAULT 'LIFECYCLE_WORKER'
    CHECK (delivery_owner IN ('LIFECYCLE_WORKER','FIRST_PARTY_AUTH'));

ALTER TABLE public.office_lifecycle_mail_policy
  ADD CONSTRAINT office_lifecycle_mail_prevent_duplicate_auth_dispatch
  CHECK (NOT enabled OR delivery_owner='LIFECYCLE_WORKER');

COMMENT ON COLUMN public.office_lifecycle_mail_policy.delivery_owner IS
  'FIRST_PARTY_AUTH means the existing authenticated credential flow is the sole sender; the generic lifecycle worker must never duplicate it.';

UPDATE public.office_lifecycle_mail_policy
 SET source_ready=true, delivery_owner='FIRST_PARTY_AUTH'
 WHERE event_code IN ('AUTH-01','AUTH-05','AUTH-06','AUTH-08')
   AND NOT source_ready AND NOT enabled;

-- Exact audited ownership contract, not a second queue. These four send paths
-- submit to Brevo directly with event-specific high-entropy delivery IDs;
-- other transactional provider events never become HTML/browser jobs here.
CREATE TABLE public.office_lifecycle_transactional_ownership(
  event_code text PRIMARY KEY
    REFERENCES public.office_lifecycle_mail_policy(event_code) ON DELETE RESTRICT,
  provider_boundary text NOT NULL
    CHECK(provider_boundary IN (
      'office_invitation','office_email_otp','office_device_approval','office_password_recovery')),
  event_evidence_type text NOT NULL,
  protected_by text NOT NULL DEFAULT 'OFFICE_AUTHENTICATED_WORKFLOW',
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.office_lifecycle_transactional_ownership ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_lifecycle_transactional_ownership
  FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON public.office_lifecycle_transactional_ownership TO service_role;

INSERT INTO public.office_lifecycle_transactional_ownership(
 event_code,provider_boundary,event_evidence_type
) VALUES
 ('AUTH-01','office_invitation','INVITATION_EMAIL_ACCEPTED'),
 ('AUTH-05','office_email_otp','OFFICE_INVITE_EMAIL_OTP_SENT'),
 ('AUTH-06','office_device_approval','DEVICE_APPROVAL_SENT'),
 ('AUTH-08','office_password_recovery','PASSWORD_RECOVERY_EMAIL_ACCEPTED');

-- Explicit SQL error at the authority boundary, in addition to the CHECK:
-- even an Owner must not toggle a direct credential message into the generic
-- lifecycle dispatcher. The normal first-party email routes remain intact.
CREATE OR REPLACE FUNCTION public.office_lifecycle_prevent_auth_duplicate()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $guard$
BEGIN
 IF NEW.enabled AND NEW.delivery_owner='FIRST_PARTY_AUTH' THEN
   RAISE EXCEPTION 'This credential email is already handled by first-party Office authentication';
 END IF;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.office_lifecycle_prevent_auth_duplicate()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_lifecycle_prevent_auth_duplicate
  BEFORE INSERT OR UPDATE OF enabled,delivery_owner
  ON public.office_lifecycle_mail_policy
  FOR EACH ROW EXECUTE FUNCTION public.office_lifecycle_prevent_auth_duplicate();

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>63
    OR (SELECT count(*) FROM public.office_lifecycle_transactional_ownership)<>4
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox)
    OR EXISTS(
      SELECT 1 FROM public.office_lifecycle_transactional_ownership own
      JOIN public.office_lifecycle_mail_policy policy USING(event_code)
      WHERE policy.delivery_owner<>'FIRST_PARTY_AUTH'
    ) THEN
   RAISE EXCEPTION 'Expected 63 covered events (4 existing credential senders), all mail still disabled';
 END IF;
END;
$postcheck$;
