-- Synthetic PostgreSQL 17 ONLY. Do not execute against live employee data.
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kravia_office_backend') THEN CREATE ROLE kravia_office_backend NOLOGIN; END IF;
END $roles$;

CREATE TABLE public.office_lifecycle_mail_policy(event_code text PRIMARY KEY,enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.office_lifecycle_mail_policy VALUES('ONB-04',false);

CREATE TABLE public.office_identity_users(
 user_id uuid PRIMARY KEY,display_name text,status text NOT NULL
);
CREATE TABLE public.office_auth_users(
 id text PRIMARY KEY,email text NOT NULL,status text NOT NULL
);
CREATE TABLE public.office_employee_reference_ids(
 employee_user_id uuid PRIMARY KEY REFERENCES public.office_identity_users(user_id),
 reference_code text NOT NULL,issued_at timestamptz NOT NULL
);
CREATE TABLE public.office_document_templates(id uuid PRIMARY KEY);
CREATE TABLE public.office_document_instances(
 id uuid PRIMARY KEY,
 template_id uuid NOT NULL REFERENCES public.office_document_templates(id),
 template_version_id uuid,
 title text NOT NULL,
 document_code text NOT NULL,
 owner_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 subject_type text NOT NULL,subject_reference text NOT NULL,
 status text NOT NULL,
 approved_by uuid REFERENCES public.office_identity_users(user_id),
 approved_at timestamptz,
 signed_at timestamptz
);
CREATE TABLE public.office_document_renders(
 id uuid PRIMARY KEY,
 document_instance_id uuid NOT NULL REFERENCES public.office_document_instances(id),
 output_format text NOT NULL,status text NOT NULL,sha256 text NOT NULL,
 generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.office_document_engine_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id uuid REFERENCES public.office_identity_users(user_id),
 template_id uuid REFERENCES public.office_document_templates(id),
 template_version_id uuid,
 document_instance_id uuid REFERENCES public.office_document_instances(id),
 event_type text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.office_identity_users(user_id,display_name,status) VALUES
('11111111-1111-4111-8111-111111111111','Synthetic Signer','ACTIVE'),
('22222222-2222-4222-8222-222222222222','Synthetic Reviewer','ACTIVE'),
('33333333-3333-4333-8333-333333333333','Suspended Staff','SUSPENDED');
INSERT INTO public.office_auth_users(id,email,status) VALUES
('11111111-1111-4111-8111-111111111111','synthetic.signer@kraviaprivatelimited.com','ACTIVE'),
('22222222-2222-4222-8222-222222222222','reviewer@kraviaprivatelimited.com','ACTIVE'),
('33333333-3333-4333-8333-333333333333','suspended@kraviaprivatelimited.com','ACTIVE');
INSERT INTO public.office_employee_reference_ids(employee_user_id,reference_code,issued_at)
VALUES('11111111-1111-4111-8111-111111111111','KRV-E26-SYN01',now()),
      ('22222222-2222-4222-8222-222222222222','KRV-E26-SYN02',now());
INSERT INTO public.office_document_templates(id)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.office_document_instances(
 id,template_id,template_version_id,title,document_code,owner_user_id,
 subject_type,subject_reference,status,approved_by,approved_at,signed_at
) VALUES(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,
 'Synthetic employee appointment','KR-DOC-SYNTHETIC',
 '22222222-2222-4222-8222-222222222222',
 'EMPLOYEE','11111111-1111-4111-8111-111111111111',
 'RENDERED','22222222-2222-4222-8222-222222222222',now(),NULL
);
INSERT INTO public.office_document_renders(
 id,document_instance_id,output_format,status,sha256
) VALUES(
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'PDF','GENERATED',repeat('a',64)
);
