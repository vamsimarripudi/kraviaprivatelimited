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
 end_date date
);
CREATE OR REPLACE FUNCTION public.office_effective_permission(
 p_actor uuid,p_permission text,p_type text,p_key text,p_target uuid
) RETURNS boolean LANGUAGE sql STABLE AS $perm$
 SELECT p_actor IN (
 '11111111-1111-4111-8111-111111111111'::uuid,
 '22222222-2222-4222-8222-222222222222'::uuid
 ) AND p_permission='people.update' AND p_type='COMPANY';
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
