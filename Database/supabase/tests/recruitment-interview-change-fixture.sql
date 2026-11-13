-- Disposable-only PostgreSQL fixture: synthetic identities, no actual KRAVIA staff.
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;
CREATE TABLE public.office_hiring_requisitions(
 id uuid PRIMARY KEY,department_code text NOT NULL,status text NOT NULL
);
CREATE TABLE public.office_candidates(
 id uuid PRIMARY KEY,requisition_id uuid NOT NULL REFERENCES public.office_hiring_requisitions(id),status text NOT NULL
);
CREATE TABLE public.office_candidate_interviews(
 id uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES public.office_candidates(id),
 interviewer_user_id uuid NOT NULL,scheduled_start timestamptz NOT NULL,scheduled_end timestamptz,
 status text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.office_recruitment_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_user_id uuid,requisition_id uuid,candidate_id uuid,
 event_type text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,note text
);
CREATE OR REPLACE FUNCTION public.office_effective_permission(
 p_actor uuid,p_code text,p_scope_type text,p_scope_key text,p_target uuid
) RETURNS boolean LANGUAGE sql STABLE AS $grant$
 SELECT p_actor='11111111-1111-4111-8111-111111111111'::uuid
  AND p_code='hiring.interview.manage'
  AND p_scope_type='COMPANY';
$grant$;
INSERT INTO public.office_hiring_requisitions(id,department_code,status)
VALUES('22222222-2222-4222-8222-222222222222','PEOPLE','OPEN');
INSERT INTO public.office_candidates(id,requisition_id,status)
VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','INTERVIEW');
INSERT INTO public.office_candidate_interviews(id,candidate_id,interviewer_user_id,scheduled_start,scheduled_end,status)
VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',
 '55555555-5555-4555-8555-555555555555',now()+interval '2 days',now()+interval '2 days 1 hour','SCHEDULED');