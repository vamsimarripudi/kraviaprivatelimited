-- Synthetic isolated DB only. Never run this fixture against real employees.
-- Verify disabled-by-default, account targeting, proof binding, no fake
-- sign-ins, no untrusted devices, no suspended recipients, idempotent claims.
BEGIN;
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>37
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Source smoke must start with 37 disabled routes and no mail';
 END IF;
 IF has_function_privilege('anon','public.office_lifecycle_mail_claim(integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.office_lifecycle_mail_claim(integer)','EXECUTE')
    OR has_table_privilege('anon','public.office_lifecycle_auth_signals','SELECT') THEN
   RAISE EXCEPTION 'Unauthorised lifecycle mail source read or claim';
 END IF;
END;
$check$;

-- A real provider action is the only allowed signal; a session start is not.
INSERT INTO public.office_login_device_approvals(
 id,user_id,session_id,status,consumed_at
) VALUES(
 'synthetic_approval_01','a0000000-0000-4000-8000-000000000002',
 'synthetic_device_session_01','TRUSTED',pg_catalog.now()
);
INSERT INTO public.office_asset_lifecycle(asset_id,custodian_user_id,lifecycle_status)
VALUES('synthetic_asset_01','a0000000-0000-4000-8000-000000000002','ASSIGNED');

-- Simulate explicit Owner activation solely inside a rolled-back fixture.
UPDATE public.office_lifecycle_mail_policy SET enabled=true,
  approved_by='a0000000-0000-4000-8000-000000000001'::uuid,
  approved_at=pg_catalog.now()-interval '1 minute',
  effective_from=pg_catalog.now()-interval '1 minute'
WHERE event_code IN ('AUTH-04','AUTH-07','AUTH-09','ONB-07');

INSERT INTO public.office_auth_events_v2(id,user_id,session_id,event_type,metadata_json)
VALUES
 ('synthetic_registration_01','a0000000-0000-4000-8000-000000000002',NULL,'INVITATION_ACCEPTED','{}'),
 ('synthetic_password_reset_01','a0000000-0000-4000-8000-000000000002',NULL,'PASSWORD_RECOVERY_COMPLETED','{}'),
 ('synthetic_device_01','a0000000-0000-4000-8000-000000000002','synthetic_device_session_01','DEVICE_APPROVAL_COMPLETED','{}'),
 ('synthetic_login_ignored','a0000000-0000-4000-8000-000000000002',NULL,'LOGIN_SUCCESS','{}'),
 ('synthetic_dormant_ignored','a0000000-0000-4000-8000-000000000004',NULL,'INVITATION_ACCEPTED','{}'),
 ('synthetic_untrusted_device','a0000000-0000-4000-8000-000000000002','no_trusted_approval','DEVICE_APPROVAL_COMPLETED','{}');
INSERT INTO public.office_asset_events(
 asset_id,actor_user_id,event_type,new_status,metadata
) VALUES(
 'synthetic_asset_01','a0000000-0000-4000-8000-000000000003',
 'ASSIGNED','ASSIGNED',
 pg_catalog.jsonb_build_object('custodian_user_id','a0000000-0000-4000-8000-000000000002')
);
DO $first$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.office_lifecycle_auth_signals;
 IF n<>3 THEN RAISE EXCEPTION 'Expected three authentic first-party auth signals, got %',n; END IF;
 SELECT count(*) INTO n FROM public.office_lifecycle_mail_outbox;
 IF n<>4 THEN RAISE EXCEPTION 'Expected four authenticated, idempotent outbound intents, got %',n; END IF;
 IF EXISTS(
  SELECT 1 FROM public.office_lifecycle_mail_outbox
  WHERE recipient_user_id IS DISTINCT FROM
    'a0000000-0000-4000-8000-000000000002'::uuid
 ) THEN RAISE EXCEPTION 'Mail targeted an inactive or incorrect Office identity'; END IF;
 -- The same immutable event cannot generate another outbound intent.
 PERFORM public.office_lifecycle_mail_enqueue(
  'AUTH-09','office_lifecycle_auth_signals',
  (SELECT id FROM public.office_lifecycle_auth_signals WHERE event_code='AUTH-09'),
  'a0000000-0000-4000-8000-000000000002'::uuid
 );
 IF (SELECT count(*) FROM public.office_lifecycle_mail_outbox)<>4 THEN
   RAISE EXCEPTION 'Duplicate source emitted duplicate mail';
 END IF;
END;
$first$;

CREATE TEMP TABLE synthetic_claims AS
 SELECT * FROM public.office_lifecycle_mail_claim(25);
DO $second$
BEGIN
 IF (SELECT count(*) FROM pg_temp.synthetic_claims)<>4 THEN
  RAISE EXCEPTION 'Expected four verified claims, got %',
    (SELECT count(*) FROM pg_temp.synthetic_claims);
 END IF;
 IF (SELECT count(DISTINCT event_code) FROM pg_temp.synthetic_claims)<>4 THEN
  RAISE EXCEPTION 'Claimed event codes not distinct and complete';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.synthetic_claims
    WHERE recipient_email<>'synthetic.staff@kraviaprivatelimited.com'
    OR event_code NOT IN ('AUTH-04','AUTH-07','AUTH-09','ONB-07')) THEN
  RAISE EXCEPTION 'Claimed unverified recipient or unsupported event';
 END IF;
END;
$second$;
ROLLBACK;
SELECT 'AUTH_ASSET_EVIDENCE_VERIFIED' AS result;
