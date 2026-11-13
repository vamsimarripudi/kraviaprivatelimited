-- Forward-only recruitment workflow completion. No candidate email is emitted.
-- Interview changes are explicit recruiter actions with immutable provenance;
-- HIRE-03 and HIRE-04 remain disabled until an external recipient worker
-- and the candidate's verified contact-authority evidence are operational.

CREATE OR REPLACE FUNCTION public.office_interview_change(
  p_actor uuid,
  p_interview uuid,
  p_action text,
  p_start timestamptz,
  p_end timestamptz,
  p_reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $change$
DECLARE
  v_interview public.office_candidate_interviews%rowtype;
  v_candidate public.office_candidates%rowtype;
  v_requisition public.office_hiring_requisitions%rowtype;
  v_action text := upper(pg_catalog.btrim(COALESCE(p_action,'')));
  v_reason text := pg_catalog.btrim(COALESCE(p_reason,''));
BEGIN
  SELECT * INTO v_interview
  FROM public.office_candidate_interviews
  WHERE id=p_interview FOR UPDATE;

  IF v_interview.id IS NULL THEN
    RAISE EXCEPTION 'Interview not found';
  END IF;
  IF v_interview.status<>'SCHEDULED' THEN
    RAISE EXCEPTION 'Only scheduled interviews may be changed';
  END IF;
  IF v_action NOT IN('RESCHEDULE','CANCEL') THEN
    RAISE EXCEPTION 'Interview action must be RESCHEDULE or CANCEL';
  END IF;
  IF pg_catalog.char_length(v_reason)<8 OR pg_catalog.char_length(v_reason)>1000 THEN
    RAISE EXCEPTION 'A substantive audit explanation is required';
  END IF;

  SELECT * INTO v_candidate FROM public.office_candidates WHERE id=v_interview.candidate_id FOR UPDATE;
  IF v_candidate.id IS NULL OR v_candidate.status IN('REJECTED','WITHDRAWN','DECLINED','HIRED') THEN
    RAISE EXCEPTION 'Active candidate is required';
  END IF;

  SELECT * INTO v_requisition
  FROM public.office_hiring_requisitions WHERE id=v_candidate.requisition_id;
  IF v_requisition.id IS NULL OR v_requisition.status NOT IN('OPEN','FILLED') THEN
    RAISE EXCEPTION 'Hiring requisition is unavailable';
  END IF;

  IF NOT (
    public.office_effective_permission(p_actor,'hiring.interview.manage','COMPANY',NULL,NULL)
    OR public.office_effective_permission(
      p_actor,'hiring.interview.manage','DEPARTMENT',v_requisition.department_code,NULL)
  ) THEN
    RAISE EXCEPTION 'Interview management permission is required';
  END IF;

  IF v_action='RESCHEDULE' THEN
    IF p_start IS NULL OR p_start<=pg_catalog.now()+interval '5 minutes'
       OR (p_end IS NOT NULL AND p_end<=p_start)
       OR p_start=v_interview.scheduled_start
    THEN
      RAISE EXCEPTION 'Provide a distinct, future interview time and valid end';
    END IF;

    UPDATE public.office_candidate_interviews
       SET scheduled_start=p_start,scheduled_end=p_end,updated_at=pg_catalog.now()
     WHERE id=v_interview.id;

    INSERT INTO public.office_recruitment_events(
      actor_user_id,requisition_id,candidate_id,event_type,metadata,note
    ) VALUES(
      p_actor,v_candidate.requisition_id,v_candidate.id,'INTERVIEW_RESCHEDULED',
      pg_catalog.jsonb_build_object(
        'interview_id',v_interview.id,
        'previous_start',v_interview.scheduled_start,
        'new_start',p_start,'new_end',p_end,
        'interviewer_user_id',v_interview.interviewer_user_id
      ),v_reason
    );
    RETURN 'RESCHEDULED';
  END IF;

  UPDATE public.office_candidate_interviews
     SET status='CANCELLED',updated_at=pg_catalog.now()
   WHERE id=v_interview.id;

  INSERT INTO public.office_recruitment_events(
    actor_user_id,requisition_id,candidate_id,event_type,metadata,note
  ) VALUES(
    p_actor,v_candidate.requisition_id,v_candidate.id,'INTERVIEW_CANCELLED',
    pg_catalog.jsonb_build_object(
      'interview_id',v_interview.id,
      'cancelled_start',v_interview.scheduled_start,
      'interviewer_user_id',v_interview.interviewer_user_id
    ),v_reason
  );
  RETURN 'CANCELLED';
END;
$change$;

REVOKE ALL ON FUNCTION public.office_interview_change(
  uuid,uuid,text,timestamptz,timestamptz,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_interview_change(
  uuid,uuid,text,timestamptz,timestamptz,text
) TO service_role;
