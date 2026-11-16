-- Candidate-supplied document quarantine and HR-reviewed onboarding chain.
BEGIN;
CREATE TABLE IF NOT EXISTS public.office_career_candidate_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.office_career_applications(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
  document_request_id uuid NOT NULL REFERENCES public.office_candidate_document_requests(id) ON DELETE RESTRICT,
  path text NOT NULL,
  sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
  byte_size integer NOT NULL CHECK(byte_size BETWEEN 100 AND 4194304),
  original_filename text NOT NULL,
  status text NOT NULL DEFAULT 'QUARANTINED' CHECK(status IN ('QUARANTINED','SCANNED_CLEAN','REJECTED')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  scanned_at timestamptz,
  scanned_by uuid REFERENCES public.office_identity_users(user_id),
  UNIQUE(application_id,document_request_id)
);
CREATE INDEX IF NOT EXISTS office_career_candidate_uploads_unscanned ON public.office_career_candidate_uploads(status,submitted_at);

CREATE TABLE IF NOT EXISTS public.office_career_onboarding_handoffs (
  offer_id uuid PRIMARY KEY REFERENCES public.office_offer_proposals(id) ON DELETE RESTRICT,
  application_id uuid NOT NULL REFERENCES public.office_career_applications(id) ON DELETE RESTRICT,
  candidate_id uuid NOT NULL REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
  pre_onboarding_request_id uuid NOT NULL REFERENCES public.office_requests(id) ON DELETE RESTRICT,
  employee_user_id uuid UNIQUE REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'AWAITING_APPROVAL'
    CHECK(status IN ('AWAITING_APPROVAL','APPROVED','INVITED','EMPLOYEE_LINKED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz,
  linked_by uuid REFERENCES public.office_identity_users(user_id)
);
CREATE INDEX IF NOT EXISTS office_career_handoffs_status ON public.office_career_onboarding_handoffs(status,created_at);

UPDATE storage.buckets SET allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png']
 WHERE id='office-career-quarantine';

ALTER TABLE public.office_career_candidate_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_career_onboarding_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.office_career_candidate_uploads,public.office_career_onboarding_handoffs FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.office_career_candidate_uploads,public.office_career_onboarding_handoffs TO service_role;

CREATE OR REPLACE FUNCTION public.office_career_employee_link(
  p_actor uuid,p_application uuid,p_employee uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE h public.office_career_onboarding_handoffs%rowtype;
        req public.office_requests%rowtype;
        employment public.office_employment_registry%rowtype;
        offer public.office_offer_proposals%rowtype;
        applicant_email text;employee_email text;employee_dept text;
BEGIN
 SELECT * INTO h FROM public.office_career_onboarding_handoffs
   WHERE application_id=p_application FOR UPDATE;
 IF h.offer_id IS NULL OR h.status IN ('CANCELLED','EMPLOYEE_LINKED') THEN
   RAISE EXCEPTION 'Pending approved onboarding handoff is required';
 END IF;
 SELECT * INTO req FROM public.office_requests WHERE id=h.pre_onboarding_request_id;
 IF req.status<>'APPROVED' THEN RAISE EXCEPTION 'Independent pre-onboarding approval is required'; END IF;
 SELECT * INTO offer FROM public.office_offer_proposals WHERE id=h.offer_id;
 IF offer.status NOT IN ('ONBOARDING','HIRED') THEN RAISE EXCEPTION 'Accepted offer is required'; END IF;
 SELECT email INTO applicant_email FROM public.office_career_applications WHERE id=p_application AND candidate_id=h.candidate_id;
 SELECT lower(btrim(email)) INTO employee_email FROM public.office_auth_users WHERE id=p_employee AND status='ACTIVE';
 SELECT primary_department INTO employee_dept FROM public.office_identity_users WHERE user_id=p_employee AND status='ACTIVE';
 IF applicant_email IS NULL OR employee_email IS NULL OR applicant_email<>employee_email OR employee_dept IS DISTINCT FROM offer.department_code
 THEN RAISE EXCEPTION 'Verified applicant email and assigned department must match employee identity'; END IF;
 IF NOT public.office_effective_permission(p_actor,'hiring.onboarding.manage','COMPANY',NULL,NULL)
   AND NOT public.office_effective_permission(p_actor,'hiring.onboarding.manage','DEPARTMENT',offer.department_code,NULL)
 THEN RAISE EXCEPTION 'Authorized HR onboarding reviewer required'; END IF;
 SELECT * INTO employment FROM public.office_employment_registry
 WHERE identity_user_id=p_employee AND status='ACTIVE' AND start_date IS NOT NULL
 ORDER BY created_at DESC LIMIT 1;
 IF employment.employment_id IS NULL THEN
   RAISE EXCEPTION 'Verified active employment with actual joining date is required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_employee_intake_profiles
   WHERE employee_user_id=p_employee AND status='VERIFIED' AND bank_verified_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Independent HR intake and bank verification required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.office_employee_reference_ids WHERE employee_user_id=p_employee AND employment_id=employment.employment_id) THEN
   RAISE EXCEPTION 'Governed permanent employee ID must be issued first'; END IF;
 UPDATE public.office_career_onboarding_handoffs SET
   employee_user_id=p_employee,status='EMPLOYEE_LINKED',linked_at=now(),linked_by=p_actor
 WHERE offer_id=h.offer_id;
 UPDATE public.office_offer_proposals SET status='HIRED',updated_at=now() WHERE id=h.offer_id;
 UPDATE public.office_candidates SET status='HIRED',updated_at=now() WHERE id=h.candidate_id;
 INSERT INTO public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,offer_id,event_type,previous_status,new_status,metadata)
 VALUES(p_actor,offer.requisition_id,h.candidate_id,h.offer_id,'CAREER_EMPLOYEE_LINKED','ONBOARDING','HIRED',
  jsonb_build_object('employee_linked',true,'employment_verified',true));
 RETURN true;
END;$fn$;
REVOKE ALL ON FUNCTION public.office_career_employee_link(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_career_employee_link(uuid,uuid,uuid) TO service_role;

-- One atomic, independent HR step: verify signed-delivered offer, record
-- candidate acknowledgement and create the pre-onboarding approval.
CREATE OR REPLACE FUNCTION public.office_career_accept_signed_offer(p_actor uuid,p_action uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a public.office_career_candidate_actions%rowtype;
 app public.office_career_applications%rowtype;
 off public.office_offer_proposals%rowtype;
 doc public.office_document_instances%rowtype;
 v_request uuid;
BEGIN
 SELECT * INTO a FROM public.office_career_candidate_actions WHERE id=p_action FOR UPDATE;
 IF a.id IS NULL OR a.action_type<>'OFFER_ACKNOWLEDGED' OR a.status<>'SUBMITTED'
  OR a.offer_id IS NULL OR a.candidate_id IS NULL OR a.evidence_sha256 IS NULL
 THEN RAISE EXCEPTION 'Pending candidate acknowledgement evidence is required'; END IF;
 SELECT * INTO app FROM public.office_career_applications WHERE id=a.application_id;
 IF app.id IS NULL OR app.candidate_id IS DISTINCT FROM a.candidate_id OR app.status<>'IMPORTED'
   OR lower(btrim(app.full_name)) IS DISTINCT FROM lower(btrim(a.typed_name))
 THEN RAISE EXCEPTION 'Verified applicant identity and signed-name acknowledgement required'; END IF;
 SELECT * INTO off FROM public.office_offer_proposals WHERE id=a.offer_id FOR UPDATE;
 IF off.id IS NULL OR off.candidate_id<>app.candidate_id OR off.status NOT IN('DOCUMENT_READY','OFFERED')
   OR off.approved_by IS NULL OR off.offer_document_instance_id IS NULL
   OR (off.valid_until IS NOT NULL AND off.valid_until<=now())
 THEN RAISE EXCEPTION 'Current approved and offered proposal required'; END IF;
 SELECT * INTO doc FROM public.office_document_instances WHERE id=off.offer_document_instance_id;
 IF doc.id IS NULL OR doc.approved_at IS NULL OR doc.delivered_at IS NULL OR doc.signed_at IS NULL
  OR doc.subject_type<>'CANDIDATE' OR doc.subject_reference<>app.candidate_id::text
 THEN RAISE EXCEPTION 'Approved delivered and signed document evidence required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.office_identity_users WHERE user_id=p_actor AND status='ACTIVE')
  OR NOT (
    public.office_effective_permission(p_actor,'hiring.onboarding.manage','COMPANY',NULL,NULL)
    OR public.office_effective_permission(p_actor,'hiring.onboarding.manage','DEPARTMENT',off.department_code,NULL)
  ) THEN RAISE EXCEPTION 'Authorized HR handoff reviewer required'; END IF;
 v_request:=public.office_offer_mark_accepted(
   p_actor,off.id,'CAREER_ACK:'||a.id::text||';SIGNED_DOCUMENT:'||doc.id::text);
 INSERT INTO public.office_career_onboarding_handoffs(
  offer_id,application_id,candidate_id,pre_onboarding_request_id,status)
 VALUES(off.id,app.id,app.candidate_id,v_request,'AWAITING_APPROVAL');
 UPDATE public.office_career_candidate_actions SET status='REVIEWED' WHERE id=a.id;
 RETURN v_request;
END;$fn$;
REVOKE ALL ON FUNCTION public.office_career_accept_signed_offer(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_career_accept_signed_offer(uuid,uuid) TO service_role;

COMMIT;
