-- Atomic, human-attributed promotion of email-verified public applicants to canonical KRAVIA ATS.
BEGIN;
CREATE OR REPLACE FUNCTION public.office_career_adopt_application(p_actor uuid, p_application uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE a public.office_career_applications%rowtype; r public.office_hiring_requisitions%rowtype;
        existing public.office_candidates%rowtype; v_id uuid;
BEGIN
 SELECT * INTO a FROM public.office_career_applications WHERE id=p_application FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Verified application not found'; END IF;
 IF a.status='IMPORTED' AND a.candidate_id IS NOT NULL THEN RETURN a.candidate_id; END IF;
 IF a.status<>'VERIFIED' OR a.verified_at IS NULL OR a.email<>lower(btrim(a.email))
 THEN RAISE EXCEPTION 'Applicant email verification is required'; END IF;
 SELECT * INTO r FROM public.office_hiring_requisitions WHERE id=a.requisition_id;
 IF r.id IS NULL OR r.status NOT IN ('OPEN','FILLED','CLOSED')
   OR r.approved_at IS NULL THEN RAISE EXCEPTION 'Approved requisition required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.office_identity_users WHERE user_id=p_actor AND status='ACTIVE') OR
    NOT (public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',NULL,NULL)
    OR public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,NULL))
 THEN RAISE EXCEPTION 'Authorized HR candidate manager required'; END IF;
 SELECT * INTO existing FROM public.office_candidates
   WHERE requisition_id=a.requisition_id AND email=a.email FOR UPDATE;
 IF existing.id IS NOT NULL THEN
   IF existing.source_channel<>'PUBLIC_CAREERS' OR existing.source_reference IS DISTINCT FROM a.id::text
   THEN RAISE EXCEPTION 'Duplicate candidate requires manual privacy-safe reconciliation'; END IF;
   v_id:=existing.id;
 ELSE
   INSERT INTO public.office_candidates(
     requisition_id,full_name,email,phone,location_text,source_channel,
     source_reference,owner_user_id,created_by
   ) VALUES (
     a.requisition_id,a.full_name,a.email,a.phone,a.location_text,
     'PUBLIC_CAREERS',a.id::text,r.hiring_manager_user_id,p_actor
   ) RETURNING id INTO v_id;
 END IF;
 UPDATE public.office_career_applications
 SET candidate_id=v_id,status='IMPORTED',imported_by=p_actor,imported_at=now(),updated_at=now()
 WHERE id=a.id;
 INSERT INTO public.office_recruitment_events(
   actor_user_id,requisition_id,candidate_id,event_type,previous_status,new_status,metadata
 ) VALUES (
   p_actor,a.requisition_id,v_id,'PUBLIC_APPLICATION_IMPORTED',NULL,'APPLIED',
   jsonb_build_object('public_application_id',a.id,'email_verified_at',a.verified_at,
     'resume_scan_status',a.resume_scan_status,'source','CAREERS_SELF_APPLICATION')
 );
 RETURN v_id;
END;$fn$;
REVOKE ALL ON FUNCTION public.office_career_adopt_application(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_career_adopt_application(uuid,uuid) TO service_role;
COMMIT;
