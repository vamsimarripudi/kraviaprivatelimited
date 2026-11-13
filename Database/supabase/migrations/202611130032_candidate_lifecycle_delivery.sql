-- Candidate-only Office hiring transactional delivery. Forward-only after 031.
-- Unlike internal employee mail, external recipients require separately attested
-- contact authority and an independently approved, opt-in event policy.
-- No existing candidates are authorized, no source records are replayed, and
-- no sending flag is changed by this migration.
DO $state$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy)<>81
   OR (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>59
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_outbox) THEN
   RAISE EXCEPTION 'Unexpected lifecycle state. Do not apply candidate delivery migration';
 END IF;
END $state$;

CREATE TABLE public.office_candidate_contact_authorizations(
 candidate_id uuid PRIMARY KEY REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
 recipient_email text NOT NULL,
 authority_basis text NOT NULL CHECK(authority_basis IN
  ('SIGNED_APPLICATION','CANDIDATE_EMAIL_REPLY','SECURE_CONTACT_CONFIRMATION')),
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference))>=12),
 authorized_by uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 authorized_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(length(recipient_email)<=320 AND recipient_email=lower(btrim(recipient_email))
  AND recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][A-Za-z]{2,}$'),
 CHECK(expires_at>authorized_at AND expires_at<=authorized_at+interval '90 days')
);
ALTER TABLE public.office_candidate_contact_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_candidate_contact_authorizations FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON public.office_candidate_contact_authorizations TO service_role;

CREATE TABLE public.office_candidate_lifecycle_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_code text NOT NULL REFERENCES public.office_lifecycle_mail_policy(event_code),
 source_event_id bigint NOT NULL REFERENCES public.office_recruitment_events(id) ON DELETE RESTRICT,
 candidate_id uuid NOT NULL REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
 recipient_email text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','SENDING','SENT','REJECTED','UNKNOWN')),
 claim_token uuid,
 claimed_at timestamptz,
 provider_message_id text,
 submitted_at timestamptz,
 finalized_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_code,source_event_id,candidate_id),
 CHECK(event_code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04',
                     'HIRE-05','HIRE-06','HIRE-09','HIRE-10'))
);
ALTER TABLE public.office_candidate_lifecycle_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_candidate_lifecycle_outbox FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE INDEX office_candidate_lifecycle_claim_queue
 ON public.office_candidate_lifecycle_outbox(status,created_at)
 WHERE status IN('PENDING','SENDING');

-- A real immutable recruitment event, a documented candidate contact
-- authorization, and an independently enabled template are all required.
CREATE OR REPLACE FUNCTION public.office_candidate_lifecycle_enqueue(
 p_event public.office_recruitment_events
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $enqueue$
DECLARE v_code text; v_contact public.office_candidate_contact_authorizations%rowtype;
BEGIN
 v_code:=CASE p_event.event_type
   WHEN 'CANDIDATE_CREATED' THEN 'HIRE-01'
   WHEN 'INTERVIEW_SCHEDULED' THEN 'HIRE-02'
   WHEN 'INTERVIEW_RESCHEDULED' THEN 'HIRE-03'
   WHEN 'INTERVIEW_CANCELLED' THEN 'HIRE-04'
   WHEN 'CANDIDATE_DOCUMENT_REQUESTED' THEN 'HIRE-05'
   WHEN 'CANDIDATE_DOCUMENT_REVIEWED' THEN 'HIRE-06'
   WHEN 'OFFER_ACCEPTANCE_RECORDED' THEN 'HIRE-09'
   WHEN 'CANDIDATE_STATUS_CHANGED' THEN 'HIRE-10'
   ELSE NULL END;
 IF v_code IS NULL OR p_event.candidate_id IS NULL THEN RETURN; END IF;
 IF v_code='HIRE-06' AND p_event.metadata->>'decision' NOT IN ('REJECTED') THEN RETURN; END IF;
 IF v_code='HIRE-10' AND p_event.new_status NOT IN ('REJECTED','DECLINED','WITHDRAWN','HIRED') THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy p
  WHERE p.event_code=v_code AND p.source_ready AND p.enabled AND p.effective_from<=now()) THEN RETURN; END IF;
 SELECT * INTO v_contact FROM public.office_candidate_contact_authorizations a
 WHERE a.candidate_id=p_event.candidate_id AND a.revoked_at IS NULL
  AND a.expires_at>now();
 IF v_contact.candidate_id IS NULL THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_candidates c
   WHERE c.id=p_event.candidate_id AND c.email=v_contact.recipient_email) THEN RETURN; END IF;
 INSERT INTO public.office_candidate_lifecycle_outbox(
  event_code,source_event_id,candidate_id,recipient_email
 ) VALUES(v_code,p_event.id,p_event.candidate_id,v_contact.recipient_email)
 ON CONFLICT(event_code,source_event_id,candidate_id) DO NOTHING;
