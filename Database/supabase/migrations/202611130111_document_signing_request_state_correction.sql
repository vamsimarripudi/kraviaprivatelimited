-- Preserve the real document signing state when an eSign provider issues a link.
-- The historical office_document_record_delivery function incorrectly set
-- SIGNING_LINK_ISSUED to DELIVERED, preventing later signed-PDF recording.
-- A separate forward-only replacement retains all other delivery semantics.
CREATE OR REPLACE FUNCTION public.office_document_record_delivery(
 p_actor uuid,p_instance uuid,p_render uuid,p_channel text,
 p_destination_masked text,p_provider_reference text,
 p_event_type text,p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $record$
DECLARE
  d public.office_document_instances%rowtype;
  r public.office_document_renders%rowtype;
  v_id uuid;
  v_template text;
  v_channel text:=upper(trim(coalesce(p_channel,'')));
  v_event text:=upper(trim(coalesce(p_event_type,'')));
  v_expiry timestamptz;
  v_signing boolean:=v_event='SIGNING_LINK_ISSUED';
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
BEGIN
 SELECT * INTO d FROM public.office_document_instances WHERE id=p_instance FOR UPDATE;
 IF d.id IS NULL OR
  (v_signing AND d.status NOT IN('RENDERED','SIGNING')) OR
  (NOT v_signing AND d.status NOT IN('RENDERED','SIGNED','DELIVERED')) THEN
  RAISE EXCEPTION 'A rendered or signed document in the correct state is required';
 END IF;
 SELECT * INTO r FROM public.office_document_renders
 WHERE id=p_render AND document_instance_id=d.id;
 IF r.id IS NULL THEN
  RAISE EXCEPTION 'Output must belong to this document instance';
 END IF;
 IF NOT public.office_effective_permission(
  p_actor,'document.delivery.record','COMPANY',NULL,NULL)
 AND NOT public.office_effective_permission(
  p_actor,'document.delivery.record','OWN',NULL,d.owner_user_id)
 THEN RAISE EXCEPTION 'Document delivery-record permission required'; END IF;
 IF v_channel NOT IN('EMAIL','SMS','SECURE_LINK','IN_APP','ESIGN','OTHER')
 OR v_event='' OR pg_catalog.jsonb_typeof(v_metadata)<>'object'
 THEN RAISE EXCEPTION 'Valid delivery channel, event and metadata required'; END IF;

 IF v_signing AND d.status='SIGNING' AND EXISTS(
    SELECT 1 FROM public.office_document_delivery_events prior
    LEFT JOIN public.office_signing_issuance_reviews review
      ON review.delivery_event_id=prior.id
    WHERE prior.document_instance_id=d.id
      AND prior.channel='ESIGN'
      AND prior.event_type='SIGNING_LINK_ISSUED'
      AND COALESCE(review.status,'PENDING') NOT IN('REJECTED','REVOKED')
      AND CASE
        WHEN prior.metadata->>'link_expires_at'
          ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z FROM public.office_document_templates
    WHERE id=d.template_id AND status='ACTIVE';
   IF v_channel<>'ESIGN' OR r.output_format<>'PDF'
      OR v_template<>'HR_APPOINTMENT'
      OR d.approved_at IS NULL OR d.approved_by IS NULL
      OR d.created_by IS NOT DISTINCT FROM d.approved_by
      OR d.subject_type<>'EMPLOYEE'
      OR p_provider_reference IS NULL
      OR pg_catalog.char_length(pg_catalog.btrim(p_provider_reference)) NOT BETWEEN 8 AND 500
      OR pg_catalog.char_length(pg_catalog.btrim(coalesce(p_destination_masked,''))) NOT BETWEEN 3 AND 240
      OR (v_metadata->>'link_expires_at') !~
         '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
   THEN RAISE EXCEPTION 'Real approved HR provider signing request and UTC expiry required'; END IF;
   v_expiry:=(v_metadata->>'link_expires_at')::timestamptz;
   IF v_expiry<=pg_catalog.now()
      OR v_expiry>pg_catalog.now()+INTERVAL '30 days'
   THEN RAISE EXCEPTION 'Provider signing link expiry out of bounds'; END IF;
 ELSIF v_channel='ESIGN' AND d.status<>'SIGNED' THEN
   RAISE EXCEPTION 'eSign issuance must use approved signing request transition';
 END IF;

 INSERT INTO public.office_document_delivery_events(
   document_instance_id,render_id,channel,destination_masked,provider_reference,
   event_type,metadata,actor_user_id
 ) VALUES (
   d.id,r.id,v_channel,NULLIF(pg_catalog.btrim(coalesce(p_destination_masked,'')),''),
   NULLIF(pg_catalog.btrim(coalesce(p_provider_reference,'')),''),
   v_event,v_metadata,p_actor
 ) RETURNING id INTO v_id;

 IF v_signing THEN
   -- Stay SIGNING so the existing checked, quarantined signature-evidence
   -- pipeline can later advance this exact instance to SIGNED.
   UPDATE public.office_document_instances
   SET status='SIGNING',updated_at=pg_catalog.now()
   WHERE id=d.id;
 ELSE
   UPDATE public.office_document_instances
   SET status='DELIVERED',
       delivered_at=coalesce(delivered_at,pg_catalog.now()),
       updated_at=pg_catalog.now()
   WHERE id=d.id;
 END IF;

 INSERT INTO public.office_document_engine_events(
   actor_user_id,template_id,template_version_id,
   document_instance_id,event_type,metadata
 ) VALUES (
   p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_DELIVERED',
   pg_catalog.jsonb_build_object(
      'delivery_event_id',v_id,'render_id',r.id,
      'channel',v_channel,
      'provider_reference',NULLIF(pg_catalog.btrim(coalesce(p_provider_reference,'')),'')
   )||v_metadata
 );
 RETURN v_id;
END $record$;

REVOKE ALL ON FUNCTION public.office_document_record_delivery(
 uuid,uuid,uuid,text,text,text,text,jsonb
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_document_record_delivery(
 uuid,uuid,uuid,text,text,text,text,jsonb
) TO service_role;

COMMENT ON FUNCTION public.office_document_record_delivery(
 uuid,uuid,uuid,text,text,text,text,jsonb
) IS 'Provider-issued HR signing links enter SIGNING, not DELIVERED, with current UTC expiry and independent approved document. Non-eSign delivery remains unchanged.';

        THEN (prior.metadata->>'link_expires_at')::timestamptz>pg_catalog.now()
        ELSE true END
 ) THEN RAISE EXCEPTION 'Existing unexpired signing request must not be reissued'; END IF;

 IF v_signing THEN
   SELECT template_code INTO v_template FROM public.office_document_templates
    WHERE id=d.template_id AND status='ACTIVE';
   IF v_channel<>'ESIGN' OR r.output_format<>'PDF'
      OR v_template<>'HR_APPOINTMENT'
      OR d.approved_at IS NULL OR d.approved_by IS NULL
      OR d.created_by IS NOT DISTINCT FROM d.approved_by
      OR d.subject_type<>'EMPLOYEE'
      OR p_provider_reference IS NULL
      OR pg_catalog.char_length(pg_catalog.btrim(p_provider_reference)) NOT BETWEEN 8 AND 500
      OR pg_catalog.char_length(pg_catalog.btrim(coalesce(p_destination_masked,''))) NOT BETWEEN 3 AND 240
      OR (v_metadata->>'link_expires_at') !~
         '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$'
   THEN RAISE EXCEPTION 'Real approved HR provider signing request and UTC expiry required'; END IF;
   v_expiry:=(v_metadata->>'link_expires_at')::timestamptz;
   IF v_expiry<=pg_catalog.now()
      OR v_expiry>pg_catalog.now()+INTERVAL '30 days'
   THEN RAISE EXCEPTION 'Provider signing link expiry out of bounds'; END IF;
 ELSIF v_channel='ESIGN' AND d.status<>'SIGNED' THEN
   RAISE EXCEPTION 'eSign issuance must use approved signing request transition';
 END IF;

 INSERT INTO public.office_document_delivery_events(
   document_instance_id,render_id,channel,destination_masked,provider_reference,
   event_type,metadata,actor_user_id
 ) VALUES (
   d.id,r.id,v_channel,NULLIF(pg_catalog.btrim(coalesce(p_destination_masked,'')),''),
   NULLIF(pg_catalog.btrim(coalesce(p_provider_reference,'')),''),
   v_event,v_metadata,p_actor
 ) RETURNING id INTO v_id;

 IF v_signing THEN
   -- Stay SIGNING so the existing checked, quarantined signature-evidence
   -- pipeline can later advance this exact instance to SIGNED.
   UPDATE public.office_document_instances
   SET status='SIGNING',updated_at=pg_catalog.now()
   WHERE id=d.id;
 ELSE
   UPDATE public.office_document_instances
   SET status='DELIVERED',
       delivered_at=coalesce(delivered_at,pg_catalog.now()),
       updated_at=pg_catalog.now()
   WHERE id=d.id;
 END IF;

 INSERT INTO public.office_document_engine_events(
   actor_user_id,template_id,template_version_id,
   document_instance_id,event_type,metadata
 ) VALUES (
   p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_DELIVERED',
   pg_catalog.jsonb_build_object(
      'delivery_event_id',v_id,'render_id',r.id,
      'channel',v_channel,
      'provider_reference',NULLIF(pg_catalog.btrim(coalesce(p_provider_reference,'')),'')
   )||v_metadata
 );
 RETURN v_id;
END $record$;

REVOKE ALL ON FUNCTION public.office_document_record_delivery(
 uuid,uuid,uuid,text,text,text,text,jsonb
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_document_record_delivery(
 uuid,uuid,uuid,text,text,text,text,jsonb
) TO service_role;

COMMENT ON FUNCTION public.office_document_record_delivery(
 uuid,uuid,uuid,text,text,text,text,jsonb
) IS 'Provider-issued HR signing links enter SIGNING, not DELIVERED, with current UTC expiry and independent approved document. Non-eSign delivery remains unchanged.';
