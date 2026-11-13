-- Signed relieving/experience document evidence for EXIT-07.
-- Source ONLY: never generates files, signing tokens, public URLs or emails.
-- Requires a genuine approved instance, verified signed-PDF evidence, documented
-- delivery, fulfilled offboarding, and independently verified external contact.
-- Document Studio emits DOCUMENT_DELIVERED *after* the instance changes state;
-- an AFTER INSERT on office_document_delivery_events would race that update.

CREATE TABLE public.office_exit_document_proofs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_engine_event_id bigint NOT NULL
  REFERENCES public.office_document_engine_events(id) ON DELETE RESTRICT,
 document_instance_id uuid NOT NULL
  REFERENCES public.office_document_instances(id) ON DELETE RESTRICT,
 employee_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 contact_version integer NOT NULL CHECK(contact_version>0),
 event_code text NOT NULL DEFAULT 'EXIT-07' CHECK(event_code='EXIT-07'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_engine_event_id,employee_user_id)
);
ALTER TABLE public.office_exit_document_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_document_proofs
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_document_proofs TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_document_source_valid(
 p_proof_id bigint
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $verify$
DECLARE p public.office_exit_document_proofs%rowtype;
BEGIN
 SELECT * INTO p FROM public.office_exit_document_proofs WHERE id=p_proof_id;
 IF p.id IS NULL
  OR public.office_exit_contact_recipient(p.employee_user_id) IS NULL
  OR NOT EXISTS(
    SELECT 1 FROM public.office_exit_contact_evidence c
    WHERE c.employee_user_id=p.employee_user_id
      AND c.version=p.contact_version AND c.status='VERIFIED'
      AND c.revoked_at IS NULL AND c.expires_at>now()
  ) THEN RETURN false; END IF;

 RETURN EXISTS(
  SELECT 1 FROM public.office_document_engine_events e
  JOIN public.office_document_instances instance ON instance.id=e.document_instance_id
  JOIN public.office_document_delivery_events delivered
    ON delivered.id::text=e.metadata->>'delivery_event_id'
  JOIN public.office_identity_users employee
    ON employee.user_id=p.employee_user_id
  WHERE e.id=p.source_engine_event_id
    AND e.event_type='DOCUMENT_DELIVERED'
    AND instance.id=p.document_instance_id
    AND instance.subject_type='EMPLOYEE'
    AND instance.subject_reference=employee.user_id::text
    AND instance.document_code IN('HR_RELIEVING','HR_EXPERIENCE')
    AND instance.status='DELIVERED'
    AND instance.approved_by IS NOT NULL AND instance.approved_at IS NOT NULL
    AND instance.signed_at IS NOT NULL
    AND delivered.document_instance_id=instance.id
    AND delivered.event_type='DOCUMENT_DELIVERED'
    AND delivered.channel IN('EMAIL','SECURE_LINK','IN_APP','ESIGN')
    AND delivered.provider_reference IS NOT NULL
    AND btrim(delivered.provider_reference)<>''
    AND employee.status='REVOKED'
    AND EXISTS(
      SELECT 1 FROM public.office_requests req
      WHERE req.request_type_code='EMPLOYEE_OFFBOARDING'
        AND req.target_user_id=p.employee_user_id
        AND req.status='FULFILLED'
    )
    AND EXISTS(
      SELECT 1 FROM public.office_document_signature_evidence signature
      WHERE signature.document_instance_id=instance.id
        AND signature.status='VERIFIED'
        AND signature.signed_at IS NOT NULL
        AND char_length(signature.signed_sha256)=64
    )
 );
END $verify$;
REVOKE ALL ON FUNCTION public.office_exit_document_source_valid(bigint)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_document_source_valid(bigint)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_document_delivery_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE
 v_employee uuid;v_document uuid;v_version integer;
BEGIN
 IF NEW.event_type<>'DOCUMENT_DELIVERED' THEN RETURN NEW; END IF;
 SELECT employee.user_id,instance.id
 INTO v_employee,v_document
 FROM public.office_document_instances instance
 JOIN public.office_identity_users employee
   ON instance.subject_reference=employee.user_id::text
 JOIN public.office_document_delivery_events delivered
   ON delivered.id::text=NEW.metadata->>'delivery_event_id'
 JOIN public.office_employment_registry employment
   ON employment.identity_user_id=employee.user_id
 WHERE instance.id=NEW.document_instance_id
   AND instance.subject_type='EMPLOYEE'
   AND instance.document_code IN('HR_RELIEVING','HR_EXPERIENCE')
   AND instance.status='DELIVERED'
   AND instance.approved_by IS NOT NULL AND instance.approved_at IS NOT NULL
   AND instance.signed_at IS NOT NULL
   AND delivered.document_instance_id=instance.id
   AND delivered.event_type='DOCUMENT_DELIVERED'
   AND delivered.channel IN('EMAIL','SECURE_LINK','IN_APP','ESIGN')
   AND delivered.provider_reference IS NOT NULL
   AND btrim(delivered.provider_reference)<>''
   AND employee.status='REVOKED'
   AND employment.relationship_type='EMPLOYEE'
   AND employment.end_date IS NOT NULL
   AND EXISTS(
      SELECT 1 FROM public.office_requests req
      WHERE req.request_type_code='EMPLOYEE_OFFBOARDING'
        AND req.target_user_id=employee.user_id AND req.status='FULFILLED'
   )
   AND EXISTS(
      SELECT 1 FROM public.office_document_signature_evidence signature
      WHERE signature.document_instance_id=instance.id
        AND signature.status='VERIFIED'
        AND signature.signed_at IS NOT NULL
        AND char_length(signature.signed_sha256)=64
   );
 IF v_employee IS NULL THEN RETURN NEW; END IF;

 SELECT c.version INTO v_version
 FROM public.office_exit_contact_evidence c
 WHERE c.employee_user_id=v_employee AND c.status='VERIFIED'
   AND c.revoked_at IS NULL AND c.expires_at>now()
   AND c.reviewed_by IS NOT NULL AND c.reviewed_by<>c.recorded_by;
 IF v_version IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.office_exit_document_proofs(
   source_engine_event_id,document_instance_id,employee_user_id,contact_version
 ) VALUES(NEW.id,v_document,v_employee,v_version)
 ON CONFLICT(source_engine_event_id,employee_user_id) DO NOTHING;
 RETURN NEW;
END $source$;
REVOKE ALL ON FUNCTION public.office_exit_document_delivery_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_exit_document_source_after_delivery
 AFTER INSERT ON public.office_document_engine_events
 FOR EACH ROW EXECUTE FUNCTION public.office_exit_document_delivery_source();

COMMENT ON TABLE public.office_exit_document_proofs IS
 'EXIT-07 signed-document source evidence only. No document template, access link, mail worker or source-ready policy is created.';
