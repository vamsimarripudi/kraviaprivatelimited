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
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_user_id uuid NOT NULL,actor_user_id uuid,event_type text NOT NULL
);
CREATE TABLE public.office_role_package_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_user_id uuid,application_id uuid,task_id uuid,actor_user_id uuid,event_type text NOT NULL
);
CREATE TABLE public.office_employee_role_package_applications(
  id uuid PRIMARY KEY,employee_user_id uuid NOT NULL
);
CREATE TABLE public.office_employee_intake_profiles(
  employee_user_id uuid PRIMARY KEY,status text NOT NULL
);
CREATE TABLE public.office_employee_reference_ids(
  employee_user_id uuid PRIMARY KEY,reference_code text NOT NULL,
  issued_by uuid,issued_at timestamptz
);
CREATE TABLE public.office_employment_registry(
  identity_user_id uuid PRIMARY KEY,status text NOT NULL,start_date date,
  relationship_type text NOT NULL
);
CREATE TABLE public.office_role_package_onboarding_tasks(
  id uuid PRIMARY KEY,application_id uuid,employee_user_id uuid,required boolean NOT NULL,status text NOT NULL,
  reviewed_by uuid,submitted_by uuid,reviewed_at timestamptz
);
CREATE TABLE public.office_worktime_policy_versions(
  id uuid PRIMARY KEY,employee_user_id uuid NOT NULL,status text NOT NULL,
  proposed_by uuid,approved_by uuid,approved_at timestamptz,
  authority_reference text
);
CREATE TABLE public.office_flex_day_requests(
  id uuid PRIMARY KEY,employee_user_id uuid NOT NULL,status text NOT NULL,
  requested_by uuid,reviewed_by uuid,reviewed_at timestamptz
);
CREATE TABLE public.office_worktime_review_cases(id uuid PRIMARY KEY,employee_user_id uuid NOT NULL,
 requested_by uuid,status text);
CREATE TABLE public.office_department_ownership(department_code text PRIMARY KEY,owner_user_id uuid);
CREATE OR REPLACE FUNCTION public.office_effective_permission(
 p_user_id uuid,p_permission text,p_scope_type text,p_scope_key text,p_owner_user_id uuid
) RETURNS boolean LANGUAGE sql STABLE AS $fixture_permission$
  SELECT p_user_id='a0000000-0000-4000-8000-000000000003'::uuid
    AND p_permission IN ('people.update','hiring.offer.review','payroll.compensation.review','payroll.run.review');
