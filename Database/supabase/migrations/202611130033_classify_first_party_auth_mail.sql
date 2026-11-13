-- First-party Office authentication already has dedicated one-time secure delivery.
-- Do NOT duplicate an invite, OTP, or password-reset email through lifecycle Brevo.
-- This forward-only classification represents implementation coverage, not
-- Owner authorisation to send or to run the generic mail worker.
DO $guard$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
 OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>67
 OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
 OR EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox) THEN
  RAISE EXCEPTION 'Unexpected lifecycle state before classifying first-party auth paths';
 END IF;
END $guard$;

ALTER TABLE public.office_lifecycle_mail_policy
 ADD COLUMN delivery_channel text NOT NULL DEFAULT 'OUTBOX'
 CHECK(delivery_channel IN('OUTBOX','CANDIDATE_OUTBOX','FIRST_PARTY_AUTH'));

ALTER TABLE public.office_lifecycle_mail_policy
 ADD CONSTRAINT office_lifecycle_mail_no_duplicate_auth_delivery
 CHECK(delivery_channel<>'FIRST_PARTY_AUTH' OR enabled=false);

-- Actual direct sends are bound to credential/authentication endpoints.
-- User-supplied or stale events never go through the employee lifecycle worker.
UPDATE public.office_lifecycle_mail_policy
 SET source_ready=true, delivery_channel='FIRST_PARTY_AUTH'
 WHERE event_code IN('AUTH-01','AUTH-05','AUTH-08')
  AND enabled=false AND source_ready=false;

-- Candidate events require an entirely separate external-mail claim boundary.
UPDATE public.office_lifecycle_mail_policy
 SET delivery_channel='CANDIDATE_OUTBOX'
 WHERE event_code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04',
                     'HIRE-05','HIRE-06','HIRE-09','HIRE-10')
  AND enabled=false AND source_ready=true;

DO $final$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>70
 OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE delivery_channel='FIRST_PARTY_AUTH')<>3
 OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE delivery_channel='CANDIDATE_OUTBOX')<>8
 OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
 OR EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox) THEN
  RAISE EXCEPTION 'Expected 70 verified mappings, three dedicated auth sends, eight candidate sources, zero delivery';
 END IF;
END $final$;