END;
$enqueue$;
REVOKE ALL ON FUNCTION public.office_candidate_lifecycle_enqueue(public.office_recruitment_events)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_candidate_lifecycle_event_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $event$
BEGIN
 PERFORM public.office_candidate_lifecycle_enqueue(NEW);
 RETURN NEW;
END $event$;
REVOKE ALL ON FUNCTION public.office_candidate_lifecycle_event_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_candidate_lifecycle_on_recruitment_event
 AFTER INSERT ON public.office_recruitment_events
 FOR EACH ROW EXECUTE FUNCTION public.office_candidate_lifecycle_event_source();

-- Document requests previously upserted their status without an immutable
-- recruitment event. Capture the actual new or re-requested status only.
CREATE OR REPLACE FUNCTION public.office_candidate_document_requested_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $document$
DECLARE c public.office_candidates%rowtype;
BEGIN
 IF NEW.status<>'REQUESTED' OR (TG_OP='UPDATE' AND OLD.status='REQUESTED') THEN
  RETURN NEW;
 END IF;
 SELECT * INTO c FROM public.office_candidates WHERE id=NEW.candidate_id;
 IF c.id IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.office_recruitment_events(
  actor_user_id,requisition_id,candidate_id,event_type,metadata
 ) VALUES(
  NEW.requested_by,c.requisition_id,c.id,'CANDIDATE_DOCUMENT_REQUESTED',
  jsonb_build_object('request_id',NEW.id,'document_type',NEW.document_type)
 );
 RETURN NEW;
END $document$;
REVOKE ALL ON FUNCTION public.office_candidate_document_requested_event()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_candidate_lifecycle_on_document_requested
 AFTER INSERT OR UPDATE OF status ON public.office_candidate_document_requests
 FOR EACH ROW EXECUTE FUNCTION public.office_candidate_document_requested_event();

-- Owner-only evidence attestation. It documents a candidate-provided
-- contact channel; it does not pretend to be cryptographic mailbox proof.
-- Sending remains disabled until a separate Owner policy approval and worker
-- flag. No candidate record or authorization is backfilled.
CREATE OR REPLACE FUNCTION public.office_candidate_contact_authorize(
 p_actor uuid,p_candidate uuid,p_basis text,p_evidence text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $authorize$
DECLARE c public.office_candidates%rowtype; v_basis text:=upper(btrim(COALESCE(p_basis,'')));
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.office_identity_users i
   JOIN public.office_user_roles r ON r.user_id=i.user_id
   WHERE i.user_id=p_actor AND i.status='ACTIVE' AND r.role='OWNER'
     AND (r.expires_at IS NULL OR r.expires_at>now())) THEN
    RAISE EXCEPTION 'Current Owner approval is required for external candidate contact';
 END IF;
 IF v_basis NOT IN ('SIGNED_APPLICATION','CANDIDATE_EMAIL_REPLY','SECURE_CONTACT_CONFIRMATION')
    OR length(btrim(COALESCE(p_evidence,'')))<12 THEN
   RAISE EXCEPTION 'Documented candidate contact authority is required';
 END IF;
 SELECT * INTO c FROM public.office_candidates WHERE id=p_candidate FOR UPDATE;
 IF c.id IS NULL OR c.status IN('WITHDRAWN','REJECTED','DECLINED','HIRED') THEN
   RAISE EXCEPTION 'Eligible candidate is required';
 END IF;
 INSERT INTO public.office_candidate_contact_authorizations(
  candidate_id,recipient_email,authority_basis,evidence_reference,authorized_by,expires_at
 ) VALUES(
  p_candidate,lower(btrim(c.email)),v_basis,btrim(p_evidence),p_actor,now()+interval '90 days'
 ) ON CONFLICT(candidate_id) DO UPDATE
 SET recipient_email=excluded.recipient_email,
     authority_basis=excluded.authority_basis,
     evidence_reference=excluded.evidence_reference,
     authorized_by=excluded.authorized_by,authorized_at=now(),
     expires_at=now()+interval '90 days',revoked_at=NULL;
 -- If the application was created before contact was documented, allow one
 -- explicit, authorized receipt after approval; never replay other events.
 PERFORM public.office_candidate_lifecycle_enqueue(e)
 FROM public.office_recruitment_events e
 WHERE e.candidate_id=p_candidate AND e.event_type='CANDIDATE_CREATED'
 ORDER BY e.id DESC LIMIT 1;
