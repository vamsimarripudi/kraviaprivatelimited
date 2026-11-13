-- Disposable PostgreSQL 17 fixture only; never run against production.
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kravia_office_backend') THEN
   CREATE ROLE kravia_office_backend NOLOGIN; END IF;
END $roles$;
CREATE TABLE public.office_lifecycle_mail_policy(
 event_code text PRIMARY KEY,source_ready boolean NOT NULL DEFAULT false,
 enabled boolean NOT NULL DEFAULT false,effective_from timestamptz,
 approved_by uuid,approved_at timestamptz
);
INSERT INTO public.office_lifecycle_mail_policy(event_code,source_ready)
SELECT 'TEST-'||lpad(i::text,3,'0'),i<=59 FROM generate_series(1,71) AS i
UNION ALL
SELECT 'HIRE-'||lpad(i::text,2,'0'),false FROM generate_series(1,10) AS i;
CREATE TABLE public.office_lifecycle_mail_outbox(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.office_identity_users(
 user_id uuid PRIMARY KEY,status text NOT NULL
);
CREATE TABLE public.office_user_roles(
 user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 role text NOT NULL,expires_at timestamptz
);
CREATE TABLE public.office_candidates(
 id uuid PRIMARY KEY,requisition_id uuid NOT NULL,
 full_name text NOT NULL,email text NOT NULL,status text NOT NULL
);
CREATE TABLE public.office_recruitment_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id uuid,requisition_id uuid,candidate_id uuid REFERENCES public.office_candidates(id),
 offer_id uuid,event_type text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 new_status text,note text
);
CREATE TABLE public.office_candidate_interviews(
 id uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES public.office_candidates(id),
 status text NOT NULL,scheduled_start timestamptz NOT NULL
);
CREATE TABLE public.office_candidate_document_requests(
 id uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES public.office_candidates(id),
 document_type text NOT NULL,requested_by uuid,status text NOT NULL
);
CREATE TABLE public.office_offer_proposals(
 id uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES public.office_candidates(id),
 status text NOT NULL,accepted_at timestamptz,approved_by uuid,approved_at timestamptz
);
INSERT INTO public.office_identity_users(user_id,status)
VALUES('11111111-1111-4111-8111-111111111111','ACTIVE');
INSERT INTO public.office_user_roles(user_id,role)
VALUES('11111111-1111-4111-8111-111111111111','OWNER');
INSERT INTO public.office_candidates(id,requisition_id,full_name,email,status)
VALUES('22222222-2222-4222-8222-222222222222',
       '33333333-3333-4333-8333-333333333333',
       'Synthetic Candidate','candidate@example.com','APPLIED');
