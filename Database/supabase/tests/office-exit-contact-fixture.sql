-- Disposable PostgreSQL fixture. Synthetic employee identities only.
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kravia_office_backend') THEN CREATE ROLE kravia_office_backend NOLOGIN; END IF;
END $roles$;

CREATE TABLE public.office_identity_users(
 user_id uuid PRIMARY KEY,status text NOT NULL
);
CREATE TABLE public.office_user_roles(
 user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 role text NOT NULL, expires_at timestamptz
);
CREATE TABLE public.office_employment_registry(
 identity_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 relationship_type text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE',
 end_date date
);
CREATE OR REPLACE FUNCTION public.office_effective_permission(
 p_actor uuid,p_permission text,p_type text,p_key text,p_target uuid
) RETURNS boolean LANGUAGE sql STABLE AS $perm$
 SELECT p_actor IN (
 '11111111-1111-4111-8111-111111111111'::uuid,
 '22222222-2222-4222-8222-222222222222'::uuid
 ) AND p_type='COMPANY' AND p_permission IN('people.update','document.delivery.record');
$perm$;

INSERT INTO public.office_identity_users(user_id,status) VALUES
 ('11111111-1111-4111-8111-111111111111','ACTIVE'),
 ('22222222-2222-4222-8222-222222222222','ACTIVE'),
 ('33333333-3333-4333-8333-333333333333','ACTIVE'),
 ('44444444-4444-4444-8444-444444444444','ACTIVE');
INSERT INTO public.office_user_roles(user_id,role)
 VALUES('11111111-1111-4111-8111-111111111111','OWNER');
INSERT INTO public.office_employment_registry(identity_user_id,relationship_type)
 VALUES('33333333-3333-4333-8333-333333333333','EMPLOYEE');


CREATE TABLE public.office_requests(
 id uuid PRIMARY KEY,request_type_code text NOT NULL,
 target_user_id uuid REFERENCES public.office_identity_users(user_id),
 status text NOT NULL
);
CREATE TABLE public.office_request_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.office_requests(id),
 actor_user_id uuid, event_type text NOT NULL,
 from_status text,to_status text,metadata jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE public.office_workforce_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 target_user_id uuid REFERENCES public.office_identity_users(user_id),
 event_type text NOT NULL
);
CREATE TABLE public.office_auth_sessions(
 id uuid PRIMARY KEY,
 user_id uuid REFERENCES public.office_identity_users(user_id),
 status text NOT NULL
);


CREATE TABLE public.office_payroll_results(
 id uuid PRIMARY KEY,
 employee_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 status text NOT NULL,currency text NOT NULL,
 net_pay_minor bigint NOT NULL
);
CREATE TABLE public.office_salary_settlement_evidence(
 id uuid PRIMARY KEY,
 payroll_result_id uuid NOT NULL REFERENCES public.office_payroll_results(id),
 amount_minor bigint NOT NULL, currency text NOT NULL,
 status text NOT NULL, submitted_by uuid NOT NULL,
 verified_by uuid, verified_at timestamptz
);


CREATE TABLE public.office_document_templates(
 id uuid PRIMARY KEY, template_code text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'ACTIVE'
);
INSERT INTO public.office_document_templates(id,template_code) VALUES
 ('f1000000-0000-4000-8000-000000000001','HR_RELIEVING'),
 ('f1000000-0000-4000-8000-000000000002','HR_APPOINTMENT'),
 ('f1000000-0000-4000-8000-000000000003','HR_POLICY'),
 ('f1000000-0000-4000-8000-000000000004','HR_EXPERIENCE');
CREATE TABLE public.office_document_instances(
 id uuid PRIMARY KEY,
 document_code text NOT NULL,
 template_id uuid NOT NULL REFERENCES public.office_document_templates(id),
 template_version_id uuid,
 owner_user_id uuid REFERENCES public.office_identity_users(user_id),
 subject_type text NOT NULL,
 subject_reference text NOT NULL,
 status text NOT NULL,
 created_by uuid REFERENCES public.office_identity_users(user_id),
 approved_by uuid REFERENCES public.office_identity_users(user_id),
 approved_at timestamptz,
 signed_at timestamptz,
 delivered_at timestamptz,
 updated_at timestamptz
);
CREATE TABLE public.office_document_renders(
 id uuid PRIMARY KEY,
 document_instance_id uuid NOT NULL REFERENCES public.office_document_instances(id),
 output_format text NOT NULL
);
CREATE TABLE public.office_document_delivery_events(
 id uuid PRIMARY KEY,
 document_instance_id uuid NOT NULL REFERENCES public.office_document_instances(id),
 render_id uuid REFERENCES public.office_document_renders(id),
 actor_user_id uuid REFERENCES public.office_identity_users(user_id),
 channel text NOT NULL,destination_masked text,
 provider_reference text,event_type text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.office_document_signature_evidence(
 id uuid PRIMARY KEY,
 document_instance_id uuid NOT NULL REFERENCES public.office_document_instances(id),
 status text NOT NULL,signed_at timestamptz,
 signed_sha256 text NOT NULL
);
CREATE TABLE public.office_document_engine_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id uuid REFERENCES public.office_identity_users(user_id),
 template_id uuid REFERENCES public.office_document_templates(id),
 template_version_id uuid,
 document_instance_id uuid NOT NULL REFERENCES public.office_document_instances(id),
 event_type text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);


CREATE TABLE public.office_asset_lifecycle(
 asset_id varchar PRIMARY KEY,
 custodian_user_id uuid REFERENCES public.office_identity_users(user_id),
 lifecycle_status text NOT NULL,
 security_wipe_required boolean NOT NULL DEFAULT false,
 wipe_verified_by uuid REFERENCES public.office_identity_users(user_id)
);