END $authorize$;
REVOKE ALL ON FUNCTION public.office_candidate_contact_authorize(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_candidate_contact_authorize(uuid,uuid,text,text) TO service_role;

-- Claim checks the live canonical source, not metadata supplied by a browser.
-- A changed candidate email, contact revocation, stale interview, inactive
-- policy or unapproved offer cannot be sent, even if previously queued.
CREATE OR REPLACE FUNCTION public.office_candidate_lifecycle_source_valid(
 p_outbox public.office_candidate_lifecycle_outbox
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $valid$
DECLARE e public.office_recruitment_events%rowtype;
BEGIN
 SELECT * INTO e FROM public.office_recruitment_events
  WHERE id=p_outbox.source_event_id AND candidate_id=p_outbox.candidate_id;
 IF e.id IS NULL THEN RETURN false; END IF;
 IF p_outbox.event_code IN ('HIRE-02','HIRE-03','HIRE-04','HIRE-05','HIRE-06')
   AND NOT EXISTS(SELECT 1 FROM public.office_candidates candidate
     WHERE candidate.id=e.candidate_id
       AND candidate.status IN ('APPLIED','SCREENING','INTERVIEW','SELECTED',
                                'OFFER_PENDING','OFFERED')) THEN
   RETURN false; -- a stale hiring instruction is never sent after closure
 END IF;
 IF p_outbox.event_code='HIRE-01' THEN
   RETURN e.event_type='CANDIDATE_CREATED';
 ELSIF p_outbox.event_code IN('HIRE-02','HIRE-03','HIRE-04') THEN
   IF (p_outbox.event_code='HIRE-02' AND e.event_type<>'INTERVIEW_SCHEDULED')
      OR (p_outbox.event_code='HIRE-03' AND e.event_type<>'INTERVIEW_RESCHEDULED')
      OR (p_outbox.event_code='HIRE-04' AND e.event_type<>'INTERVIEW_CANCELLED') THEN RETURN false; END IF;
   RETURN EXISTS(
    SELECT 1 FROM public.office_candidate_interviews i
    WHERE i.id=(e.metadata->>'interview_id')::uuid
      AND i.candidate_id=e.candidate_id
      AND (
        (p_outbox.event_code='HIRE-04' AND i.status='CANCELLED')
        OR (p_outbox.event_code='HIRE-02' AND i.status='SCHEDULED'
           AND i.scheduled_start=(e.metadata->>'scheduled_start')::timestamptz
           AND i.scheduled_start>now())
        OR (p_outbox.event_code='HIRE-03' AND i.status='SCHEDULED'
           AND i.scheduled_start=(e.metadata->>'new_start')::timestamptz
           AND i.scheduled_start>now())
      )
   );
 ELSIF p_outbox.event_code='HIRE-05' THEN
   RETURN e.event_type='CANDIDATE_DOCUMENT_REQUESTED'
     AND EXISTS(SELECT 1 FROM public.office_candidate_document_requests d
       WHERE d.id=(e.metadata->>'request_id')::uuid AND d.candidate_id=e.candidate_id
       AND d.status='REQUESTED');
 ELSIF p_outbox.event_code='HIRE-06' THEN
   RETURN e.event_type='CANDIDATE_DOCUMENT_REVIEWED'
     AND e.metadata->>'decision'='REJECTED'
     AND EXISTS(SELECT 1 FROM public.office_candidate_document_requests d
       WHERE d.id=(e.metadata->>'request_id')::uuid AND d.candidate_id=e.candidate_id
       AND d.status='REJECTED');
 ELSIF p_outbox.event_code='HIRE-09' THEN
   RETURN e.event_type='OFFER_ACCEPTANCE_RECORDED'
     AND length(btrim(COALESCE(e.metadata->>'evidence_reference','')))>2
     AND EXISTS(
       SELECT 1 FROM public.office_offer_proposals offer
       WHERE offer.id=e.offer_id AND offer.candidate_id=e.candidate_id
         AND EXISTS(SELECT 1 FROM public.office_candidates candidate
           WHERE candidate.id=e.candidate_id
             AND candidate.status IN ('ONBOARDING','HIRED'))
         AND offer.accepted_at IS NOT NULL
         AND offer.status IN('ONBOARDING','HIRED')
         AND offer.approved_by IS NOT NULL AND offer.approved_at IS NOT NULL
     );
 ELSIF p_outbox.event_code='HIRE-10' THEN
   RETURN e.event_type='CANDIDATE_STATUS_CHANGED'
     AND e.new_status IN('REJECTED','DECLINED','WITHDRAWN','HIRED')
     AND EXISTS(SELECT 1 FROM public.office_candidates c
       WHERE c.id=e.candidate_id AND c.status=e.new_status);
 END IF;
 RETURN false;
EXCEPTION WHEN invalid_text_representation THEN
 RETURN false;
END $valid$;
REVOKE ALL ON FUNCTION public.office_candidate_lifecycle_source_valid(public.office_candidate_lifecycle_outbox)
 FROM PUBLIC,anon,authenticated,kravia_office_backend,service_role;

CREATE OR REPLACE FUNCTION public.office_candidate_lifecycle_claim(p_limit integer)
RETURNS TABLE(
 outbox_id uuid,claim_token uuid,event_code text,recipient_email text,
 recipient_name text,source_reference text,scheduled_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $claim$
DECLARE v public.office_candidate_lifecycle_outbox%rowtype;
BEGIN
 IF p_limit<1 OR p_limit>25 THEN RAISE EXCEPTION 'Invalid claim limit'; END IF;
 UPDATE public.office_candidate_lifecycle_outbox
 SET status='UNKNOWN',finalized_at=now()
 WHERE status='SENDING' AND claimed_at<now()-interval '15 minutes';
 FOR v IN
  SELECT o.* FROM public.office_candidate_lifecycle_outbox o
  WHERE o.status='PENDING'
    AND EXISTS(SELECT 1 FROM public.office_candidate_contact_authorizations authority
      JOIN public.office_candidates candidate ON candidate.id=authority.candidate_id
      WHERE authority.candidate_id=o.candidate_id
        AND authority.recipient_email=o.recipient_email
        AND candidate.email=o.recipient_email
        AND authority.revoked_at IS NULL AND authority.expires_at>now())
    AND EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy p
      WHERE p.event_code=o.event_code AND p.source_ready AND p.enabled AND p.effective_from<=now())
    AND public.office_candidate_lifecycle_source_valid(o)
  ORDER BY o.created_at,o.id LIMIT p_limit FOR UPDATE OF o SKIP LOCKED
 LOOP
  UPDATE public.office_candidate_lifecycle_outbox o
    SET status='SENDING',claim_token=gen_random_uuid(),claimed_at=now()
  WHERE o.id=v.id RETURNING o.* INTO v;
  RETURN QUERY SELECT v.id,v.claim_token,v.event_code,v.recipient_email,
    c.full_name,'office_recruitment_events:'||v.source_event_id::text,
    CASE
      WHEN v.event_code='HIRE-02' THEN (e.metadata->>'scheduled_start')::timestamptz
      WHEN v.event_code='HIRE-03' THEN (e.metadata->>'new_start')::timestamptz
      ELSE NULL::timestamptz
    END
    FROM public.office_candidates c
    JOIN public.office_recruitment_events e ON e.id=v.source_event_id
    WHERE c.id=v.candidate_id;
 END LOOP;
END $claim$;
REVOKE ALL ON FUNCTION public.office_candidate_lifecycle_claim(integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_candidate_lifecycle_claim(integer) TO kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_candidate_lifecycle_finish(
 p_outbox uuid,p_token uuid,p_result text,p_message_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $finish$
BEGIN
 IF p_result NOT IN('SENT','UNKNOWN','REJECTED') THEN RAISE EXCEPTION 'Invalid delivery status'; END IF;
 UPDATE public.office_candidate_lifecycle_outbox
 SET status=p_result,provider_message_id=left(p_message_id,320),
     submitted_at=CASE WHEN p_result='SENT' THEN now() ELSE NULL END,
     finalized_at=now(),claim_token=NULL
 WHERE id=p_outbox AND status='SENDING' AND claim_token=p_token;
 IF NOT FOUND THEN RAISE EXCEPTION 'Claim token is stale or already finalised'; END IF;
END $finish$;
REVOKE ALL ON FUNCTION public.office_candidate_lifecycle_finish(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_candidate_lifecycle_finish(uuid,uuid,text,text)
 TO kravia_office_backend;

UPDATE public.office_lifecycle_mail_policy
SET source_ready=true
WHERE event_code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04','HIRE-05','HIRE-06','HIRE-09','HIRE-10')
  AND NOT enabled AND NOT source_ready;

DO $final$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>67
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
    OR EXISTS(SELECT 1 FROM public.office_candidate_lifecycle_outbox) THEN
  RAISE EXCEPTION 'Expected 67 source-mapped kinds, all disabled and no external sends';
 END IF;
END $final$;
