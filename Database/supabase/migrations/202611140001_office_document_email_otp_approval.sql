-- KRAVIA Office: first-party email OTP document approvals.
-- This is an internal, auditable approval receipt, NOT an IT Act DSC/eSign.
-- No document PDF is represented as cryptographically signed by this record.
-- Nothing is dispatched, backfilled, approved or activated by this migration.
DO $preflight$
BEGIN
 IF to_regclass('public.office_document_instances') IS NULL
    OR to_regclass('public.office_document_renders') IS NULL
    OR to_regclass('public.office_employee_reference_ids') IS NULL
    OR to_regclass('public.office_auth_users') IS NULL
    OR to_regclass('public.office_document_engine_events') IS NULL
    OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
 THEN RAISE EXCEPTION 'KRAVIA governed document prerequisites or dispatch hold not satisfied'; END IF;
END $preflight$;

CREATE TABLE public.office_document_otp_challenges(
 id uuid PRIMARY KEY,
 document_instance_id uuid NOT NULL REFERENCES public.office_document_instances(id) ON DELETE RESTRICT,
 render_id uuid NOT NULL REFERENCES public.office_document_renders(id) ON DELETE RESTRICT,
 signer_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 recipient_email text NOT NULL CHECK (length(recipient_email) BETWEEN 5 AND 320
   AND recipient_email=lower(btrim(recipient_email))),
 employee_reference text NOT NULL CHECK (length(btrim(employee_reference)) BETWEEN 5 AND 80),
 render_sha256 text NOT NULL CHECK (render_sha256 ~ '^[0-9a-f]{64}$'),
 code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
 session_hash text NOT NULL CHECK (session_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'PENDING'
  CHECK (status IN('PENDING','SENT','REJECTED','UNKNOWN','USED','LOCKED')),
 attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 sent_at timestamptz,
 verified_at timestamptz,
 CHECK (expires_at>created_at AND expires_at<=created_at+interval '10 minutes'),
 CHECK (status<>'USED' OR verified_at IS NOT NULL)
);
CREATE INDEX office_document_otp_actor_recent
 ON public.office_document_otp_challenges(signer_user_id,created_at DESC);
CREATE INDEX office_document_otp_doc_status
 ON public.office_document_otp_challenges(document_instance_id,status,created_at DESC);
ALTER TABLE public.office_document_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_document_otp_challenges
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON public.office_document_otp_challenges TO service_role;

CREATE TABLE public.office_document_otp_approvals(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 challenge_id uuid NOT NULL UNIQUE
  REFERENCES public.office_document_otp_challenges(id) ON DELETE RESTRICT,
 document_instance_id uuid NOT NULL
  REFERENCES public.office_document_instances(id) ON DELETE RESTRICT,
 render_id uuid NOT NULL REFERENCES public.office_document_renders(id) ON DELETE RESTRICT,
 render_sha256 text NOT NULL CHECK (render_sha256 ~ '^[0-9a-f]{64}$'),
 signer_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 signer_name text NOT NULL CHECK (length(btrim(signer_name)) BETWEEN 2 AND 160),
 employee_reference text NOT NULL CHECK (length(btrim(employee_reference)) BETWEEN 5 AND 80),
 signer_email_masked text NOT NULL CHECK (length(btrim(signer_email_masked)) BETWEEN 5 AND 320),
 method text NOT NULL DEFAULT 'FIRST_PARTY_EMAIL_OTP'
  CHECK (method='FIRST_PARTY_EMAIL_OTP'),
 status text NOT NULL DEFAULT 'APPROVED' CHECK (status='APPROVED'),
 latitude numeric(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
 longitude numeric(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
 accuracy_m numeric(10,2) NOT NULL CHECK (accuracy_m>0 AND accuracy_m<=5000),
 location_captured_at timestamptz NOT NULL,
 location_source text NOT NULL DEFAULT 'BROWSER_REPORTED_UNVERIFIED'
  CHECK (location_source='BROWSER_REPORTED_UNVERIFIED'),
 approved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(render_id,signer_user_id)
);
CREATE INDEX office_document_otp_approvals_instance
 ON public.office_document_otp_approvals(document_instance_id,approved_at DESC);
ALTER TABLE public.office_document_otp_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_document_otp_approvals
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON public.office_document_otp_approvals TO service_role;

CREATE OR REPLACE FUNCTION public.office_document_otp_eligible(
 p_actor uuid,p_instance uuid,p_render uuid,p_email text
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $eligible$
 SELECT EXISTS(
 SELECT 1 FROM public.office_document_instances doc
 JOIN public.office_document_renders render ON render.document_instance_id=doc.id
 JOIN public.office_identity_users signer ON signer.user_id=p_actor
 JOIN public.office_employee_reference_ids employee ON employee.employee_user_id=p_actor
 JOIN public.office_auth_users auth ON auth.id=p_actor::text
 WHERE doc.id=p_instance AND render.id=p_render
  AND doc.status IN ('RENDERED','SIGNING')
  AND doc.approved_at IS NOT NULL AND doc.approved_by IS NOT NULL
  AND doc.signed_at IS NULL
  AND render.output_format='PDF'
  AND render.status='GENERATED'
  AND render.sha256 ~ '^[0-9a-f]{64}$'
  AND (
    (doc.subject_type='EMPLOYEE' AND doc.subject_reference=p_actor::text)
    OR (doc.subject_type<>'EMPLOYEE' AND doc.owner_user_id=p_actor)
  )
  AND signer.status='ACTIVE'
  AND length(btrim(signer.display_name)) BETWEEN 2 AND 160
  AND employee.issued_at IS NOT NULL
  AND length(btrim(employee.reference_code)) BETWEEN 5 AND 80
  AND auth.status='ACTIVE'
  AND lower(btrim(auth.email))=lower(btrim(p_email))
  AND auth.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][A-Za-z]{2,}$'
 );
$eligible$;
REVOKE ALL ON FUNCTION public.office_document_otp_eligible(uuid,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;

CREATE OR REPLACE FUNCTION public.office_document_otp_begin(
 p_actor uuid,p_instance uuid,p_render uuid,p_challenge uuid,
 p_email text,p_code_hash text,p_session_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $begin$
DECLARE v_doc public.office_document_instances%rowtype;
        v_render public.office_document_renders%rowtype;
        v_employee text;v_email text:=lower(btrim(coalesce(p_email,'')));
BEGIN
 IF p_challenge IS NULL OR
    p_code_hash !~ '^[0-9a-f]{64}$' OR
    p_session_hash !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'Invalid document OTP challenge evidence'; END IF;
 SELECT * INTO v_doc FROM public.office_document_instances
  WHERE id=p_instance FOR UPDATE;
 IF v_doc.id IS NULL OR NOT public.office_document_otp_eligible(
   p_actor,p_instance,p_render,v_email) THEN
  RAISE EXCEPTION 'Document and active signer must be verified before email OTP'; END IF;
 IF EXISTS(SELECT 1 FROM public.office_document_otp_approvals
    WHERE render_id=p_render AND signer_user_id=p_actor) THEN
  RAISE EXCEPTION 'This exact document render has already been approved'; END IF;
 IF (SELECT count(*) FROM public.office_document_otp_challenges
    WHERE signer_user_id=p_actor AND created_at>now()-interval '1 hour')>=5
 OR EXISTS(SELECT 1 FROM public.office_document_otp_challenges
    WHERE signer_user_id=p_actor AND document_instance_id=p_instance
      AND created_at>now()-interval '60 seconds') THEN
  RAISE EXCEPTION 'Document OTP cooldown or hourly limit reached'; END IF;

 SELECT * INTO v_render FROM public.office_document_renders WHERE id=p_render;
 SELECT reference_code INTO v_employee FROM public.office_employee_reference_ids
 WHERE employee_user_id=p_actor;
 INSERT INTO public.office_document_otp_challenges(
   id,document_instance_id,render_id,signer_user_id,recipient_email,
   employee_reference,render_sha256,code_hash,session_hash,expires_at
 ) VALUES (
   p_challenge,p_instance,p_render,p_actor,v_email,
   v_employee,v_render.sha256,p_code_hash,p_session_hash,now()+interval '7 minutes'
 );
 RETURN true;
END $begin$;

CREATE OR REPLACE FUNCTION public.office_document_otp_delivery_result(
 p_actor uuid,p_challenge uuid,p_outcome text,p_provider_id text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $delivery$
DECLARE v_id uuid;
BEGIN
 IF p_outcome NOT IN('SENT','REJECTED','UNKNOWN')
 THEN RAISE EXCEPTION 'Invalid provider acceptance state'; END IF;
 UPDATE public.office_document_otp_challenges
 SET status=p_outcome,
     sent_at=CASE WHEN p_outcome='SENT' THEN now() ELSE NULL END,
     provider_message_id=CASE WHEN p_outcome='SENT' THEN left(p_provider_id,320) ELSE NULL END
 WHERE id=p_challenge AND signer_user_id=p_actor
   AND status='PENDING' AND expires_at>now()
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'OTP issuance request is not available'; END IF;
 RETURN true;
END $delivery$;

CREATE OR REPLACE FUNCTION public.office_document_otp_approve(
 p_actor uuid,p_challenge uuid,p_code_hash text,p_session_hash text,
 p_lat numeric,p_lon numeric,p_accuracy numeric,p_location_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $approval$
DECLARE v_otp public.office_document_otp_challenges%rowtype;
        v_doc public.office_document_instances%rowtype;
        v_render public.office_document_renders%rowtype;
        v_name text;v_id text;v_approved uuid;
BEGIN
 SELECT * INTO v_otp FROM public.office_document_otp_challenges
 WHERE id=p_challenge AND signer_user_id=p_actor FOR UPDATE;
 IF v_otp.id IS NULL OR v_otp.status<>'SENT'
   OR v_otp.expires_at<=now()
   OR v_otp.attempt_count>=5
   OR v_otp.session_hash IS DISTINCT FROM p_session_hash
 THEN RAISE EXCEPTION 'OTP challenge expired or invalid for this session'; END IF;

 -- Store failed attempts rather than raising an exception that would roll
 -- them back. Never return a new approval on a mismatch.
 IF v_otp.code_hash IS DISTINCT FROM p_code_hash THEN
  UPDATE public.office_document_otp_challenges
  SET attempt_count=attempt_count+1,
      status=CASE WHEN attempt_count+1>=5 THEN 'LOCKED' ELSE 'SENT' END
  WHERE id=v_otp.id;
  RETURN NULL;
 END IF;

 IF p_lat IS NULL OR p_lon IS NULL OR p_accuracy IS NULL
   OR p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180
   OR p_accuracy<=0 OR p_accuracy>5000
   OR p_location_at IS NULL
   OR p_location_at<now()-interval '2 minutes'
   OR p_location_at>now()+interval '15 seconds'
 THEN RAISE EXCEPTION 'Fresh browser-reported coordinates with known accuracy required'; END IF;

 SELECT * INTO v_doc FROM public.office_document_instances
 WHERE id=v_otp.document_instance_id FOR UPDATE;
 IF v_doc.id IS NULL OR NOT public.office_document_otp_eligible(
    p_actor,v_otp.document_instance_id,v_otp.render_id,v_otp.recipient_email)
 THEN RAISE EXCEPTION 'Signer or document status changed after OTP issuance'; END IF;
 SELECT * INTO v_render FROM public.office_document_renders
 WHERE id=v_otp.render_id;
 IF v_render.sha256 IS DISTINCT FROM v_otp.render_sha256 THEN
  RAISE EXCEPTION 'Document bytes changed since OTP issuance'; END IF;
 IF EXISTS(SELECT 1 FROM public.office_document_otp_approvals
   WHERE render_id=v_otp.render_id AND signer_user_id=p_actor)
 THEN RAISE EXCEPTION 'This document has already been approved by this signer'; END IF;

 SELECT btrim(display_name) INTO v_name FROM public.office_identity_users
 WHERE user_id=p_actor;
 SELECT reference_code INTO v_id FROM public.office_employee_reference_ids
 WHERE employee_user_id=p_actor;
 IF v_id IS DISTINCT FROM v_otp.employee_reference
 THEN RAISE EXCEPTION 'Employee identity reference changed'; END IF;

 INSERT INTO public.office_document_otp_approvals(
  challenge_id,document_instance_id,render_id,render_sha256,signer_user_id,
  signer_name,employee_reference,signer_email_masked,
  latitude,longitude,accuracy_m,location_captured_at
 ) VALUES (
  v_otp.id,v_doc.id,v_render.id,v_render.sha256,p_actor,
  v_name,v_id,
  substring(v_otp.recipient_email from 1 for 1)||'***@'||split_part(v_otp.recipient_email,'@',2),
  p_lat,p_lon,p_accuracy,p_location_at
 ) RETURNING id INTO v_approved;

 UPDATE public.office_document_otp_challenges
 SET status='USED',verified_at=now() WHERE id=v_otp.id;
 INSERT INTO public.office_document_engine_events(
   actor_user_id,template_id,template_version_id,
   document_instance_id,event_type,metadata
 ) VALUES (
   p_actor,v_doc.template_id,v_doc.template_version_id,v_doc.id,
   'INTERNAL_EMAIL_OTP_APPROVED',
   pg_catalog.jsonb_build_object('approval_id',v_approved,
    'render_id',v_render.id,'render_sha256',v_render.sha256,
    'employee_reference',v_id,'location_source','BROWSER_REPORTED_UNVERIFIED')
 );
 RETURN v_approved;
END $approval$;

REVOKE ALL ON FUNCTION public.office_document_otp_begin(uuid,uuid,uuid,uuid,text,text,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
REVOKE ALL ON FUNCTION public.office_document_otp_delivery_result(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
REVOKE ALL ON FUNCTION public.office_document_otp_approve(uuid,uuid,text,text,numeric,numeric,numeric,timestamptz)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_document_otp_begin(uuid,uuid,uuid,uuid,text,text,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.office_document_otp_delivery_result(uuid,uuid,text,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.office_document_otp_approve(uuid,uuid,text,text,numeric,numeric,numeric,timestamptz)
 TO service_role;

DO $postcheck$
BEGIN
 IF EXISTS(SELECT 1 FROM public.office_document_otp_challenges)
  OR EXISTS(SELECT 1 FROM public.office_document_otp_approvals)
  OR EXISTS(SELECT 1 FROM public.office_lifecycle_mail_policy WHERE enabled)
 THEN RAISE EXCEPTION 'OTP approval deployment must be empty and mail-disabled'; END IF;
END $postcheck$;

COMMENT ON TABLE public.office_document_otp_approvals IS
 'Private OTP-verified internal document approvals, not licensed digital signatures. Coordinates are user-permitted browser-reported values (not independently GPS-attested). Server approved_at and actual issued employee reference only.';
