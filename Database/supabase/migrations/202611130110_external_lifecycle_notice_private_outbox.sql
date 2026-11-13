-- KRAVIA Office: last seven notification source/recipient mappings.
-- FORWARD-ONLY. Nothing is sent, backfilled or enabled by this migration.
-- External candidate, credential and existing employee workers stay separate.
DO $preflight$
BEGIN
  IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
     OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>74
     OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
     OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox)
     OR EXISTS(SELECT 1 FROM public.office_candidate_mail_outbox)
  THEN RAISE EXCEPTION 'Expected 74 reviewed sources and all mail gates disabled'; END IF;
END $preflight$;

ALTER TABLE public.office_lifecycle_mail_policy
 DROP CONSTRAINT office_lifecycle_mail_policy_delivery_owner_check,
 ADD CONSTRAINT office_lifecycle_mail_policy_delivery_owner_check
 CHECK(delivery_owner IN(
  'LIFECYCLE_WORKER','FIRST_PARTY_AUTH','CANDIDATE_WORKER','EXTERNAL_NOTICE_WORKER'
 ));
UPDATE public.office_lifecycle_mail_policy
 SET delivery_owner='EXTERNAL_NOTICE_WORKER',source_ready=true
 WHERE event_code IN('ONB-04','EXIT-02','EXIT-04','EXIT-05','EXIT-06','EXIT-07','EXIT-08')
 AND source_ready=false AND enabled=false;

-- Source identity is typed; an arbitrary request id can never be treated as
-- an approved payroll/document/exit source proof.
CREATE TABLE public.office_external_notice_outbox(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 event_code text NOT NULL REFERENCES public.office_lifecycle_mail_policy(event_code)
 CHECK(event_code IN('ONB-04','EXIT-02','EXIT-04','EXIT-05','EXIT-06','EXIT-07','EXIT-08')),
 source_kind text NOT NULL CHECK(source_kind IN(
  'ONBOARDING_SIGNING','EXIT_NOTIFICATION','EXIT_SETTLEMENT',
  'EXIT_DOCUMENT','EXIT_COMPLETION'
 )),
 source_proof_id bigint NOT NULL CHECK(source_proof_id>0),
 recipient_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 contact_version integer,
 status text NOT NULL DEFAULT 'PENDING'
  CHECK(status IN('PENDING','SENDING','SENT','REJECTED','UNKNOWN','SKIPPED')),
 claim_token uuid,
 claimed_at timestamptz,
 finalized_at timestamptz,
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(event_code,source_kind,source_proof_id,recipient_user_id),
 CHECK((event_code='ONB-04' AND source_kind='ONBOARDING_SIGNING' AND contact_version IS NULL)
   OR (event_code IN('EXIT-02','EXIT-04') AND source_kind='EXIT_NOTIFICATION' AND contact_version>0)
   OR (event_code IN('EXIT-05','EXIT-06') AND source_kind='EXIT_SETTLEMENT' AND contact_version>0)
   OR (event_code='EXIT-07' AND source_kind='EXIT_DOCUMENT' AND contact_version>0)
   OR (event_code='EXIT-08' AND source_kind='EXIT_COMPLETION' AND contact_version>0)),
 CHECK(status NOT IN('SENT','REJECTED','UNKNOWN','SKIPPED') OR finalized_at IS NOT NULL),
 CHECK(status<>'SENDING' OR (claim_token IS NOT NULL AND claimed_at IS NOT NULL))
);
CREATE INDEX office_external_notice_queue ON public.office_external_notice_outbox(status,created_at,id);
ALTER TABLE public.office_external_notice_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_external_notice_outbox
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_external_notice_outbox TO service_role;

