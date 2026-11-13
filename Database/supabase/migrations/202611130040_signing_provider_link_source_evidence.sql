-- KRAVIA Office: ONB-04 provider-issued signing-link evidence.
-- Not a signing service, no generated signing URL, no email claim/worker.
-- The source only records a REAL provider reference on the canonical
-- Document Studio delivery event after an independently approved document.

CREATE TABLE public.office_onboarding_signing_proofs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_code text NOT NULL DEFAULT 'ONB-04' CHECK(event_code='ONB-04'),
 source_engine_event_id bigint NOT NULL UNIQUE
   REFERENCES public.office_document_engine_events(id) ON DELETE RESTRICT,
 delivery_event_id uuid NOT NULL UNIQUE
   REFERENCES public.office_document_delivery_events(id) ON DELETE RESTRICT,
 document_instance_id uuid NOT NULL
   REFERENCES public.office_document_instances(id) ON DELETE RESTRICT,
 employee_user_id uuid NOT NULL
   REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_onboarding_signing_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_onboarding_signing_proofs
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_onboarding_signing_proofs TO service_role;

CREATE OR REPLACE FUNCTION public.office_onboarding_signing_source_valid(
 p_id bigint
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $verify$
DECLARE p public.office_onboarding_signing_proofs%rowtype;
BEGIN
 SELECT * INTO p FROM public.office_onboarding_signing_proofs WHERE id=p_id;
 IF p.id IS NULL THEN RETURN false; END IF;
 RETURN EXISTS(
  SELECT 1 FROM public.office_document_engine_events event
  JOIN public.office_document_instances document
    ON document.id=event.document_instance_id
  JOIN public.office_document_delivery_events delivery
    ON delivery.id=p.delivery_event_id
  JOIN public.office_identity_users employee
    ON employee.user_id=p.employee_user_id
  JOIN public.office_document_templates template ON template.id=document.template_id
  JOIN public.office_document_templates template ON template.id=document.template_id
  WHERE event.id=p.source_engine_event_id
    AND event.event_type='DOCUMENT_DELIVERED'
    AND event.metadata->>'delivery_event_id'=delivery.id::text
    AND delivery.document_instance_id=p.document_instance_id
    AND delivery.event_type='SIGNING_LINK_ISSUED'
    AND delivery.channel='ESIGN'
    AND delivery.provider_reference IS NOT NULL
    AND char_length(btrim(delivery.provider_reference))>=8
   AND CASE
    WHEN delivery.metadata->>'link_expires_at'
     ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
    THEN (delivery.metadata->>'link_expires_at')::timestamptz>pg_catalog.now()
    ELSE false END
    AND delivery.destination_masked IS NOT NULL
    AND char_length(btrim(delivery.destination_masked))>=3
    AND document.id=p.document_instance_id
    AND template.template_code='HR_APPOINTMENT'
    AND document.subject_type='EMPLOYEE'
    AND document.subject_reference=employee.user_id::text
    AND document.status IN('SIGNING','DELIVERED')
    AND document.signed_at IS NULL
    AND document.approved_at IS NOT NULL
    AND document.approved_by IS NOT NULL
    AND document.created_by IS DISTINCT FROM document.approved_by
    AND employee.status='ACTIVE'
 );
END;
$verify$;
REVOKE ALL ON FUNCTION public.office_onboarding_signing_source_valid(bigint)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_onboarding_signing_source_valid(bigint)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_onboarding_signing_provider_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE v_delivery uuid;v_doc uuid;v_employee uuid;
BEGIN
 IF NEW.event_type<>'DOCUMENT_DELIVERED' THEN RETURN NEW; END IF;
 SELECT delivery.id,document.id,employee.user_id
 INTO v_delivery,v_doc,v_employee
 FROM public.office_document_delivery_events delivery
 JOIN public.office_document_instances document
   ON document.id=delivery.document_instance_id
 JOIN public.office_document_templates template ON template.id=document.template_id
 JOIN public.office_document_templates template ON template.id=document.template_id
 JOIN public.office_identity_users employee
   ON employee.user_id::text=document.subject_reference
 WHERE delivery.id::text=NEW.metadata->>'delivery_event_id'
   AND NEW.document_instance_id=document.id
   AND delivery.channel='ESIGN'
   AND delivery.event_type='SIGNING_LINK_ISSUED'
   AND delivery.provider_reference IS NOT NULL
   AND char_length(btrim(delivery.provider_reference))>=8
   AND CASE
    WHEN delivery.metadata->>'link_expires_at'
     ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
    THEN (delivery.metadata->>'link_expires_at')::timestamptz>pg_catalog.now()
    ELSE false END
   AND delivery.destination_masked IS NOT NULL
   AND char_length(btrim(delivery.destination_masked))>=3
   AND template.template_code='HR_APPOINTMENT'
   AND document.subject_type='EMPLOYEE'
   AND document.status IN('SIGNING','DELIVERED')
   AND document.signed_at IS NULL
   AND document.approved_at IS NOT NULL
   AND document.approved_by IS NOT NULL
   AND document.created_by IS DISTINCT FROM document.approved_by
   AND employee.status='ACTIVE';
 IF v_doc IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.office_onboarding_signing_proofs(
   source_engine_event_id,delivery_event_id,document_instance_id,employee_user_id
 ) VALUES(NEW.id,v_delivery,v_doc,v_employee)
 ON CONFLICT(source_engine_event_id) DO NOTHING;
 RETURN NEW;
END;
$source$;
REVOKE ALL ON FUNCTION public.office_onboarding_signing_provider_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_onboarding_signing_on_document_delivery
 AFTER INSERT ON public.office_document_engine_events
 FOR EACH ROW EXECUTE FUNCTION public.office_onboarding_signing_provider_source();

COMMENT ON TABLE public.office_onboarding_signing_proofs IS
 'ONB-04 evidence that a separately configured eSign provider was recorded as issuing a link. Contains no signing URL, token, or mail authorization.';
