-- Isolated PostgreSQL fixture. No payroll execution, payment or email.
BEGIN;
DO $privileges$
BEGIN
 IF has_table_privilege('anon','public.office_exit_settlement_cases','SELECT')
 OR has_table_privilege('authenticated','public.office_exit_settlement_proofs','SELECT')
 OR has_function_privilege('anon',
  'public.office_exit_settlement_verify(uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Final-settlement evidence exposed to client'; END IF;
END $privileges$;

SELECT public.office_exit_contact_record(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'former.employee@example.net','SIGNED_EXIT_FORM',
 'Synthetic employment exit and personal consent signed EX-2026-11',
 'Record independently authorized final-settlement address');
SELECT public.office_exit_contact_decide(
 '11111111-1111-4111-8111-111111111111',
 '33333333-3333-4333-8333-333333333333',
 true,'Owner confirms synthetic signed former employee contact evidence');

UPDATE public.office_employment_registry SET end_date=CURRENT_DATE+3
 WHERE identity_user_id='33333333-3333-4333-8333-333333333333';
INSERT INTO public.office_requests(id,request_type_code,target_user_id,status)
VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','EMPLOYEE_OFFBOARDING',
'33333333-3333-4333-8333-333333333333','APPROVED');
INSERT INTO public.office_payroll_results(
 id,employee_user_id,status,currency,net_pay_minor
) VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 '33333333-3333-4333-8333-333333333333','LOCKED','INR',120000);

DO $unauthorized$
BEGIN
 BEGIN
  PERFORM public.office_exit_settlement_open(
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'No permission to fabricate final payroll evidence');
  RAISE EXCEPTION 'Unauthorized settlement case creation succeeded';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Verified offboarding and locked payroll evidence%' THEN RAISE; END IF;
 END;
END $unauthorized$;

CREATE TEMP TABLE synthetic_case AS
 SELECT public.office_exit_settlement_open(
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Confirmed independently governed exit payroll settlement case'
 ) AS id;

DO $opened$
DECLARE v_id bigint;
BEGIN
 IF (SELECT count(*) FROM public.office_exit_settlement_proofs)<>1 THEN
   RAISE EXCEPTION 'EXIT-05 lacks immutable genuine case evidence'; END IF;
 SELECT id INTO v_id FROM public.office_exit_settlement_proofs
  WHERE event_code='EXIT-05';
 IF NOT public.office_exit_settlement_source_valid(v_id) THEN
   RAISE EXCEPTION 'An opened, approved-payroll settlement case was rejected'; END IF;
 BEGIN
  PERFORM public.office_exit_settlement_verify(
   '11111111-1111-4111-8111-111111111111',
   (SELECT id FROM pg_temp.synthetic_case),
   'Owner cannot verify bank credits that do not exist');
  RAISE EXCEPTION 'Unverified bank balance was treated as fully paid';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%bank credits do not cover full net payroll%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.office_exit_settlement_verify(
   '22222222-2222-4222-8222-222222222222',
   (SELECT id FROM pg_temp.synthetic_case),
   'Case opener cannot approve their own settlement');
  RAISE EXCEPTION 'Case creator self-approved final settlement';
 EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%Independent Owner review is required%' THEN RAISE; END IF;
 END;
END $opened$;

-- Verified bank credits must cover the actual LOCKED payroll amount, be
-- independently verified, and have the same currency.
INSERT INTO public.office_salary_settlement_evidence(
 id,payroll_result_id,amount_minor,currency,status,submitted_by,
 verified_by,verified_at
) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  60000,'INR','VERIFIED',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',now()),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  60000,'INR','VERIFIED',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',now());

SELECT public.office_exit_settlement_verify(
 '11111111-1111-4111-8111-111111111111',
 (SELECT id FROM pg_temp.synthetic_case),
 'Owner compared independent full credits against locked payroll net');
DO $verified$
DECLARE v_id bigint;
BEGIN
 IF (SELECT count(*) FROM public.office_exit_settlement_proofs)<>2 THEN
   RAISE EXCEPTION 'EXIT-05/06 source ledger incomplete'; END IF;
 SELECT id INTO v_id FROM public.office_exit_settlement_proofs
  WHERE event_code='EXIT-06';
 IF NOT public.office_exit_settlement_source_valid(v_id) THEN
   RAISE EXCEPTION 'Independently settled full payroll still rejected'; END IF;
 IF (SELECT count(*) FROM public.office_exit_settlement_events
    WHERE event_type='SETTLEMENT_VERIFIED')<>1 THEN
   RAISE EXCEPTION 'Final settlement decision was duplicated'; END IF;
END $verified$;

-- Revocation invalidates BOTH former employee delivery proofs, never re-sends.
SELECT public.office_exit_contact_revoke(
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',
 'Employee withdrew alternative-email delivery consent');
DO $revoked$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_exit_settlement_proofs p
   WHERE public.office_exit_settlement_source_valid(p.id))
 THEN RAISE EXCEPTION 'An exit settlement proof survived contact revocation'; END IF;
END $revoked$;

ROLLBACK;
SELECT 'OFFICE_EXIT_SETTLEMENT_EVIDENCE_VERIFIED' AS result;