CREATE TABLE public.office_external_notice_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 outbox_id uuid NOT NULL REFERENCES public.office_external_notice_outbox(id) ON DELETE RESTRICT,
 event_type text NOT NULL
 CHECK(event_type IN('CLAIMED','ACCEPTED','REJECTED','UNKNOWN','STALE_UNKNOWN','SKIPPED')),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(outbox_id,event_type)
);
ALTER TABLE public.office_external_notice_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_external_notice_events
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_external_notice_events TO service_role;

CREATE OR REPLACE FUNCTION public.office_external_notice_source_valid(
 p_code text,p_kind text,p_proof bigint,p_user uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $verify$
BEGIN
 IF p_code='ONB-04' AND p_kind='ONBOARDING_SIGNING' THEN
  RETURN EXISTS(SELECT 1 FROM public.office_onboarding_signing_proofs s
    WHERE s.id=p_proof AND s.employee_user_id=p_user)
    AND public.office_onboarding_signing_source_valid(p_proof);
 ELSIF p_code IN('EXIT-02','EXIT-04') AND p_kind='EXIT_NOTIFICATION' THEN
  RETURN EXISTS(SELECT 1 FROM public.office_exit_notification_proofs s
    WHERE s.id=p_proof AND s.employee_user_id=p_user AND s.event_code=p_code)
    AND public.office_exit_notification_source_valid(p_proof);
 ELSIF p_code IN('EXIT-05','EXIT-06') AND p_kind='EXIT_SETTLEMENT' THEN
  RETURN EXISTS(SELECT 1 FROM public.office_exit_settlement_proofs s
    WHERE s.id=p_proof AND s.employee_user_id=p_user AND s.event_code=p_code)
    AND public.office_exit_settlement_source_valid(p_proof);
 ELSIF p_code='EXIT-07' AND p_kind='EXIT_DOCUMENT' THEN
  RETURN EXISTS(SELECT 1 FROM public.office_exit_document_proofs s
    WHERE s.id=p_proof AND s.employee_user_id=p_user)
    AND public.office_exit_document_source_valid(p_proof);
 ELSIF p_code='EXIT-08' AND p_kind='EXIT_COMPLETION' THEN
  RETURN EXISTS(SELECT 1 FROM public.office_exit_completion_proofs s
    WHERE s.id=p_proof AND s.employee_user_id=p_user)
    AND public.office_exit_completion_source_valid(p_proof);
 END IF;
 RETURN false;
END $verify$;
REVOKE ALL ON FUNCTION public.office_external_notice_source_valid(text,text,bigint,uuid)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_external_notice_recipient(
 p_code text,p_user uuid,p_version integer
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $lookup$
DECLARE v_address text;
BEGIN
 IF p_code LIKE 'EXIT-%' THEN
   SELECT consent.personal_email INTO v_address
   FROM public.office_exit_contact_evidence consent
   WHERE consent.employee_user_id=p_user
     AND consent.version=p_version
     AND consent.status='VERIFIED'
     AND consent.revoked_at IS NULL
     AND consent.expires_at>pg_catalog.now()
     AND consent.reviewed_at IS NOT NULL
     AND consent.reviewed_by IS NOT NULL
     AND consent.reviewed_by<>consent.recorded_by
     AND consent.personal_email=public.office_exit_contact_recipient(p_user)
     AND consent.personal_email !~* '@kraviaprivatelimited[.]com$';
 ELSIF p_code='ONB-04' AND p_version IS NULL THEN
   SELECT auth.email INTO v_address
   FROM public.office_auth_users auth
   JOIN public.office_identity_users identity ON identity.user_id=p_user
   WHERE auth.id=p_user::text
     AND identity.status='ACTIVE' AND auth.status='ACTIVE'
     AND auth.email=pg_catalog.lower(pg_catalog.btrim(auth.email))
     AND auth.email ~ '^[^[:space:]@]+@kraviaprivatelimited[.]com$'
     AND EXISTS(
      SELECT 1 FROM public.office_employment_registry employment
      WHERE employment.identity_user_id=p_user
        AND employment.relationship_type='EMPLOYEE'
     );
 END IF;
 RETURN v_address;
END $lookup$;
REVOKE ALL ON FUNCTION public.office_external_notice_recipient(text,uuid,integer)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_external_notice_source_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE
 v_code text := NEW.event_code;
 v_kind text;
 v_user uuid := NEW.employee_user_id;
 v_version integer;
BEGIN
 v_kind := CASE TG_TABLE_NAME
 WHEN 'office_onboarding_signing_proofs' THEN 'ONBOARDING_SIGNING'
 WHEN 'office_exit_notification_proofs' THEN 'EXIT_NOTIFICATION'
 WHEN 'office_exit_settlement_proofs' THEN 'EXIT_SETTLEMENT'
 WHEN 'office_exit_document_proofs' THEN 'EXIT_DOCUMENT'
 WHEN 'office_exit_completion_proofs' THEN 'EXIT_COMPLETION'
 ELSE NULL END;
 IF v_kind IS NULL THEN RETURN NEW; END IF;
 IF v_code LIKE 'EXIT-%' THEN
    v_version:=(pg_catalog.to_jsonb(NEW)->>'contact_version')::integer;
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.office_lifecycle_mail_policy policy
   WHERE policy.event_code=v_code AND policy.enabled AND policy.source_ready
    AND policy.delivery_owner='EXTERNAL_NOTICE_WORKER'
    AND policy.effective_from<=pg_catalog.now())
 OR NOT public.office_external_notice_source_valid(v_code,v_kind,NEW.id,v_user)
 OR public.office_external_notice_recipient(v_code,v_user,v_version) IS NULL
 THEN RETURN NEW; END IF;
 INSERT INTO public.office_external_notice_outbox(
   event_code,source_kind,source_proof_id,recipient_user_id,contact_version)
 VALUES(v_code,v_kind,NEW.id,v_user,v_version)
 ON CONFLICT(event_code,source_kind,source_proof_id,recipient_user_id) DO NOTHING;
 RETURN NEW;
END $source$;
REVOKE ALL ON FUNCTION public.office_external_notice_source_insert()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_external_on_signing
 AFTER INSERT ON public.office_onboarding_signing_proofs
 FOR EACH ROW EXECUTE FUNCTION public.office_external_notice_source_insert();
CREATE TRIGGER office_external_on_exit_notice
 AFTER INSERT ON public.office_exit_notification_proofs
 FOR EACH ROW EXECUTE FUNCTION public.office_external_notice_source_insert();
CREATE TRIGGER office_external_on_exit_settlement
 AFTER INSERT ON public.office_exit_settlement_proofs
 FOR EACH ROW EXECUTE FUNCTION public.office_external_notice_source_insert();
CREATE TRIGGER office_external_on_exit_document
 AFTER INSERT ON public.office_exit_document_proofs
 FOR EACH ROW EXECUTE FUNCTION public.office_external_notice_source_insert();
CREATE TRIGGER office_external_on_exit_completion
 AFTER INSERT ON public.office_exit_completion_proofs
 FOR EACH ROW EXECUTE FUNCTION public.office_external_notice_source_insert();

-- Revalidation is called just before provider submission, after claim commit.
-- Revoking consent or signing the document after claim denies delivery.
CREATE OR REPLACE FUNCTION public.office_external_notice_can_send(
 p_id uuid,p_token uuid,p_recipient_email text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $safe$
 SELECT EXISTS(
 SELECT 1 FROM public.office_external_notice_outbox outbox
 JOIN public.office_lifecycle_mail_policy policy ON policy.event_code=outbox.event_code
 WHERE outbox.id=p_id AND outbox.claim_token=p_token
 AND outbox.status='SENDING' AND outbox.claimed_at>pg_catalog.now()-interval '10 minutes'
 AND policy.enabled AND policy.source_ready
 AND policy.delivery_owner='EXTERNAL_NOTICE_WORKER'
 AND policy.effective_from<=pg_catalog.now()
 AND public.office_external_notice_source_valid(
  outbox.event_code,outbox.source_kind,outbox.source_proof_id,outbox.recipient_user_id)
 AND public.office_external_notice_recipient(
  outbox.event_code,outbox.recipient_user_id,outbox.contact_version)
 =pg_catalog.lower(pg_catalog.btrim(p_recipient_email))
 );
$safe$;
REVOKE ALL ON FUNCTION public.office_external_notice_can_send(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_external_notice_can_send(uuid,uuid,text)
 TO kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_external_notice_claim(p_limit integer DEFAULT 10)
RETURNS TABLE(
 outbox_id uuid, claim_token uuid, event_code text, recipient_email text,
 recipient_name text, source_reference text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $claim$
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
   RAISE EXCEPTION 'Bounded external mail batch must be 1..25';
 END IF;
 WITH stale AS (
  UPDATE public.office_external_notice_outbox q
  SET status='UNKNOWN',claim_token=NULL,finalized_at=pg_catalog.now()
  WHERE q.status='SENDING' AND q.claimed_at<pg_catalog.now()-interval '20 minutes'
  RETURNING q.id
 ) INSERT INTO public.office_external_notice_events(outbox_id,event_type)
   SELECT id,'STALE_UNKNOWN' FROM stale
   ON CONFLICT DO NOTHING;

 WITH rejected AS (
  UPDATE public.office_external_notice_outbox q
  SET status='SKIPPED',finalized_at=pg_catalog.now()
  WHERE q.status='PENDING'
    AND (q.created_at<pg_catalog.now()-interval '7 days'
      OR NOT EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy policy
        WHERE policy.event_code=q.event_code AND policy.enabled AND policy.source_ready
          AND policy.delivery_owner='EXTERNAL_NOTICE_WORKER')
      OR NOT public.office_external_notice_source_valid(
        q.event_code,q.source_kind,q.source_proof_id,q.recipient_user_id)
      OR public.office_external_notice_recipient(
        q.event_code,q.recipient_user_id,q.contact_version) IS NULL)
  RETURNING q.id
 ) INSERT INTO public.office_external_notice_events(outbox_id,event_type)
   SELECT id,'SKIPPED' FROM rejected
   ON CONFLICT DO NOTHING;

 RETURN QUERY WITH eligible AS (
  SELECT q.id
  FROM public.office_external_notice_outbox q
  JOIN public.office_lifecycle_mail_policy policy ON policy.event_code=q.event_code
  JOIN public.office_identity_users identity ON identity.user_id=q.recipient_user_id
  WHERE q.status='PENDING'
    AND policy.enabled AND policy.source_ready
    AND policy.delivery_owner='EXTERNAL_NOTICE_WORKER'
    AND policy.effective_from<=pg_catalog.now()
    AND q.created_at>=pg_catalog.now()-interval '7 days'
    AND identity.display_name IS NOT NULL
    AND pg_catalog.char_length(pg_catalog.btrim(identity.display_name)) BETWEEN 1 AND 160
    AND public.office_external_notice_source_valid(
      q.event_code,q.source_kind,q.source_proof_id,q.recipient_user_id)
    AND public.office_external_notice_recipient(
      q.event_code,q.recipient_user_id,q.contact_version) IS NOT NULL
  ORDER BY q.created_at,q.id
  LIMIT p_limit
  FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (
  UPDATE public.office_external_notice_outbox q
  SET status='SENDING',claim_token=pg_catalog.gen_random_uuid(),
    claimed_at=pg_catalog.now()
  FROM eligible e WHERE e.id=q.id
  RETURNING q.id,q.claim_token,q.event_code,q.source_kind,q.source_proof_id,
    q.recipient_user_id,q.contact_version
 ), logged AS (
  INSERT INTO public.office_external_notice_events AS ev(outbox_id,event_type)
  SELECT claimed.id,'CLAIMED' FROM claimed
  RETURNING ev.outbox_id
 )
 SELECT claimed.id,claimed.claim_token,claimed.event_code,
  public.office_external_notice_recipient(
   claimed.event_code,claimed.recipient_user_id,claimed.contact_version),
  pg_catalog.btrim(identity.display_name),
  claimed.source_kind||':'||claimed.source_proof_id::text
 FROM claimed
 JOIN logged ON logged.outbox_id=claimed.id
 JOIN public.office_identity_users identity ON identity.user_id=claimed.recipient_user_id;
END $claim$;
REVOKE ALL ON FUNCTION public.office_external_notice_claim(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_external_notice_claim(integer)
 TO kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_external_notice_finish(
 p_id uuid,p_token uuid,p_outcome text,p_provider_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $finish$
DECLARE v_status text;
BEGIN
 IF p_outcome NOT IN('SENT','REJECTED','UNKNOWN') THEN
  RAISE EXCEPTION 'Invalid provider result'; END IF;
 UPDATE public.office_external_notice_outbox q
 SET status=p_outcome,claim_token=NULL,finalized_at=pg_catalog.now(),
 provider_message_id=CASE WHEN p_outcome='SENT' THEN p_provider_id ELSE NULL END
 WHERE q.id=p_id AND q.claim_token=p_token AND q.status='SENDING'
 RETURNING q.status INTO v_status;
 IF v_status IS NULL THEN RAISE EXCEPTION 'Stale or invalid external notice claim'; END IF;
 INSERT INTO public.office_external_notice_events(
  outbox_id,event_type,provider_message_id)
 VALUES(p_id,CASE WHEN p_outcome='SENT' THEN 'ACCEPTED' ELSE p_outcome END,
  CASE WHEN p_outcome='SENT' THEN p_provider_id ELSE NULL END);
 RETURN true;
END $finish$;
REVOKE ALL ON FUNCTION public.office_external_notice_finish(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_external_notice_finish(uuid,uuid,text,text)
 TO kravia_office_backend;

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>81
 OR (SELECT count(*) FROM public.office_lifecycle_mail_policy
      WHERE delivery_owner='EXTERNAL_NOTICE_WORKER')<>7
 OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
 OR EXISTS(SELECT 1 FROM public.office_external_notice_outbox)
 THEN RAISE EXCEPTION 'External lifecycle coverage is not closed and disabled'; END IF;
END $postcheck$;

COMMENT ON TABLE public.office_external_notice_outbox IS
 'Seven source-verified Office events; separately consented recipients. No send without explicit Owner policy and two environment opt-ins. UNKNOWN is never retried.';


-- A typed reference manually entered by HR is NOT independently verified
-- provider issuance. No ONB-04 message can be claimed until an active Owner,
-- different from the request recorder and document creator, checks the real
-- provider record and records the evidence. This gate is intentionally
-- vendor-neutral until an approved provider adapter is connected.
CREATE TABLE public.office_signing_issuance_reviews (
 delivery_event_id uuid PRIMARY KEY
  REFERENCES public.office_document_delivery_events(id) ON DELETE RESTRICT,
 signing_proof_id bigint NOT NULL UNIQUE
  REFERENCES public.office_onboarding_signing_proofs(id) ON DELETE RESTRICT,
 reviewed_by uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN('VERIFIED','REJECTED','REVOKED')),
 evidence_reference text NOT NULL
  CHECK(char_length(btrim(evidence_reference)) BETWEEN 12 AND 500),
 review_reason text NOT NULL
  CHECK(char_length(btrim(review_reason)) BETWEEN 12 AND 500),
 reviewed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 revoked_by uuid REFERENCES public.office_identity_users(user_id),
 revoked_at timestamptz,
 revoke_reason text,
 CHECK((status='REVOKED')=(revoked_at IS NOT NULL))
);
ALTER TABLE public.office_signing_issuance_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_signing_issuance_reviews
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_signing_issuance_reviews TO service_role;

CREATE TABLE public.office_signing_issuance_review_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 delivery_event_id uuid NOT NULL
  REFERENCES public.office_document_delivery_events(id) ON DELETE RESTRICT,
 actor_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN('VERIFIED','REJECTED','REVOKED')),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 500),
 happened_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(delivery_event_id,event_type)
);
ALTER TABLE public.office_signing_issuance_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_signing_issuance_review_events
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_signing_issuance_review_events TO service_role;

-- Keep the immutable original document/provider checks, but require separate
-- attestation at EVERY claim, including after Owner review and after revocation.
ALTER FUNCTION public.office_onboarding_signing_source_valid(bigint)
 RENAME TO office_onboarding_signing_domain_evidence_valid;
CREATE OR REPLACE FUNCTION public.office_onboarding_signing_source_valid(
 p_id bigint
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $verified$
 SELECT public.office_onboarding_signing_domain_evidence_valid(p_id)
 AND EXISTS (
  SELECT 1 FROM public.office_signing_issuance_reviews review
  JOIN public.office_onboarding_signing_proofs proof
    ON proof.id=review.signing_proof_id
  JOIN public.office_document_delivery_events delivery
    ON delivery.id=review.delivery_event_id
  JOIN public.office_document_instances document
    ON document.id=proof.document_instance_id
  WHERE proof.id=p_id
    AND proof.delivery_event_id=delivery.id
    AND review.status='VERIFIED'
    AND review.revoked_at IS NULL
    AND review.reviewed_at IS NOT NULL
    AND review.reviewed_by IS DISTINCT FROM delivery.actor_user_id
    AND review.reviewed_by IS DISTINCT FROM document.created_by
    AND review.reviewed_by IS DISTINCT FROM proof.employee_user_id
 );
$verified$;
REVOKE ALL ON FUNCTION public.office_onboarding_signing_source_valid(bigint)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_onboarding_signing_source_valid(bigint)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_signing_issuance_review(
 p_actor uuid,p_delivery uuid,p_approve boolean,p_evidence text,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $review$
DECLARE
 v_delivery public.office_document_delivery_events%rowtype;
 v_proof public.office_onboarding_signing_proofs%rowtype;
 v_document public.office_document_instances%rowtype;
 v_evidence text:=btrim(coalesce(p_evidence,''));
 v_reason text:=btrim(coalesce(p_reason,''));
BEGIN
 IF p_approve IS NULL
 OR char_length(v_evidence) NOT BETWEEN 12 AND 500
 OR char_length(v_reason) NOT BETWEEN 12 AND 500
 OR NOT EXISTS (
   SELECT 1 FROM public.office_identity_users actor
   JOIN public.office_user_roles role ON role.user_id=actor.user_id
   WHERE actor.user_id=p_actor AND actor.status='ACTIVE'
     AND role.role='OWNER'
     AND (role.expires_at IS NULL OR role.expires_at>pg_catalog.now())
 )
 THEN RAISE EXCEPTION 'Independent current Owner verification and source reference required'; END IF;

 SELECT * INTO v_delivery FROM public.office_document_delivery_events
 WHERE id=p_delivery FOR UPDATE;
 SELECT * INTO v_proof FROM public.office_onboarding_signing_proofs
 WHERE delivery_event_id=p_delivery;
 SELECT * INTO v_document FROM public.office_document_instances
 WHERE id=v_proof.document_instance_id;
 IF v_delivery.id IS NULL OR v_proof.id IS NULL OR v_document.id IS NULL
 OR v_delivery.actor_user_id IS NULL
 OR p_actor IS NOT DISTINCT FROM v_delivery.actor_user_id
 OR p_actor IS NOT DISTINCT FROM v_document.created_by
 OR p_actor IS NOT DISTINCT FROM v_proof.employee_user_id
 OR v_document.status<>'SIGNING'
 OR NOT public.office_onboarding_signing_domain_evidence_valid(v_proof.id)
 OR EXISTS (
   SELECT 1 FROM public.office_signing_issuance_reviews
   WHERE delivery_event_id=p_delivery
 ) THEN RAISE EXCEPTION 'Independent current provider source cannot be attested'; END IF;

 INSERT INTO public.office_signing_issuance_reviews(
   delivery_event_id,signing_proof_id,reviewed_by,status,evidence_reference,review_reason
 ) VALUES(
   p_delivery,v_proof.id,p_actor,
   CASE WHEN p_approve THEN 'VERIFIED' ELSE 'REJECTED' END,
   v_evidence,v_reason
 );
 INSERT INTO public.office_signing_issuance_review_events(
   delivery_event_id,actor_user_id,event_type,reason
 ) VALUES(
   p_delivery,p_actor,CASE WHEN p_approve THEN 'VERIFIED' ELSE 'REJECTED' END,
   v_reason
 );

 IF p_approve
   AND public.office_external_notice_source_valid(
     'ONB-04','ONBOARDING_SIGNING',v_proof.id,v_proof.employee_user_id)
   AND public.office_external_notice_recipient(
     'ONB-04',v_proof.employee_user_id,NULL) IS NOT NULL
   AND EXISTS(
    SELECT 1 FROM public.office_lifecycle_mail_policy policy
    WHERE policy.event_code='ONB-04' AND policy.enabled AND policy.source_ready
      AND policy.delivery_owner='EXTERNAL_NOTICE_WORKER'
      AND policy.effective_from<=pg_catalog.now()
   ) THEN
   INSERT INTO public.office_external_notice_outbox(
     event_code,source_kind,source_proof_id,recipient_user_id,contact_version
   ) VALUES('ONB-04','ONBOARDING_SIGNING',v_proof.id,v_proof.employee_user_id,NULL)
   ON CONFLICT(event_code,source_kind,source_proof_id,recipient_user_id) DO NOTHING;
 END IF;
 RETURN true;
END $review$;
REVOKE ALL ON FUNCTION public.office_signing_issuance_review(uuid,uuid,boolean,text,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_signing_issuance_review(uuid,uuid,boolean,text,text)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_signing_issuance_revoke(
 p_actor uuid,p_delivery uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $revoke$
DECLARE v_reason text:=btrim(coalesce(p_reason,''));v_id uuid;
BEGIN
 IF char_length(v_reason) NOT BETWEEN 12 AND 500
 OR NOT EXISTS(
  SELECT 1 FROM public.office_identity_users actor
  JOIN public.office_user_roles role ON role.user_id=actor.user_id
  WHERE actor.user_id=p_actor AND actor.status='ACTIVE' AND role.role='OWNER'
    AND (role.expires_at IS NULL OR role.expires_at>pg_catalog.now())
 ) THEN RAISE EXCEPTION 'Current Owner revocation evidence required'; END IF;
 UPDATE public.office_signing_issuance_reviews
 SET status='REVOKED',revoked_by=p_actor,revoked_at=pg_catalog.now(),
     revoke_reason=v_reason
 WHERE delivery_event_id=p_delivery AND status='VERIFIED'
 RETURNING delivery_event_id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'No active provider attestation to revoke'; END IF;
 INSERT INTO public.office_signing_issuance_review_events(
  delivery_event_id,actor_user_id,event_type,reason
 ) VALUES(p_delivery,p_actor,'REVOKED',v_reason);
 RETURN true;
END $revoke$;
REVOKE ALL ON FUNCTION public.office_signing_issuance_revoke(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_signing_issuance_revoke(uuid,uuid,text)
 TO service_role;

COMMENT ON TABLE public.office_signing_issuance_reviews IS
 'Independent Owner attestation of a genuine signing request recorded in the provider console. Does not issue a provider link and never bypasses private Office mail policy.';
