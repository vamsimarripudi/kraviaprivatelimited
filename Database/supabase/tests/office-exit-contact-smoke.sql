-- Source-only test. Never creates, claims or sends any email.
BEGIN;
DO $security$
BEGIN
 IF has_table_privilege('anon','public.office_exit_contact_evidence','SELECT')
 OR has_table_privilege('authenticated','public.office_exit_contact_evidence','SELECT')
 OR has_table_privilege('kravia_office_backend','public.office_exit_contact_evidence','SELECT')
 OR has_function_privilege('anon',
     'public.office_exit_contact_record(uuid,uuid,text,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated',
     'public.office_exit_contact_decide(uuid,uuid,boolean,text)','EXECUTE')
 OR has_function_privilege('kravia_office_backend',
     'public.office_exit_contact_recipient(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Former employee contact evidence is visible to an untrusted role'; END IF;
 IF NOT has_function_privilege('service_role',
    'public.office_exit_contact_record(uuid,uuid,text,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Restricted service access is not configured'; END IF;
END $security$;

DO $flow$
DECLARE v integer; e text;
BEGIN
 IF public.office_exit_contact_recipient(
  '33333333-3333-4333-8333-333333333333') IS NOT NULL THEN
   RAISE EXCEPTION 'Contact existed without an attested record'; END IF;

 BEGIN
  PERFORM public.office_exit_contact_record(
   '44444444-4444-4444-8444-444444444444',
   '33333333-3333-4333-8333-333333333333',
   'former.employee@example.com','SIGNED_EXIT_FORM',
   'Synthetic signed document EX-2026-1',
   'Documented alternative recipient entered for exit');
  RAISE EXCEPTION 'Unauthorized recorder accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Active independent People authority%' THEN RAISE; END IF;
 END;

 BEGIN
  PERFORM public.office_exit_contact_record(
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',
   'staff@kraviaprivatelimited.com','SIGNED_EXIT_FORM',
   'Synthetic signed document EX-2026-1',
   'Corporate mailbox is not a personal exit address');
  RAISE EXCEPTION 'Company mailbox improperly accepted as private contact';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Authentic personal contact%' THEN RAISE; END IF;
 END;

 v:=public.office_exit_contact_record(
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',
   'former.employee@example.com','SIGNED_EXIT_FORM',
   'Synthetic signed document EX-2026-1',
   'Documented email consent for pending departure');
 IF v<>1 THEN RAISE EXCEPTION 'Incorrect initial consent version'; END IF;
 IF public.office_exit_contact_recipient(
   '33333333-3333-4333-8333-333333333333') IS NOT NULL THEN
   RAISE EXCEPTION 'Unverified email was exposed'; END IF;

 BEGIN
  PERFORM public.office_exit_contact_decide(
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',true,
   'Self-approval must be denied under independent review');
  RAISE EXCEPTION 'Self-approval accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Current independent consent review%' THEN RAISE; END IF;
 END;

 BEGIN
  PERFORM public.office_exit_contact_decide(
   '44444444-4444-4444-8444-444444444444',
   '33333333-3333-4333-8333-333333333333',true,
   'Unauthorized reviewer attempted approval');
  RAISE EXCEPTION 'Unauthorized approval accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Independent current Owner approval%' THEN RAISE; END IF;
 END;

 PERFORM public.office_exit_contact_decide(
   '11111111-1111-4111-8111-111111111111',
   '33333333-3333-4333-8333-333333333333',true,
   'Independent Owner confirmed synthetic signed consent');
 SELECT public.office_exit_contact_recipient(
   '33333333-3333-4333-8333-333333333333') INTO e;
 IF e IS DISTINCT FROM 'former.employee@example.com' THEN
   RAISE EXCEPTION 'Verified contact was not available'; END IF;

 -- Any changed email loses approval until an independent new review.
 v:=public.office_exit_contact_record(
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333',
   'second.example@example.org','VERIFIED_EMPLOYEE_REPLY',
   'Signed renewed consent EX-2026-002',
   'Employee provided another address with new evidence');
 IF v<>2 OR public.office_exit_contact_recipient(
   '33333333-3333-4333-8333-333333333333') IS NOT NULL THEN
   RAISE EXCEPTION 'Changed contact retained stale verified consent'; END IF;

 PERFORM public.office_exit_contact_decide(
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333333',true,
  'Independent Owner verified the new signed address');
 PERFORM public.office_exit_contact_revoke(
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  'Employee withdrew consent for all exit messages');
 IF public.office_exit_contact_recipient(
   '33333333-3333-4333-8333-333333333333') IS NOT NULL THEN
   RAISE EXCEPTION 'Revoked contact remained available'; END IF;

 IF (SELECT count(*) FROM public.office_exit_contact_events
    WHERE employee_user_id='33333333-3333-4333-8333-333333333333')<>5 THEN
    RAISE EXCEPTION 'Incorrect immutable consent event count'; END IF;
 IF (SELECT count(*) FROM public.office_exit_contact_evidence)<>1 THEN
    RAISE EXCEPTION 'Test introduced unauthorized contact records'; END IF;
END $flow$;
ROLLBACK;
SELECT 'OFFICE_EXIT_CONTACT_EVIDENCE_VERIFIED' AS result;
