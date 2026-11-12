-- Discard after CI. This fixture is intentionally fabricated and must never
-- be loaded into KRAVIA Office production.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kravia_office_backend') THEN CREATE ROLE kravia_office_backend NOLOGIN; END IF;
END;
$roles$;

CREATE TABLE public.office_identity_users(
 user_id uuid PRIMARY KEY, display_name text, status text NOT NULL
);
CREATE TABLE public.office_user_roles(
 user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 role text NOT NULL,expires_at timestamptz
);
CREATE TABLE public.office_auth_users(
 id text PRIMARY KEY,email text NOT NULL,status text NOT NULL
);
CREATE TABLE public.office_employment_registry(
 employment_id uuid PRIMARY KEY,identity_user_id uuid REFERENCES public.office_identity_users(user_id),
 start_date date,status text NOT NULL
);
CREATE TABLE public.office_employee_intake_profiles(
 employee_user_id uuid PRIMARY KEY REFERENCES public.office_identity_users(user_id),
 status text NOT NULL
);
CREATE TABLE public.office_employee_reference_ids(
 employee_user_id uuid PRIMARY KEY REFERENCES public.office_identity_users(user_id),
 employment_id uuid UNIQUE NOT NULL REFERENCES public.office_employment_registry(employment_id),
 reference_code text UNIQUE NOT NULL
);
CREATE TABLE public.office_employee_mail_outbox(
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 employee_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 recipient_email text NOT NULL,
 kind text NOT NULL,
 reference_code text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING',
 provider_message_id text,submitted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(employee_user_id,kind,reference_code)
);
ALTER TABLE public.office_employee_mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_employee_mail_outbox FROM PUBLIC,anon,authenticated;

INSERT INTO public.office_identity_users(user_id,display_name,status) VALUES
 ('a0000000-0000-4000-8000-000000000001','Synthetic CI Owner','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000002','Synthetic CI Employee','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000003','Synthetic CI Unverified','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000004','Synthetic CI Historical','ACTIVE');
INSERT INTO public.office_user_roles(user_id,role)
VALUES('a0000000-0000-4000-8000-000000000001','OWNER');
INSERT INTO public.office_employment_registry(employment_id,identity_user_id,start_date,status)
VALUES
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','2026-11-13','ACTIVE'),
 ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','2026-11-13','ACTIVE'),
 ('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','2026-11-13','ACTIVE');
INSERT INTO public.office_employee_intake_profiles(employee_user_id,status)
VALUES
 ('a0000000-0000-4000-8000-000000000002','VERIFIED'),
 ('a0000000-0000-4000-8000-000000000003','SUBMITTED'),
 ('a0000000-0000-4000-8000-000000000004','VERIFIED');
INSERT INTO public.office_auth_users(id,email,status)
VALUES
 ('a0000000-0000-4000-8000-000000000002','synthetic.employee@kraviaprivatelimited.com','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000003','synthetic.unverified@kraviaprivatelimited.com','ACTIVE'),
 ('a0000000-0000-4000-8000-000000000004','synthetic.historical@kraviaprivatelimited.com','ACTIVE');
INSERT INTO public.office_employee_reference_ids(employee_user_id,employment_id,reference_code)
VALUES
 ('a0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','KRV-E26-0123456789ABCDEF'),
 ('a0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000003','KRV-E26-FEDCBA9876543210'),
 ('a0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000004','KRV-E26-AAAABBBBCCCCDDDD');
