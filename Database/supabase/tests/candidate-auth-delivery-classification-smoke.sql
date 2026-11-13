-- Postgres 17 isolated fixture, checked only after candidate migration 032 and 033.
BEGIN;
DO $verify$
DECLARE n integer;
BEGIN
 IF (SELECT COUNT(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>70
 OR (SELECT COUNT(*) FROM public.office_lifecycle_mail_policy WHERE enabled)<>0
 OR (SELECT COUNT(*) FROM public.office_candidate_lifecycle_outbox)<>0 THEN
   RAISE EXCEPTION 'Source coverage or default-off policy incorrect';
 END IF;
 IF (SELECT COUNT(*) FROM public.office_lifecycle_mail_policy
      WHERE delivery_channel='FIRST_PARTY_AUTH')<>3
    OR (SELECT COUNT(*) FROM public.office_lifecycle_mail_policy
      WHERE delivery_channel='CANDIDATE_OUTBOX')<>8 THEN
   RAISE EXCEPTION 'Direct auth or candidate delivery channel misclassified';
 END IF;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy
   WHERE event_code IN ('AUTH-01','AUTH-05','AUTH-08')
     AND (delivery_channel<>'FIRST_PARTY_AUTH' OR NOT source_ready)) THEN
   RAISE EXCEPTION 'Existing first-party security mail flows not recognized';
 END IF;
 BEGIN
   UPDATE public.office_lifecycle_mail_policy
      SET enabled=true,approved_by='11111111-1111-4111-8111-111111111111',
          approved_at=now(),effective_from=now()
    WHERE event_code='AUTH-05';
   RAISE EXCEPTION 'Duplicate generic email OTP activation was accepted';
 EXCEPTION WHEN check_violation THEN
   NULL; -- expected: first-party authentication can never be activated in outbox
 END;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy
   WHERE delivery_channel='FIRST_PARTY_AUTH' AND enabled) THEN
   RAISE EXCEPTION 'Duplicate security mail dispatch enabled';
 END IF;
END $verify$;
ROLLBACK;
SELECT 'CANDIDATE_AND_AUTH_CHANNELS_VERIFIED';