$fixture_permission$;
CREATE TABLE public.office_worktime_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,case_id uuid,actor_user_id uuid,event_type text NOT NULL
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
CREATE TABLE public.office_access_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_user_id uuid,
  target_user_id uuid,action text NOT NULL
);
CREATE TABLE public.office_offer_proposals(
  id uuid PRIMARY KEY,created_by uuid,approval_request_id uuid,status text NOT NULL
);
CREATE TABLE public.office_requests(
  id uuid PRIMARY KEY,request_type_code text NOT NULL,
  current_step_order integer NOT NULL,status text NOT NULL
);
CREATE TABLE public.office_request_steps(
  id uuid PRIMARY KEY,request_id uuid NOT NULL,step_order integer NOT NULL,
  assigned_user_id uuid,status text NOT NULL,required_permission text
);
CREATE TABLE public.office_recruitment_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id uuid,actor_user_id uuid,event_type text NOT NULL,new_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.office_training_assignments(
  id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,
  completion_evidence_reference text
);
CREATE TABLE public.office_performance_reviews(
  id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,finalized_by uuid,
  reviewer_user_id uuid,development_plan text
);
CREATE TABLE public.office_people_development_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,target_user_id uuid,actor_user_id uuid,
  training_assignment_id uuid,performance_review_id uuid,event_type text NOT NULL,new_status text
);
CREATE TABLE public.office_compensation_versions(
  id uuid PRIMARY KEY,employee_user_id uuid NOT NULL,status text NOT NULL,
  approved_by uuid,approved_at timestamptz,approval_request_id uuid,created_by uuid
);
CREATE TABLE public.office_payroll_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,compensation_version_id uuid,
  period_id uuid,employment_id uuid,actor_user_id uuid,batch_id uuid,
  event_type text NOT NULL,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.office_payroll_periods(
  id uuid PRIMARY KEY,period_code text NOT NULL,status text NOT NULL,
  created_by uuid,approved_by uuid,approved_at timestamptz,approval_request_id uuid
);
CREATE TABLE public.office_salary_payment_batches(
  id uuid PRIMARY KEY,period_id uuid,prepared_by uuid,status text NOT NULL
);
CREATE TABLE public.office_payroll_results(
  id uuid PRIMARY KEY,period_id uuid,employment_id uuid,employee_user_id uuid,
  status text NOT NULL,net_pay_minor bigint NOT NULL
);
CREATE TABLE public.office_salary_settlement_evidence(
  id uuid PRIMARY KEY,payroll_result_id uuid NOT NULL,
  amount_minor bigint NOT NULL,currency text,
  status text NOT NULL,submitted_by uuid,verified_by uuid,verified_at timestamptz,
  credited_at timestamptz,evidence_reference text,masked_bank_reference text
);
CREATE TABLE public.office_salary_payslip_issues(
  id uuid PRIMARY KEY,payroll_result_id uuid,employee_user_id uuid,issued_by uuid,
  snapshot_sha256 text,issued_at timestamptz
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
INSERT INTO public.office_worktime_review_cases(id,employee_user_id,requested_by,status)
VALUES
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002','APPROVED'),
 ('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002','PENDING');
INSERT INTO public.office_department_ownership(department_code,owner_user_id)
VALUES('PEOPLE','a0000000-0000-4000-8000-000000000003');
INSERT INTO public.office_department_transfer_requests(id,department_code,from_owner_user_id,to_owner_user_id,status)
VALUES('c0000000-0000-4000-8000-000000000001','ENGINEERING',
  'a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','ACCEPTED');
INSERT INTO public.office_training_assignments(id,user_id,status) VALUES(
 'd0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','ASSIGNED');
INSERT INTO public.office_training_assignments(id,user_id,status,completion_evidence_reference)
VALUES('d0000000-0000-4000-8000-000000000005',
 'a0000000-0000-4000-8000-000000000002','COMPLETED','synthetic-evidence-ci-05');
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

INSERT INTO public.office_payroll_periods(
  id,period_code,status,created_by,approved_by,approved_at
) VALUES
 ('f0000000-0000-4000-8000-000000000001','2026-11','APPROVED',
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',pg_catalog.now()),
 ('f0000000-0000-4000-8000-000000000006','2026-12','DRAFT',
  'a0000000-0000-4000-8000-000000000003',NULL,NULL);
INSERT INTO public.office_salary_payment_batches(id,period_id,prepared_by,status)
VALUES('f0000000-0000-4000-8000-000000000007',
 'f0000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000003','PREPARED');
INSERT INTO public.office_payroll_results(id,period_id,employment_id,employee_user_id,status,net_pay_minor) VALUES(
 'f0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001',
 'f0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','LOCKED',50000);

INSERT INTO public.office_role_package_onboarding_tasks(id,application_id,employee_user_id,required,status)
VALUES('e0000000-0000-4000-8000-000000000009',
 'e0000000-0000-4000-8000-000000000008',
 'a0000000-0000-4000-8000-000000000002',true,'PENDING');
INSERT INTO public.office_employee_role_package_applications(id,employee_user_id)
VALUES('e0000000-0000-4000-8000-000000000008',
       'a0000000-0000-4000-8000-000000000002');
INSERT INTO public.office_employee_intake_profiles(employee_user_id,status)
VALUES('a0000000-0000-4000-8000-000000000002','VERIFIED');
INSERT INTO public.office_employee_reference_ids(employee_user_id,reference_code,issued_by,issued_at)
VALUES('a0000000-0000-4000-8000-000000000002','KRV-E26-0123456789ABCDEF',
 'a0000000-0000-4000-8000-000000000001',pg_catalog.now());
INSERT INTO public.office_employment_registry(identity_user_id,status,start_date,relationship_type)
VALUES('a0000000-0000-4000-8000-000000000002','ACTIVE','2026-11-01','EMPLOYEE');
INSERT INTO public.office_requests(id,request_type_code,current_step_order,status)
VALUES('c0000000-0000-4000-8000-000000000011','EMPLOYMENT_OFFER_APPROVAL',1,'IN_REVIEW');
INSERT INTO public.office_request_steps(id,request_id,step_order,assigned_user_id,status,required_permission)
VALUES('c0000000-0000-4000-8000-000000000012','c0000000-0000-4000-8000-000000000011',1,
  'a0000000-0000-4000-8000-000000000003','PENDING','hiring.offer.review');
INSERT INTO public.office_offer_proposals(id,created_by,approval_request_id,status)
VALUES('c0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000011','PENDING_APPROVAL');
INSERT INTO public.office_requests(id,request_type_code,current_step_order,status)
VALUES
 ('c0000000-0000-4000-8000-000000000021','COMPENSATION_CHANGE',1,'IN_REVIEW'),
 ('c0000000-0000-4000-8000-000000000022','PAYROLL_RUN_APPROVAL',1,'IN_REVIEW');
INSERT INTO public.office_request_steps(
 id,request_id,step_order,assigned_user_id,status,required_permission
) VALUES
 ('c0000000-0000-4000-8000-000000000023',
  'c0000000-0000-4000-8000-000000000021',1,
  'a0000000-0000-4000-8000-000000000003','PENDING','payroll.compensation.review'),
 ('c0000000-0000-4000-8000-000000000024',
  'c0000000-0000-4000-8000-000000000022',1,
  'a0000000-0000-4000-8000-000000000003','PENDING','payroll.run.review');
INSERT INTO public.office_compensation_versions(id,employee_user_id,status,created_by,approval_request_id)
VALUES('d0000000-0000-4000-8000-000000000006',
 'a0000000-0000-4000-8000-000000000002','PENDING_APPROVAL',
 'a0000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000021');
INSERT INTO public.office_payroll_periods(id,period_code,status,created_by,approval_request_id)
VALUES('f0000000-0000-4000-8000-000000000016','2026-10','PENDING_REVIEW',
 'a0000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000022');

INSERT INTO public.office_worktime_policy_versions(id,employee_user_id,status,proposed_by,authority_reference)
VALUES('b0000000-0000-4000-8000-000000000006',
 'a0000000-0000-4000-8000-000000000002','DRAFT',
 'a0000000-0000-4000-8000-000000000002','Synthetic-CI-Approved-Work-Policy');
INSERT INTO public.office_flex_day_requests(id,employee_user_id,status,requested_by)
VALUES('b0000000-0000-4000-8000-000000000007',
 'a0000000-0000-4000-8000-000000000002','PENDING',
 'a0000000-0000-4000-8000-000000000002'),
 ('b0000000-0000-4000-8000-000000000008',
 'a0000000-0000-4000-8000-000000000002','PENDING',
 'a0000000-0000-4000-8000-000000000002');

INSERT INTO public.office_salary_settlement_evidence(
  id,payroll_result_id,amount_minor,currency,status,submitted_by,credited_at,
  evidence_reference,masked_bank_reference
) VALUES(
 'f0000000-0000-4000-8000-000000000009',
 'f0000000-0000-4000-8000-000000000002',50000,'INR','PENDING',
 'a0000000-0000-4000-8000-000000000003',pg_catalog.now(),
 'Synthetic-private-bank-verification-evidence','****1234');

-- These separate payroll results must never be classified as bank-paid.
INSERT INTO public.office_payroll_results(
  id,period_id,employment_id,employee_user_id,status,net_pay_minor
) VALUES
 ('f0000000-0000-4000-8000-000000000010',
 'f0000000-0000-4000-8000-000000000001',
 'f0000000-0000-4000-8000-000000000013',
 'a0000000-0000-4000-8000-000000000002','LOCKED',75000),
 ('f0000000-0000-4000-8000-000000000012',
 'f0000000-0000-4000-8000-000000000001',
 'f0000000-0000-4000-8000-000000000014',
 'a0000000-0000-4000-8000-000000000002','LOCKED',60000);
INSERT INTO public.office_salary_settlement_evidence(
  id,payroll_result_id,amount_minor,currency,status,submitted_by,credited_at,
  evidence_reference,masked_bank_reference
) VALUES
 ('f0000000-0000-4000-8000-000000000011',
 'f0000000-0000-4000-8000-000000000010',50000,'INR','PENDING',
 'a0000000-0000-4000-8000-000000000003',pg_catalog.now(),
 'Synthetic-partial-bank-verification','****5678'),
 ('f0000000-0000-4000-8000-000000000015',
 'f0000000-0000-4000-8000-000000000012',60000,'INR','PENDING',
 'a0000000-0000-4000-8000-000000000003',pg_catalog.now(),
 'Synthetic-self-reviewed-bank-credit','****9012');


-- Synthetic first-party credential and owned-asset sources for migration 025.
-- These tables and records exist only in the disposable PostgreSQL fixture.
CREATE TABLE public.office_auth_events_v2(
 id varchar PRIMARY KEY,
 user_id varchar,session_id varchar,event_type varchar NOT NULL,metadata_json text
);
CREATE TABLE public.office_login_device_approvals(
 id varchar PRIMARY KEY,
 user_id varchar,session_id varchar,status varchar,consumed_at timestamptz
);
CREATE TABLE public.office_asset_lifecycle(
 asset_id varchar PRIMARY KEY,custodian_user_id uuid,lifecycle_status text
);
CREATE TABLE public.office_asset_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 asset_id varchar NOT NULL,actor_user_id uuid,event_type text NOT NULL,
 new_status text,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
