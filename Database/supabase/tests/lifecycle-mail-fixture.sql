-- Fabricated ephemeral PostgreSQL 17 fixture. NEVER execute on real employee data.
DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kravia_office_backend') THEN CREATE ROLE kravia_office_backend NOLOGIN; END IF;
END;
$roles$;
CREATE TABLE public.office_identity_users(user_id uuid PRIMARY KEY,display_name text,status text NOT NULL);
CREATE TABLE public.office_user_roles(user_id uuid,role text,expires_at timestamptz);
CREATE TABLE public.office_auth_users(id text PRIMARY KEY,email text NOT NULL,status text NOT NULL);
CREATE TABLE public.office_employee_intake_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,employee_user_id uuid NOT NULL,event_type text NOT NULL
);
CREATE TABLE public.office_role_package_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,target_user_id uuid,event_type text NOT NULL
);
CREATE TABLE public.office_worktime_review_cases(id uuid PRIMARY KEY,employee_user_id uuid NOT NULL,status text);
CREATE TABLE public.office_worktime_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,case_id uuid,event_type text NOT NULL
);
CREATE TABLE public.office_department_transfer_requests(
  id uuid PRIMARY KEY,department_code text NOT NULL,
  from_owner_user_id uuid,to_owner_user_id uuid,status text
);
CREATE TABLE public.office_department_transfer_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,transfer_id uuid,
  department_code text,event_type text NOT NULL
);
CREATE TABLE public.office_auth_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL,event_type text NOT NULL
);
CREATE TABLE public.office_training_assignments(
  id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL
);
CREATE TABLE public.office_performance_reviews(
  id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,finalized_by uuid,
  reviewer_user_id uuid,development_plan text
);
CREATE TABLE public.office_people_development_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,target_user_id uuid,
  training_assignment_id uuid,performance_review_id uuid,event_type text NOT NULL,new_status text
);
CREATE TABLE public.office_compensation_versions(
  id uuid PRIMARY KEY,employee_user_id uuid NOT NULL,status text NOT NULL,
  approved_by uuid,approved_at timestamptz
);
CREATE TABLE public.office_payroll_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,compensation_version_id uuid,
  event_type text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.office_tasks(
  id uuid PRIMARY KEY,assigned_user_id uuid,status text NOT NULL
);
CREATE TABLE public.office_task_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,task_id uuid NOT NULL,
  event_type text NOT NULL
);
INSERT INTO public.office_identity_users(user_id,display_name,status) VALUES
  ('a0000000-0000-4000-8000-000000000001','Synthetic CI Owner','ACTIVE'),
  ('a0000000-0000-4000-8000-000000000002','Synthetic CI Staff','ACTIVE'),
  ('a0000000-0000-4000-8000-000000000003','Synthetic CI Manager','ACTIVE'),
  ('a0000000-0000-4000-8000-000000000004','Synthetic CI Dormant','SUSPENDED');
INSERT INTO public.office_user_roles(user_id,role)
VALUES('a0000000-0000-4000-8000-000000000001','OWNER');
INSERT INTO public.office_auth_users(id,email,status) VALUES
  ('a0000000-0000-4000-8000-000000000001','synthetic.owner@kraviaprivatelimited.com','ACTIVE'),
  ('a0000000-0000-4000-8000-000000000002','synthetic.staff@kraviaprivatelimited.com','ACTIVE'),
  ('a0000000-0000-4000-8000-000000000003','synthetic.manager@kraviaprivatelimited.com','ACTIVE'),
  ('a0000000-0000-4000-8000-000000000004','synthetic.dormant@kraviaprivatelimited.com','ACTIVE');
INSERT INTO public.office_worktime_review_cases(id,employee_user_id,status)
VALUES('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','APPROVED');
INSERT INTO public.office_department_transfer_requests(id,department_code,from_owner_user_id,to_owner_user_id,status)
VALUES('c0000000-0000-4000-8000-000000000001','ENGINEERING',
  'a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','ACCEPTED');
INSERT INTO public.office_training_assignments(id,user_id,status) VALUES(
 'd0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','ASSIGNED');
INSERT INTO public.office_performance_reviews(id,user_id,status,finalized_by,reviewer_user_id,development_plan)
VALUES('d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',
 'FINAL','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','Synthetic development plan'),
 ('d0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002',
 'DRAFT',NULL,'a0000000-0000-4000-8000-000000000003',NULL);
INSERT INTO public.office_compensation_versions(id,employee_user_id,status,approved_by,approved_at) VALUES(
 'd0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002',
 'APPROVED','a0000000-0000-4000-8000-000000000001',pg_catalog.now());

INSERT INTO public.office_tasks(id,assigned_user_id,status) VALUES(
 'e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','OPEN');
