-- Recruitment communications require actual candidate consent and independent
-- verification. Dedicated external-recipient outbox; generic Office lifecycle
-- worker only handles active internal identities. Zero provider I/O / replay.
-- Run after forward migration 032 and never modify previously applied scripts.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
  OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>65
  OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
  OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox)
 THEN RAISE EXCEPTION 'Candidate notification schema requires 65 mapped, all disabled'; END IF;
END;$preflight$;

ALTER TABLE public.office_lifecycle_mail_policy
 DROP CONSTRAINT office_lifecycle_mail_policy_delivery_owner_check,
 ADD CONSTRAINT office_lifecycle_mail_policy_delivery_owner_check
 CHECK(delivery_owner IN ('LIFECYCLE_WORKER','FIRST_PARTY_AUTH','CANDIDATE_WORKER'));

ALTER TABLE public.office_lifecycle_mail_policy
 DROP CONSTRAINT office_lifecycle_mail_prevent_duplicate_auth_dispatch,
 ADD CONSTRAINT office_lifecycle_mail_prevent_duplicate_auth_dispatch
 CHECK(NOT enabled OR delivery_owner<>'FIRST_PARTY_AUTH');

-- No existing candidate is automatically opted in. An authentic candidate
-- consent document/reference must be recorded, then independently verified.
CREATE TABLE public.office_candidate_mail_consents(
 candidate_id uuid PRIMARY KEY REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
 consent_reference text NOT NULL CHECK(length(btrim(consent_reference)) BETWEEN 12 AND 300),
 obtained_at timestamptz NOT NULL,
 recorded_by uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 verified_by uuid REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 verified_at timestamptz,
 status text NOT NULL DEFAULT 'PENDING'
   CHECK(status IN ('PENDING','VERIFIED','REJECTED','REVOKED')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 12 AND 500),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 CHECK(verified_by IS NULL OR verified_by<>recorded_by),
 CHECK(status<>'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
 CHECK(obtained_at<=recorded_at+interval '1 minute')
);
ALTER TABLE public.office_candidate_mail_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_candidate_mail_consents FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT SELECT,INSERT,UPDATE ON public.office_candidate_mail_consents TO service_role;

CREATE TABLE public.office_candidate_mail_outbox(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 source_event_id bigint NOT NULL REFERENCES public.office_recruitment_events(id) ON DELETE RESTRICT,
 event_code text NOT NULL REFERENCES public.office_lifecycle_mail_policy(event_code)
   CHECK(event_code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04','HIRE-05','HIRE-06','HIRE-08','HIRE-09','HIRE-10')),
 candidate_id uuid NOT NULL REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
 recipient_kind text NOT NULL DEFAULT 'CANDIDATE' CHECK(recipient_kind IN('CANDIDATE')),
 status text NOT NULL DEFAULT 'PENDING'
   CHECK(status IN('PENDING','SENDING','SENT','REJECTED','UNKNOWN','SKIPPED')),
 claim_token uuid,
 claimed_at timestamptz,
 finalized_at timestamptz,
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
 UNIQUE(source_event_id,event_code,recipient_kind),
 CHECK(status NOT IN ('SENT','REJECTED','UNKNOWN','SKIPPED') OR finalized_at IS NOT NULL)
);
CREATE INDEX office_candidate_mail_claim_queue ON public.office_candidate_mail_outbox(status,created_at);
ALTER TABLE public.office_candidate_mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_candidate_mail_outbox FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.office_candidate_mail_outbox TO kravia_office_backend;

CREATE TABLE public.office_candidate_mail_delivery_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 outbox_id uuid NOT NULL REFERENCES public.office_candidate_mail_outbox(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN('CLAIMED','ACCEPTED','REJECTED','UNKNOWN','STALE_UNKNOWN','SKIPPED')),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.office_candidate_mail_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_candidate_mail_delivery_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.office_candidate_mail_delivery_events TO kravia_office_backend;

-- Service-only approval entry point with real evidence. Reviewer must differ
-- from recorder, be active, and have hiring offer-review permission.
CREATE OR REPLACE FUNCTION public.office_candidate_mail_consent_record(
 p_actor uuid,p_candidate uuid,p_reference text,p_obtained_at timestamptz,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $record$
DECLARE v_department text;
BEGIN
 SELECT requisition.department_code INTO v_department
 FROM public.office_candidates candidate
 JOIN public.office_hiring_requisitions requisition ON requisition.id=candidate.requisition_id
 WHERE candidate.id=p_candidate;
 IF v_department IS NULL
   OR NOT EXISTS(SELECT 1 FROM public.office_identity_users
    WHERE user_id=p_actor AND status='ACTIVE')
   OR NOT (
     public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',NULL,NULL)
     OR public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',v_department,NULL))
 THEN RAISE EXCEPTION 'Active authorised hiring operator is required'; END IF;
 IF length(btrim(coalesce(p_reference,''))) NOT BETWEEN 12 AND 300
  OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 500
  OR p_obtained_at IS NULL OR p_obtained_at>pg_catalog.now()+interval '1 minute'
 THEN RAISE EXCEPTION 'Actual candidate email-consent evidence is required'; END IF;
 INSERT INTO public.office_candidate_mail_consents(
  candidate_id,consent_reference,obtained_at,recorded_by,reason,status
 ) VALUES(p_candidate,btrim(p_reference),p_obtained_at,p_actor,btrim(p_reason),'PENDING')
 ON CONFLICT(candidate_id) DO UPDATE SET
  consent_reference=excluded.consent_reference,obtained_at=excluded.obtained_at,
  recorded_by=excluded.recorded_by,recorded_at=pg_catalog.now(),
  verified_by=NULL,verified_at=NULL,status='PENDING',reason=excluded.reason,
  updated_at=pg_catalog.now();
 RETURN true;
END;
$record$;

CREATE OR REPLACE FUNCTION public.office_candidate_mail_consent_decide(
 p_actor uuid,p_candidate uuid,p_approve boolean,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $decide$
DECLARE v_department text;v_record public.office_candidate_mail_consents%rowtype;
BEGIN
 SELECT requisition.department_code INTO v_department
 FROM public.office_candidates candidate
 JOIN public.office_hiring_requisitions requisition ON requisition.id=candidate.requisition_id
 WHERE candidate.id=p_candidate;
 SELECT * INTO v_record FROM public.office_candidate_mail_consents
 WHERE candidate_id=p_candidate FOR UPDATE;
 IF v_record.candidate_id IS NULL OR v_record.status<>'PENDING' OR v_record.recorded_by=p_actor
   OR v_department IS NULL OR NOT EXISTS(
     SELECT 1 FROM public.office_identity_users WHERE user_id=p_actor AND status='ACTIVE')
   OR NOT (
     public.office_effective_permission(p_actor,'hiring.offer.review','COMPANY',NULL,NULL)
     OR public.office_effective_permission(p_actor,'hiring.offer.review','DEPARTMENT',v_department,NULL)
   ) THEN RAISE EXCEPTION 'Independent hiring consent review is required'; END IF;
 IF length(btrim(coalesce(p_reason,'')))<12 THEN
   RAISE EXCEPTION 'Documented consent review reason is required'; END IF;
 UPDATE public.office_candidate_mail_consents
 SET status=CASE WHEN p_approve THEN 'VERIFIED' ELSE 'REJECTED' END,
  verified_by=p_actor,verified_at=pg_catalog.now(),reason=btrim(p_reason),
  updated_at=pg_catalog.now()
 WHERE candidate_id=p_candidate;
 RETURN true;
END;
$decide$;

CREATE OR REPLACE FUNCTION public.office_candidate_mail_consent_revoke(
 p_actor uuid,p_candidate uuid,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $revoke$
DECLARE v_department text;
BEGIN
 SELECT requisition.department_code INTO v_department
 FROM public.office_candidates candidate
 JOIN public.office_hiring_requisitions requisition ON requisition.id=candidate.requisition_id
 WHERE candidate.id=p_candidate;
 IF v_department IS NULL OR length(btrim(coalesce(p_reason,'')))<12
  OR NOT (public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',NULL,NULL)
       OR public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',v_department,NULL))
 THEN RAISE EXCEPTION 'Authorised consent withdrawal requires a documented reason'; END IF;
 UPDATE public.office_candidate_mail_consents
 SET status='REVOKED',reason=btrim(p_reason),updated_at=pg_catalog.now()
 WHERE candidate_id=p_candidate;
 RETURN true;
END;
$revoke$;
REVOKE ALL ON FUNCTION public.office_candidate_mail_consent_record(uuid,uuid,text,timestamptz,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
REVOKE ALL ON FUNCTION public.office_candidate_mail_consent_decide(uuid,uuid,boolean,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
REVOKE ALL ON FUNCTION public.office_candidate_mail_consent_revoke(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_candidate_mail_consent_record(uuid,uuid,text,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.office_candidate_mail_consent_decide(uuid,uuid,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.office_candidate_mail_consent_revoke(uuid,uuid,text) TO service_role;

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>65
  OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
  OR EXISTS(SELECT 1 FROM public.office_candidate_mail_outbox)
  OR EXISTS(SELECT 1 FROM public.office_candidate_mail_consents)
 THEN RAISE EXCEPTION 'Candidate mail consent installed but unexpectedly activated or backfilled'; END IF;
END;
$postcheck$;
