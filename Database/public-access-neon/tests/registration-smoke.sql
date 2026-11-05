-- Integration test for the real PostgreSQL public signup functions.
-- No test accounts survive: the inner exception block rolls back ALL test writes.
-- Run after migrations with: psql -v ON_ERROR_STOP=1 -f Database/public-access-neon/tests/registration-smoke.sql

DO $smoke$
DECLARE
  accepted boolean;
  created_account uuid;
  pending boolean;
  attempts integer;
  occurrences integer;
BEGIN
  BEGIN
    SELECT public_access.reserve_challenge(
       '7a3d9f5b-c4e2-4f11-a6a9-8b69011ae321'::uuid,
       'kravia-optin-smoke@example.test', 'Integration Smoke',
       repeat('a',64), true, '/resources', repeat('b',64)
    ) INTO accepted;
    IF accepted IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Synthetic challenge reservation failed';
    END IF;

    SELECT count(*) INTO occurrences FROM public_access.complete_challenge(
      '7a3d9f5b-c4e2-4f11-a6a9-8b69011ae321'::uuid,
      repeat('c',64), repeat('d',64), repeat('e',64),
      repeat('f',64), '2026-11-05');
    IF occurrences != 0 THEN
      RAISE EXCEPTION 'Incorrect OTP was accepted';
    END IF;
    SELECT attempt_count INTO attempts FROM public_access.email_challenges
      WHERE id='7a3d9f5b-c4e2-4f11-a6a9-8b69011ae321'::uuid;
    IF attempts != 1 THEN
      RAISE EXCEPTION 'Wrong OTP attempt was not counted';
    END IF;

    SELECT c.account_id,c.newsletter_pending INTO created_account,pending
      FROM public_access.complete_challenge(
        '7a3d9f5b-c4e2-4f11-a6a9-8b69011ae321'::uuid,
        repeat('a',64), repeat('d',64), repeat('e',64),
        repeat('f',64), '2026-11-05'
      ) c;
    IF created_account IS NULL OR pending IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Correct OTP or pending opt-in did not complete';
    END IF;
    SELECT count(*) INTO occurrences
      FROM public_access.sessions WHERE account_id=created_account AND revoked_at IS NULL;
    IF occurrences != 1 THEN RAISE EXCEPTION 'Session was not persisted'; END IF;
    SELECT count(*) INTO occurrences
      FROM public_access.newsletters WHERE account_id=created_account AND status='PENDING';
    IF occurrences != 1 THEN RAISE EXCEPTION 'Opt-in skipped double confirmation'; END IF;

    SELECT count(*) INTO occurrences FROM public_access.complete_challenge(
      '7a3d9f5b-c4e2-4f11-a6a9-8b69011ae321'::uuid,
      repeat('a',64), repeat('1',64), repeat('2',64),
      repeat('3',64), '2026-11-05');
    IF occurrences != 0 THEN RAISE EXCEPTION 'Consumed OTP was replayable'; END IF;

    SELECT public_access.reserve_challenge(
       '8b4e0a6c-d5f3-4a22-977b-9c7df002c432'::uuid,
       'kravia-no-optin-smoke@example.test', 'No Newsletter',
       repeat('9',64), false, '/resources', repeat('8',64)
    ) INTO accepted;
    IF accepted IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'No-marketing challenge reservation failed';
    END IF;
    SELECT c.account_id,c.newsletter_pending INTO created_account,pending
      FROM public_access.complete_challenge(
       '8b4e0a6c-d5f3-4a22-977b-9c7df002c432'::uuid,
       repeat('9',64), repeat('7',64), repeat('6',64),
       repeat('5',64), '2026-11-05'
      ) c;
    IF created_account IS NULL OR pending IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'No-marketing registration failed or subscribed';
    END IF;
    SELECT count(*) INTO occurrences
      FROM public_access.newsletters WHERE account_id=created_account;
    IF occurrences != 0 THEN RAISE EXCEPTION 'No-marketing account was subscribed'; END IF;

    -- This deliberate exception rolls back the entire nested subtransaction.
    RAISE EXCEPTION 'KRAVIA_REGISTRATION_SMOKE_ROLLBACK';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'KRAVIA_REGISTRATION_SMOKE_ROLLBACK' THEN RAISE; END IF;
  END;
END
$smoke$;
