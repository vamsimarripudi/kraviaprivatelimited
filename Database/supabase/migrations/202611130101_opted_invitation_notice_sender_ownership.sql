-- AUTH-02 and AUTH-03 are owned by the explicit first-party invitation
-- notice worker, not by the generic lifecycle dispatcher. No token is recoverable.
-- The worker defaults OFF and requires invite-level opt-in; no historical send.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>63
    OR (SELECT count(*) FROM public.office_lifecycle_transactional_ownership)<>4
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox)
 THEN
   RAISE EXCEPTION 'Expected 63 covered routes and four existing auth senders before opt-in notice ownership';
 END IF;
END;
$preflight$;

UPDATE public.office_lifecycle_mail_policy
 SET delivery_owner='FIRST_PARTY_AUTH',source_ready=true
 WHERE event_code IN ('AUTH-02','AUTH-03')
   AND NOT source_ready AND NOT enabled;

INSERT INTO public.office_lifecycle_transactional_ownership(
 event_code,provider_boundary,event_evidence_type
) VALUES
 ('AUTH-02','office_invitation','office_auth_invite_notice_deliveries:REMINDER:SENT'),
 ('AUTH-03','office_invitation','office_auth_invite_notice_deliveries:EXPIRED:SENT');

-- Explicit protection against a second credential sender remains enforced by
-- the CHECK and trigger installed in 031. An Owner may opt in the invitation
-- notice preference; cannot toggle these codes into generic lifecycle mail.
DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>65
   OR (SELECT count(*) FROM public.office_lifecycle_transactional_ownership)<>6
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_transactional_ownership o
      JOIN public.office_lifecycle_mail_policy p USING(event_code)
      WHERE p.delivery_owner<>'FIRST_PARTY_AUTH')
 THEN
  RAISE EXCEPTION 'Expected 65 mapped paths, six non-duplicating direct auth routes, zero enabled';
 END IF;
END;
$postcheck$;
