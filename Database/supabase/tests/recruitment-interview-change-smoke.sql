BEGIN;
DO $check$
DECLARE v_result text;
BEGIN
 IF has_function_privilege('anon','public.office_interview_change(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.office_interview_change(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Browser unexpectedly permitted to mutate interviews';
 END IF;
 BEGIN
  PERFORM public.office_interview_change(
   '99999999-9999-4999-8999-999999999999'::uuid,
   '44444444-4444-4444-8444-444444444444'::uuid,
   'RESCHEDULE',now()+interval '3 days',now()+interval '3 days 1 hour','Real candidate requested a change');
  RAISE EXCEPTION 'Unauthorized recruiter bypassed permission check';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Interview management permission is required%' THEN RAISE; END IF;
 END;
 v_result:=public.office_interview_change(
  '11111111-1111-4111-8111-111111111111'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid,
  'RESCHEDULE',now()+interval '3 days',now()+interval '3 days 1 hour',
  'Verified availability change recorded by candidate');
 IF v_result<>'RESCHEDULED' THEN RAISE EXCEPTION 'Reschedule not recorded'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_recruitment_events
  WHERE event_type='INTERVIEW_RESCHEDULED'
    AND candidate_id='33333333-3333-4333-8333-333333333333'::uuid
    AND (metadata->>'interview_id')='44444444-4444-4444-8444-444444444444'
    AND char_length(note)>8) THEN
  RAISE EXCEPTION 'Auditable reschedule event absent'; END IF;
 BEGIN
  PERFORM public.office_interview_change(
   '11111111-1111-4111-8111-111111111111'::uuid,
   '44444444-4444-4444-8444-444444444444'::uuid,
   'RESCHEDULE',now()-interval '1 day',NULL,'Old past time was entered');
  RAISE EXCEPTION 'Past interview time accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%distinct, future interview time%' THEN RAISE; END IF;
 END;
 v_result:=public.office_interview_change(
  '11111111-1111-4111-8111-111111111111'::uuid,
  '44444444-4444-4444-8444-444444444444'::uuid,
  'CANCEL',NULL,NULL,'Candidate confirmed that this interview is cancelled');
 IF v_result<>'CANCELLED' THEN RAISE EXCEPTION 'Cancel not recorded'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_candidate_interviews
  WHERE id='44444444-4444-4444-8444-444444444444'::uuid AND status='CANCELLED')
  OR NOT EXISTS(SELECT 1 FROM public.office_recruitment_events
  WHERE event_type='INTERVIEW_CANCELLED'
    AND candidate_id='33333333-3333-4333-8333-333333333333'::uuid
    AND actor_user_id='11111111-1111-4111-8111-111111111111'::uuid) THEN
  RAISE EXCEPTION 'Cancellation source evidence missing'; END IF;
 BEGIN
  PERFORM public.office_interview_change(
   '11111111-1111-4111-8111-111111111111'::uuid,
   '44444444-4444-4444-8444-444444444444'::uuid,
   'CANCEL',NULL,NULL,'Cancel same interview twice');
  RAISE EXCEPTION 'Cancelled interview was modified twice';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Only scheduled interviews may be changed%' THEN RAISE; END IF;
 END;
END $check$;
ROLLBACK;
SELECT 'RECRUITMENT_INTERVIEW_CHANGE_VERIFIED';