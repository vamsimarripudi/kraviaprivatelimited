-- Disposable PostgreSQL fixture. The direct invitation notices never share
-- credentials with the lifecycle worker or backfill expired invitations.
BEGIN;
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>65
   OR (SELECT count(*) FROM public.office_lifecycle_transactional_ownership)<>6
   OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE enabled)<>0
   OR (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>0 THEN
   RAISE EXCEPTION 'Unexpected direct invitation notice registration state';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_lifecycle_transactional_ownership
    WHERE event_code='AUTH-02'
      AND event_evidence_type='office_auth_invite_notice_deliveries:REMINDER:SENT')
    OR NOT EXISTS(SELECT 1 FROM public.office_lifecycle_transactional_ownership
    WHERE event_code='AUTH-03'
      AND event_evidence_type='office_auth_invite_notice_deliveries:EXPIRED:SENT')
 THEN
    RAISE EXCEPTION 'Opt-in reminder or expiry proof has no durable delivery owner';
 END IF;
 BEGIN
   UPDATE public.office_lifecycle_mail_policy SET enabled=true
   WHERE event_code='AUTH-02';
   RAISE EXCEPTION 'Duplicate invite reminder unexpectedly enabled';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'Duplicate invite reminder unexpectedly enabled%' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%already handled by first-party Office authentication%' THEN
     RAISE EXCEPTION 'Wrong invitation notice activation barrier: %',SQLERRM;
   END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Generic lifecycle provider queue received a direct credential email';
 END IF;
END;
$test$;
ROLLBACK;
SELECT 'INVITATION_NOTICE_OWNERSHIP_VERIFIED' AS result;
