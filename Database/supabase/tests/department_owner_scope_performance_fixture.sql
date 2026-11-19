-- Disposable PostgreSQL 17 tenant. Synthetic identities only.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.office_identity_users(
  user_id uuid primary key,status text not null
);
CREATE TABLE public.office_user_roles(
  user_id uuid not null,role text not null,expires_at timestamptz
);
CREATE TABLE public.office_department_ownership(
  department_code text primary key,owner_user_id uuid
);
CREATE TABLE public.office_department_former_owners(
  department_code text not null,user_id uuid not null
);
CREATE TABLE public.office_permission_catalog(
  code text primary key,module text not null,action text not null,active boolean not null,
  owner_bypass boolean,high_risk boolean not null,requires_managed_device boolean not null
);

-- Exact mapping for the synthetic domains used here. The migration deliberately
-- does not alter the live central department-to-permission mapper.
CREATE OR REPLACE FUNCTION public.office_department_for_permission(p_permission text)
RETURNS text LANGUAGE sql STABLE AS $$
 SELECT CASE
  WHEN p.module='SUPPORT' THEN 'SUPPORT'
  WHEN p.module='CUSTOMER_TRUST' THEN 'CUSTOMER_SUCCESS'
  WHEN p.module IN ('SECRETARIAL','REGISTRATIONS') THEN 'SECRETARIAL'
  WHEN p.module IN ('LEGAL','PRIVACY','COMPLIANCE') THEN 'LEGAL'
  WHEN p.module='SECURITY' THEN 'SECURITY'
  WHEN p.module='OPERATIONS' THEN 'OPERATIONS'
  WHEN p.module='FINANCE' THEN 'FINANCE'
  WHEN p.module='MASTER_DATA' THEN 'SALES'
  WHEN p.module='PEOPLE' THEN 'PEOPLE'
  ELSE null END
 FROM public.office_permission_catalog p
 WHERE p.code=p_permission AND p.active=true;
$$;

INSERT INTO public.office_identity_users(user_id,status) VALUES
 ('00000000-0000-0000-0000-000000000001','ACTIVE'),
 ('00000000-0000-0000-0000-000000000002','ACTIVE'),
 ('00000000-0000-0000-0000-000000000003','ACTIVE'),
 ('00000000-0000-0000-0000-000000000004','ACTIVE'),
 ('00000000-0000-0000-0000-000000000005','SUSPENDED');
INSERT INTO public.office_user_roles(user_id,role) VALUES
 ('00000000-0000-0000-0000-000000000001','OWNER'),
 ('00000000-0000-0000-0000-000000000002','ADMIN'),
 ('00000000-0000-0000-0000-000000000003','DIRECTOR'),
 ('00000000-0000-0000-0000-000000000004','CS');
INSERT INTO public.office_department_ownership(department_code,owner_user_id) VALUES
 ('SUPPORT','00000000-0000-0000-0000-000000000002'),
 ('CUSTOMER_SUCCESS','00000000-0000-0000-0000-000000000002'),
 ('SECRETARIAL','00000000-0000-0000-0000-000000000002'),
 ('LEGAL','00000000-0000-0000-0000-000000000002'),
 ('OPERATIONS','00000000-0000-0000-0000-000000000002'),
 ('SECURITY','00000000-0000-0000-0000-000000000002'),
 ('FINANCE','00000000-0000-0000-0000-000000000003'),
 ('PEOPLE','00000000-0000-0000-0000-000000000003');
INSERT INTO public.office_department_former_owners(department_code,user_id) VALUES
 ('FINANCE','00000000-0000-0000-0000-000000000001');
INSERT INTO public.office_permission_catalog
 (code,module,action,active,owner_bypass,high_risk,requires_managed_device) VALUES
 ('support.case.read','SUPPORT','READ',true,true,false,false),
 ('support.case.manage','SUPPORT','MANAGE',true,true,false,false),
 ('customer.trust.read','CUSTOMER_TRUST','READ_TRUST',true,true,false,true),
 ('customer.trust.manage','CUSTOMER_TRUST','MANAGE_TRUST',true,true,true,true),
 ('secretarial.board.read','SECRETARIAL','READ_BOARD',true,true,false,false),
 ('secretarial.board.manage','SECRETARIAL','MANAGE_BOARD',true,true,true,true),
 ('registration.read','REGISTRATIONS','READ',true,true,false,true),
 ('privacy.case.read','PRIVACY','READ',true,true,false,false),
 ('compliance.rules.read','COMPLIANCE','READ_RULES',true,true,false,false),
 ('security.overview.read','SECURITY','READ_OVERVIEW',true,true,false,true),
 ('operations.asset.read','OPERATIONS','READ_ASSET',true,true,false,true),
 ('legal.obligation.read','LEGAL','READ_OBLIGATION',true,true,false,true),
 ('finance.read','FINANCE','READ',true,true,false,false),
 ('finance.bank.read','FINANCE','READ_BANK',true,true,false,true),
 ('finance.payment.approve','FINANCE','APPROVE',true,true,true,true),
 ('people.sensitive.read','PEOPLE','READ_SENSITIVE',true,false,false,true),
 ('master.customer.read','MASTER_DATA','READ_CUSTOMER',true,true,false,true),
 ('support.refund.approve','SUPPORT','APPROVE',true,false,true,true),
 ('disabled.data.read','SUPPORT','READ',false,true,false,false);
