-- Isolated-only lifecycle policy simulation after offboarding proof smoke tests.
-- Never apply this file outside disposable CI PostgreSQL.
ALTER TABLE public.office_identity_users ADD COLUMN display_name text;
UPDATE public.office_identity_users SET display_name=CASE user_id
 WHEN '11111111-1111-4111-8111-111111111111'::uuid THEN 'Synthetic Owner'
 WHEN '22222222-2222-4222-8222-222222222222'::uuid THEN 'Synthetic HR'
 ELSE 'Synthetic Employee' END;
CREATE TABLE public.office_auth_users(id text PRIMARY KEY,email text NOT NULL,status text NOT NULL);
INSERT INTO public.office_auth_users VALUES
 ('33333333-3333-4333-8333-333333333333','synthetic.employee@kraviaprivatelimited.com','ACTIVE');

CREATE TABLE public.office_lifecycle_mail_policy(
 event_code text PRIMARY KEY,
 source_ready boolean NOT NULL DEFAULT false,
 enabled boolean NOT NULL DEFAULT false,
 delivery_owner text NOT NULL DEFAULT 'LIFECYCLE_WORKER'
 CHECK(delivery_owner IN('LIFECYCLE_WORKER','FIRST_PARTY_AUTH','CANDIDATE_WORKER')),
 effective_from timestamptz
);
CREATE TABLE public.office_lifecycle_mail_outbox(id uuid PRIMARY KEY);
CREATE TABLE public.office_candidate_mail_outbox(id uuid PRIMARY KEY);

WITH families(prefix,number) AS (
 VALUES ('AUTH',12),('HIRE',10),('ONB',12),('ROLE',9),
        ('TIME',10),('PAY',12),('DEV',8),('EXIT',8)
), codes AS (
 SELECT prefix||'-'||lpad(idx::text,2,'0') AS code
 FROM families, pg_catalog.generate_series(1,families.number) idx
)
INSERT INTO public.office_lifecycle_mail_policy(event_code,source_ready,delivery_owner)
SELECT code,
 code NOT IN('ONB-04','EXIT-02','EXIT-04','EXIT-05','EXIT-06','EXIT-07','EXIT-08'),
 CASE WHEN code IN('AUTH-01','AUTH-02','AUTH-03','AUTH-05','AUTH-06','AUTH-08') THEN 'FIRST_PARTY_AUTH'
 WHEN code IN('HIRE-01','HIRE-02','HIRE-03','HIRE-04','HIRE-05',
              'HIRE-06','HIRE-08','HIRE-09','HIRE-10') THEN 'CANDIDATE_WORKER'
 ELSE 'LIFECYCLE_WORKER' END
FROM codes;
