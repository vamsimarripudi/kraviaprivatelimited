-- KRAVIA Office: authentic source evidence for EXIT-02 and EXIT-04.
-- This creates NO outgoing mail, no worker claim and no source_ready=true.
-- A future separate former-employee worker must independently verify current
-- consent and these immutable sources before each provider submission.

CREATE TABLE public.office_exit_notification_proofs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_code text NOT NULL CHECK(event_code IN('EXIT-02','EXIT-04')),
 source_event_id bigint NOT NULL
  REFERENCES public.office_request_events(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL
  REFERENCES public.office_requests(id) ON DELETE RESTRICT,
 employee_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 contact_version integer NOT NULL CHECK(contact_version>0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_code,source_event_id,employee_user_id)
);
ALTER TABLE public.office_exit_notification_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_notification_proofs
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_notification_proofs TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_notification_source_valid(
 p_proof_id bigint
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $verify$
DECLARE v public.office_exit_notification_proofs%rowtype;
BEGIN
 SELECT * INTO v FROM public.office_exit_notification_proofs
  WHERE id=p_proof_id;
 IF v.id IS NULL OR
  public.office_exit_contact_recipient(v.employee_user_id) IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM public.office_exit_contact_evidence c
    WHERE c.employee_user_id=v.employee_user_id
      AND c.status='VERIFIED' AND c.version=v.contact_version
      AND c.revoked_at IS NULL AND c.expires_at>now()
  ) THEN RETURN false; END IF;

 IF v.event_code='EXIT-02' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_request_events event
     JOIN public.office_requests req ON req.id=event.request_id
     JOIN public.office_employment_registry employment
       ON employment.identity_user_id=req.target_user_id
     WHERE event.id=v.source_event_id
       AND event.event_type='APPROVED'
       AND event.to_status='APPROVED'
       AND req.id=v.request_id
       AND req.request_type_code='EMPLOYEE_OFFBOARDING'
       AND req.status IN('APPROVED','FULFILLED')
       AND req.target_user_id=v.employee_user_id
       AND employment.relationship_type='EMPLOYEE'
       AND employment.end_date IS NOT NULL
   );
 END IF;

 IF v.event_code='EXIT-04' THEN
   RETURN EXISTS(
     SELECT 1 FROM public.office_request_events event
     JOIN public.office_requests req ON req.id=event.request_id
     JOIN public.office_identity_users employee
       ON employee.user_id=req.target_user_id
     WHERE event.id=v.source_event_id
       AND event.event_type='FULFILLED'
       AND event.from_status='APPROVED'
       AND event.to_status='FULFILLED'
       AND event.metadata->>'execution'='OFFICE_ACCESS_REVOKED'
       AND req.id=v.request_id
       AND req.request_type_code='EMPLOYEE_OFFBOARDING'
       AND req.status='FULFILLED'
       AND req.target_user_id=v.employee_user_id
       AND employee.status='REVOKED'
       AND EXISTS(
         SELECT 1 FROM public.office_workforce_events workforce
         WHERE workforce.target_user_id=v.employee_user_id
           AND workforce.event_type='WORKFORCE_ACCESS_REVOKED'
       )
       AND NOT EXISTS(
         SELECT 1 FROM public.office_auth_sessions session
         WHERE session.user_id=v.employee_user_id AND session.status='ACTIVE'
       )
   );
 END IF;
 RETURN false;
END $verify$;
REVOKE ALL ON FUNCTION public.office_exit_notification_source_valid(bigint)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_notification_source_valid(bigint)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_notification_from_approved_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE
 v_request public.office_requests%rowtype;
 v_code text;
 v_version integer;
BEGIN
 IF NEW.event_type='APPROVED' AND NEW.to_status='APPROVED' THEN
  v_code:='EXIT-02';
 ELSIF NEW.event_type='FULFILLED'
   AND NEW.to_status='FULFILLED' AND NEW.from_status='APPROVED'
   AND NEW.metadata->>'execution'='OFFICE_ACCESS_REVOKED' THEN
  v_code:='EXIT-04';
 ELSE
  RETURN NEW;
 END IF;

 SELECT * INTO v_request FROM public.office_requests
  WHERE id=NEW.request_id;
 IF v_request.id IS NULL OR
    v_request.request_type_code<>'EMPLOYEE_OFFBOARDING'
    OR v_request.target_user_id IS NULL THEN RETURN NEW; END IF;

 IF v_code='EXIT-02' THEN
   IF v_request.status<>'APPROVED'
    OR NOT EXISTS(
     SELECT 1 FROM public.office_employment_registry employment
     JOIN public.office_identity_users employee
       ON employee.user_id=employment.identity_user_id
     WHERE employment.identity_user_id=v_request.target_user_id
       AND employment.relationship_type='EMPLOYEE'
       AND employment.end_date IS NOT NULL
       AND employee.status='ACTIVE'
    ) THEN RETURN NEW; END IF;
 ELSE
   IF v_request.status<>'FULFILLED'
      OR NOT EXISTS(SELECT 1 FROM public.office_identity_users employee
        WHERE employee.user_id=v_request.target_user_id
          AND employee.status='REVOKED')
      OR NOT EXISTS(SELECT 1 FROM public.office_workforce_events workforce
        WHERE workforce.target_user_id=v_request.target_user_id
          AND workforce.event_type='WORKFORCE_ACCESS_REVOKED')
      OR EXISTS(SELECT 1 FROM public.office_auth_sessions session
        WHERE session.user_id=v_request.target_user_id
          AND session.status='ACTIVE')
   THEN RETURN NEW; END IF;
 END IF;

 SELECT contact.version INTO v_version
 FROM public.office_exit_contact_evidence contact
 WHERE contact.employee_user_id=v_request.target_user_id
   AND contact.status='VERIFIED' AND contact.revoked_at IS NULL
   AND contact.expires_at>now() AND contact.reviewed_by IS NOT NULL
   AND contact.reviewed_by<>contact.recorded_by
   AND contact.reviewed_at IS NOT NULL;
 IF v_version IS NULL THEN RETURN NEW; END IF;

 INSERT INTO public.office_exit_notification_proofs(
   event_code,source_event_id,request_id,employee_user_id,contact_version
 ) VALUES(v_code,NEW.id,v_request.id,v_request.target_user_id,v_version)
 ON CONFLICT(event_code,source_event_id,employee_user_id) DO NOTHING;
 RETURN NEW;
END $source$;
REVOKE ALL ON FUNCTION public.office_exit_notification_from_approved_request()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_exit_source_on_governed_request
 AFTER INSERT ON public.office_request_events
 FOR EACH ROW EXECUTE FUNCTION public.office_exit_notification_from_approved_request();

COMMENT ON TABLE public.office_exit_notification_proofs IS
 'Immutable request evidence only; never an email outbox or an authorization to send. EXIT event catalog policies remain disabled.';
