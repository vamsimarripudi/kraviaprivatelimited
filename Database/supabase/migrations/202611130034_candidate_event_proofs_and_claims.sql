-- Canonical external-candidate mail source routes. Separate from internal
-- Office notices and protected by independently verified candidate consent.
-- After 033; does not enable policy, deliver email, replay historical events,
-- or turn recruitment staff action into proof of candidate consent.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>65
   OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
   OR EXISTS(SELECT 1 FROM public.office_candidate_mail_outbox)
 THEN RAISE EXCEPTION 'Expected 65 disabled mappings and no candidate mail before hiring routes'; END IF;
END;$preflight$;

UPDATE public.office_lifecycle_mail_policy
SET source_ready=true,delivery_owner='CANDIDATE_WORKER'
WHERE event_code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04','HIRE-05','HIRE-06','HIRE-08','HIRE-09','HIRE-10')
 AND NOT source_ready AND NOT enabled;

-- Genuine source transitions only: no invented appointment or candidate mails.
CREATE OR REPLACE FUNCTION public.office_interview_reschedule(
 p_actor uuid,p_interview uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $reschedule$
DECLARE v public.office_candidate_interviews%rowtype;c public.office_candidates%rowtype;
 d text;
BEGIN
 SELECT * INTO v FROM public.office_candidate_interviews WHERE id=p_interview FOR UPDATE;
 SELECT * INTO c FROM public.office_candidates WHERE id=v.candidate_id;
 SELECT department_code INTO d FROM public.office_hiring_requisitions WHERE id=c.requisition_id;
 IF v.id IS NULL OR v.status<>'SCHEDULED' OR c.status IN('REJECTED','WITHDRAWN','HIRED')
    OR d IS NULL OR
    NOT (public.office_effective_permission(p_actor,'hiring.interview.manage','COMPANY',NULL,NULL)
      OR public.office_effective_permission(p_actor,'hiring.interview.manage','DEPARTMENT',d,NULL))
 THEN RAISE EXCEPTION 'Active governed interview and hiring permission required'; END IF;
 IF p_starts_at IS NULL OR p_starts_at<=pg_catalog.now()
   OR (p_ends_at IS NOT NULL AND p_ends_at<=p_starts_at)
   OR p_starts_at IS NOT DISTINCT FROM v.scheduled_start
   OR length(btrim(coalesce(p_reason,'')))<12
 THEN RAISE EXCEPTION 'A different future interview date and reason are required'; END IF;
 UPDATE public.office_candidate_interviews SET scheduled_start=p_starts_at,
   scheduled_end=p_ends_at,updated_at=pg_catalog.now() WHERE id=v.id;
 INSERT INTO public.office_recruitment_events(
  actor_user_id,requisition_id,candidate_id,event_type,metadata
 ) VALUES(p_actor,c.requisition_id,c.id,'INTERVIEW_RESCHEDULED',
   pg_catalog.jsonb_build_object('interview_id',v.id,'scheduled_start',p_starts_at,
     'reason',left(btrim(p_reason),300)));
 RETURN v.id;
END;$reschedule$;

CREATE OR REPLACE FUNCTION public.office_interview_cancel(
 p_actor uuid,p_interview uuid,p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cancel$
DECLARE v public.office_candidate_interviews%rowtype;c public.office_candidates%rowtype;
 d text;
BEGIN
 SELECT * INTO v FROM public.office_candidate_interviews WHERE id=p_interview FOR UPDATE;
 SELECT * INTO c FROM public.office_candidates WHERE id=v.candidate_id;
 SELECT department_code INTO d FROM public.office_hiring_requisitions WHERE id=c.requisition_id;
 IF v.id IS NULL OR v.status<>'SCHEDULED' OR d IS NULL
    OR NOT (public.office_effective_permission(p_actor,'hiring.interview.manage','COMPANY',NULL,NULL)
      OR public.office_effective_permission(p_actor,'hiring.interview.manage','DEPARTMENT',d,NULL))
 THEN RAISE EXCEPTION 'Current interview management permission required'; END IF;
 IF length(btrim(coalesce(p_reason,'')))<12 THEN
   RAISE EXCEPTION 'Documented interview cancellation reason required'; END IF;
 UPDATE public.office_candidate_interviews SET status='CANCELLED',
    updated_at=pg_catalog.now() WHERE id=v.id;
 INSERT INTO public.office_recruitment_events(
  actor_user_id,requisition_id,candidate_id,event_type,metadata
 ) VALUES(p_actor,c.requisition_id,c.id,'INTERVIEW_CANCELLED',
    pg_catalog.jsonb_build_object('interview_id',v.id,'reason',left(btrim(p_reason),300)));
 RETURN v.id;
END;$cancel$;
REVOKE ALL ON FUNCTION public.office_interview_reschedule(uuid,uuid,timestamptz,timestamptz,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
REVOKE ALL ON FUNCTION public.office_interview_cancel(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_interview_reschedule(uuid,uuid,timestamptz,timestamptz,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.office_interview_cancel(uuid,uuid,text) TO service_role;

-- Add immutable events to the canonical recruitment timeline when the real
-- candidate document request is created or is returned for new evidence.
CREATE OR REPLACE FUNCTION public.office_candidate_document_request_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $doc$
DECLARE v_requisition uuid;
BEGIN
 IF (TG_OP='INSERT' AND NEW.status='REQUESTED')
 OR (TG_OP='UPDATE' AND NEW.status='REQUESTED' AND
      OLD.status IS DISTINCT FROM NEW.status) THEN
   SELECT requisition_id INTO v_requisition
     FROM public.office_candidates WHERE id=NEW.candidate_id;
   IF v_requisition IS NOT NULL THEN
     INSERT INTO public.office_recruitment_events(
       actor_user_id,requisition_id,candidate_id,event_type,metadata
     ) VALUES(NEW.requested_by,v_requisition,NEW.candidate_id,
       'CANDIDATE_DOCUMENT_REQUESTED',
       pg_catalog.jsonb_build_object('request_id',NEW.id,'document_type',NEW.document_type));
   END IF;
 END IF;
 RETURN NEW;
END;$doc$;
REVOKE ALL ON FUNCTION public.office_candidate_document_request_event()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_candidate_mail_on_document_request
 AFTER INSERT OR UPDATE OF status ON public.office_candidate_document_requests
 FOR EACH ROW EXECUTE FUNCTION public.office_candidate_document_request_event();

-- A rendered, signed, approved offer actually delivered via an independently
-- documented provider event is the only allowed "offer ready" source.
CREATE OR REPLACE FUNCTION public.office_candidate_offer_delivered_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $offer$
DECLARE d public.office_document_instances%rowtype;
 v_offer public.office_offer_proposals%rowtype;
 v_delivery public.office_document_delivery_events%rowtype;
 v_requisition uuid;
BEGIN
 IF NEW.event_type<>'DOCUMENT_DELIVERED' THEN RETURN NEW; END IF;
 SELECT * INTO d FROM public.office_document_instances
 WHERE id=NEW.document_instance_id;
 IF d.id IS NULL OR d.status<>'DELIVERED'
  OR d.signed_at IS NULL OR d.approved_at IS NULL
  OR d.subject_type<>'CANDIDATE'
 THEN RETURN NEW; END IF;
 SELECT * INTO v_offer FROM public.office_offer_proposals
 WHERE offer_document_instance_id=d.id
   AND candidate_id::text=d.subject_reference
   AND approved_by IS NOT NULL
   AND status IN('DOCUMENT_READY','OFFERED','ONBOARDING','ACCEPTED');
 IF v_offer.id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO v_delivery FROM public.office_document_delivery_events
 WHERE id::text=NEW.metadata->>'delivery_event_id'
   AND document_instance_id=d.id
   AND channel IN('EMAIL','SECURE_LINK')
   AND nullif(btrim(provider_reference),'') IS NOT NULL;
 IF v_delivery.id IS NULL THEN RETURN NEW; END IF;
 SELECT requisition_id INTO v_requisition FROM public.office_candidates
 WHERE id=v_offer.candidate_id;
 INSERT INTO public.office_recruitment_events(
  actor_user_id,requisition_id,candidate_id,offer_id,event_type,metadata
 ) VALUES(NEW.actor_user_id,v_requisition,v_offer.candidate_id,v_offer.id,
   'OFFER_DOCUMENT_DELIVERED',
   pg_catalog.jsonb_build_object('document_instance_id',d.id,
     'delivery_event_id',v_delivery.id));
 RETURN NEW;
END;$offer$;
REVOKE ALL ON FUNCTION public.office_candidate_offer_delivered_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_candidate_mail_on_document_delivered
 AFTER INSERT ON public.office_document_engine_events
 FOR EACH ROW EXECUTE FUNCTION public.office_candidate_offer_delivered_source();

-- Match only real canonical recruitment timeline events, not arbitrary
-- metadata. A changed interview state invalidates stale instructions.
CREATE OR REPLACE FUNCTION public.office_candidate_event_valid(
 p_id bigint,p_code text,p_candidate uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $proof$
DECLARE ev public.office_recruitment_events%rowtype;
 c public.office_candidates%rowtype;
 i public.office_candidate_interviews%rowtype;
 d public.office_candidate_document_requests%rowtype;
 o public.office_offer_proposals%rowtype;
BEGIN
 SELECT * INTO ev FROM public.office_recruitment_events
 WHERE id=p_id AND candidate_id=p_candidate;
 SELECT * INTO c FROM public.office_candidates WHERE id=p_candidate;
 IF ev.id IS NULL OR c.id IS NULL OR ev.requisition_id IS DISTINCT FROM c.requisition_id
 THEN RETURN false; END IF;
 IF p_code='HIRE-01' THEN
   RETURN ev.event_type='CANDIDATE_CREATED' AND ev.new_status='APPLIED';
 ELSIF p_code IN('HIRE-02','HIRE-03','HIRE-04') THEN
   SELECT * INTO i FROM public.office_candidate_interviews
    WHERE id::text=ev.metadata->>'interview_id' AND candidate_id=p_candidate;
   IF i.id IS NULL THEN RETURN false; END IF;
   IF p_code='HIRE-04' THEN
     RETURN ev.event_type='INTERVIEW_CANCELLED' AND i.status='CANCELLED';
   ELSE
     RETURN ev.event_type=CASE WHEN p_code='HIRE-02'
       THEN 'INTERVIEW_SCHEDULED' ELSE 'INTERVIEW_RESCHEDULED' END
       AND i.status='SCHEDULED' AND i.scheduled_start>pg_catalog.now()
       AND (p_code='HIRE-02' OR i.scheduled_start::text IS NOT DISTINCT FROM
         (ev.metadata->>'scheduled_start')::timestamptz::text);
   END IF;
 ELSIF p_code IN('HIRE-05','HIRE-06') THEN
   SELECT * INTO d FROM public.office_candidate_document_requests
   WHERE id::text=ev.metadata->>'request_id' AND candidate_id=p_candidate;
   IF d.id IS NULL THEN RETURN false; END IF;
   IF p_code='HIRE-05' THEN
     RETURN ev.event_type='CANDIDATE_DOCUMENT_REQUESTED'
       AND d.status='REQUESTED';
   ELSE
     RETURN ev.event_type='CANDIDATE_DOCUMENT_REVIEWED'
       AND ev.metadata->>'decision'='REJECTED' AND d.status='REJECTED';
   END IF;
 ELSIF p_code IN('HIRE-08','HIRE-09') THEN
   SELECT * INTO o FROM public.office_offer_proposals
   WHERE id=ev.offer_id AND candidate_id=p_candidate;
   IF o.id IS NULL THEN RETURN false; END IF;
   IF p_code='HIRE-08' THEN
     RETURN ev.event_type='OFFER_DOCUMENT_DELIVERED' AND o.approved_by IS NOT NULL
       AND EXISTS(SELECT 1 FROM public.office_document_instances doc
         WHERE doc.id=o.offer_document_instance_id
           AND doc.id::text=ev.metadata->>'document_instance_id'
           AND doc.status='DELIVERED' AND doc.signed_at IS NOT NULL
           AND doc.approved_at IS NOT NULL
           AND EXISTS(SELECT 1 FROM public.office_document_delivery_events delivery
              WHERE delivery.id::text=ev.metadata->>'delivery_event_id'
                AND delivery.document_instance_id=doc.id
                AND delivery.channel IN('EMAIL','SECURE_LINK')
                AND nullif(btrim(delivery.provider_reference),'') IS NOT NULL));
   ELSE
     RETURN ev.event_type='OFFER_ACCEPTANCE_RECORDED'
       AND o.accepted_at IS NOT NULL
       AND o.status IN('ONBOARDING','ACCEPTED','HIRED')
       AND length(btrim(coalesce(ev.metadata->>'evidence_reference','')))>=8;
   END IF;
 ELSIF p_code='HIRE-10' THEN
   RETURN ev.event_type='CANDIDATE_STATUS_CHANGED'
     AND ev.new_status IN('REJECTED','DECLINED','WITHDRAWN')
     AND c.status=ev.new_status;
 END IF;
 RETURN false;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
 RETURN false;
END;$proof$;
REVOKE ALL ON FUNCTION public.office_candidate_event_valid(bigint,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

-- The recruiter creates an immutable intent, never a deliverable message.
CREATE OR REPLACE FUNCTION public.office_candidate_mail_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE v_code text;
BEGIN
 IF NEW.candidate_id IS NULL THEN RETURN NEW; END IF;
 v_code:=CASE NEW.event_type
  WHEN 'CANDIDATE_CREATED' THEN 'HIRE-01'
  WHEN 'INTERVIEW_SCHEDULED' THEN 'HIRE-02'
  WHEN 'INTERVIEW_RESCHEDULED' THEN 'HIRE-03'
  WHEN 'INTERVIEW_CANCELLED' THEN 'HIRE-04'
  WHEN 'CANDIDATE_DOCUMENT_REQUESTED' THEN 'HIRE-05'
  WHEN 'CANDIDATE_DOCUMENT_REVIEWED' THEN
    CASE WHEN NEW.metadata->>'decision'='REJECTED' THEN 'HIRE-06' END
  WHEN 'OFFER_DOCUMENT_DELIVERED' THEN 'HIRE-08'
  WHEN 'OFFER_ACCEPTANCE_RECORDED' THEN 'HIRE-09'
  WHEN 'CANDIDATE_STATUS_CHANGED' THEN
    CASE WHEN NEW.new_status IN('REJECTED','DECLINED','WITHDRAWN') THEN 'HIRE-10' END
  ELSE NULL END;
 IF v_code IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.office_lifecycle_mail_policy
   WHERE event_code=v_code AND source_ready AND enabled
     AND delivery_owner='CANDIDATE_WORKER')
   OR NOT public.office_candidate_event_valid(NEW.id,v_code,NEW.candidate_id)
 THEN RETURN NEW; END IF;
 INSERT INTO public.office_candidate_mail_outbox(source_event_id,event_code,candidate_id)
 VALUES(NEW.id,v_code,NEW.candidate_id)
 ON CONFLICT(source_event_id,event_code,recipient_kind) DO NOTHING;
 RETURN NEW;
END;$source$;
REVOKE ALL ON FUNCTION public.office_candidate_mail_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_candidate_mail_on_recruitment_event
 AFTER INSERT ON public.office_recruitment_events
 FOR EACH ROW EXECUTE FUNCTION public.office_candidate_mail_source();

-- External candidate-mail claim with fresh email/consent/source checks,
-- strictly bounded age; no message at all without independent consent.
CREATE OR REPLACE FUNCTION public.office_candidate_mail_claim(p_limit integer DEFAULT 10)
RETURNS TABLE(outbox_id uuid,claim_token uuid,event_code text,
 recipient_email text,recipient_name text,source_reference text,
 interview_time timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $claim$
BEGIN
 -- SQL SECURITY DEFINER switches current_user to the function owner.
 -- The explicit REVOKE/GRANT EXECUTE boundary below restricts callers to
 -- kravia_office_backend, and source checks protect every claim.
 IF p_limit<1 OR p_limit>25 THEN RAISE EXCEPTION 'Candidate claim batch must be 1..25'; END IF;

 UPDATE public.office_candidate_mail_outbox q SET status='UNKNOWN',
   finalized_at=pg_catalog.now(),claim_token=NULL
 WHERE q.status='SENDING' AND q.claimed_at<pg_catalog.now()-interval '20 minutes';
 INSERT INTO public.office_candidate_mail_delivery_events(outbox_id,event_type)
 SELECT q.id,'STALE_UNKNOWN' FROM public.office_candidate_mail_outbox q
 WHERE q.status='UNKNOWN' AND q.finalized_at>=pg_catalog.now()-interval '1 minute'
 AND NOT EXISTS(SELECT 1 FROM public.office_candidate_mail_delivery_events log
   WHERE log.outbox_id=q.id AND log.event_type='STALE_UNKNOWN');

 UPDATE public.office_candidate_mail_outbox q
   SET status='SKIPPED',finalized_at=pg_catalog.now()
 FROM public.office_candidates c
 WHERE q.candidate_id=c.id AND q.status='PENDING'
  AND (q.created_at<pg_catalog.now()-interval '7 days'
   OR NOT EXISTS (SELECT 1 FROM public.office_lifecycle_mail_policy p
                 WHERE p.event_code=q.event_code AND p.enabled AND p.source_ready));
 -- Disabled policies: skip pending only when explicitly suspended, not on
 -- unrelated worker startup. The active branch has no historical rows.

 RETURN QUERY
 WITH eligible AS (
   SELECT q.id
   FROM public.office_candidate_mail_outbox q
   JOIN public.office_candidates c ON c.id=q.candidate_id
   JOIN public.office_candidate_mail_consents consent ON consent.candidate_id=c.id
   JOIN public.office_lifecycle_mail_policy policy ON policy.event_code=q.event_code
   WHERE q.status='PENDING'
     AND policy.source_ready AND policy.enabled AND policy.delivery_owner='CANDIDATE_WORKER'
     AND consent.recipient_email=pg_catalog.lower(pg_catalog.btrim(c.email))
     AND consent.status='VERIFIED' AND consent.verified_by IS NOT NULL
     AND consent.verified_by<>consent.recorded_by AND consent.verified_at IS NOT NULL
     AND c.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     AND public.office_candidate_event_valid(q.source_event_id,q.event_code,q.candidate_id)
     AND q.created_at>=pg_catalog.now()-interval '7 days'
   ORDER BY q.created_at,q.id
   LIMIT p_limit
   FOR UPDATE OF q SKIP LOCKED
 ), claimed AS (
   UPDATE public.office_candidate_mail_outbox q
   SET status='SENDING',claim_token=pg_catalog.gen_random_uuid(),
       claimed_at=pg_catalog.now()
   FROM eligible e WHERE q.id=e.id
   RETURNING q.id,q.claim_token,q.event_code,q.candidate_id,q.source_event_id
 ), logged AS (
   INSERT INTO public.office_candidate_mail_delivery_events(outbox_id,event_type)
   SELECT id,'CLAIMED' FROM claimed RETURNING outbox_id
 )
 SELECT q.id,q.claim_token,q.event_code,c.email,c.full_name,
   (c.candidate_code||':'||q.source_event_id::text),
   CASE q.event_code
     WHEN 'HIRE-02' THEN (e.metadata->>'scheduled_start')::timestamptz
     WHEN 'HIRE-03' THEN (e.metadata->>'new_start')::timestamptz
     ELSE NULL::timestamptz
   END
 FROM claimed q
 JOIN logged l ON l.outbox_id=q.id
 JOIN public.office_candidates c ON c.id=q.candidate_id
 JOIN public.office_recruitment_events e ON e.id=q.source_event_id;
END;$claim$;

CREATE OR REPLACE FUNCTION public.office_candidate_mail_finish(
 p_id uuid,p_token uuid,p_outcome text,p_provider_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $finish$
DECLARE v_status text;
BEGIN
 -- Only kravia_office_backend may invoke this SECURITY DEFINER function
 -- under the explicit EXECUTE grant; do not compare definer current_user.
 IF p_outcome NOT IN('SENT','REJECTED','UNKNOWN') THEN
    RAISE EXCEPTION 'Invalid candidate mail provider outcome'; END IF;
 UPDATE public.office_candidate_mail_outbox q
 SET status=p_outcome,finalized_at=pg_catalog.now(),
   provider_message_id=CASE WHEN p_outcome='SENT' THEN p_provider_id ELSE NULL END,
   claim_token=NULL
 WHERE q.id=p_id AND q.status='SENDING' AND q.claim_token=p_token
 RETURNING q.status INTO v_status;
 IF v_status IS NULL THEN RAISE EXCEPTION 'Invalid or stale candidate mail claim'; END IF;
 INSERT INTO public.office_candidate_mail_delivery_events(outbox_id,event_type)
 VALUES(p_id,CASE p_outcome WHEN 'SENT' THEN 'ACCEPTED' ELSE p_outcome END);
 RETURN true;
END;$finish$;

REVOKE ALL ON FUNCTION public.office_candidate_mail_claim(integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.office_candidate_mail_finish(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.office_candidate_mail_claim(integer) TO kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_candidate_mail_finish(uuid,uuid,text,text) TO kravia_office_backend;

DO $postcheck$
BEGIN
 IF (SELECT count(*) FROM public.office_lifecycle_mail_policy WHERE source_ready)<>74
  OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
  OR EXISTS(SELECT 1 FROM public.office_candidate_mail_outbox)
 THEN RAISE EXCEPTION 'Expected 74 verified source definitions, candidate mail disabled'; END IF;
END;$postcheck$;
