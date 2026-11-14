\set ON_ERROR_STOP on
-- Isolated PostgreSQL 17 test for immediate post-handover authority.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role kravia_office_backend nologin;
create table public.office_identity_users (
  user_id uuid primary key,status text not null,authorization_version bigint not null default 1,
  last_role_change_at timestamptz,updated_at timestamptz
);
create table public.office_user_roles (
  user_id uuid,role text,expires_at timestamptz
);
create table public.office_department_ownership (
  department_code text primary key,owner_user_id uuid
);
create table public.office_department_former_owners (
  department_code text,user_id uuid
);
create table public.office_department_transfer_requests (
 id uuid primary key,department_code text,from_owner_user_id uuid,
 to_owner_user_id uuid,status text,decided_at timestamptz
);
create table public.office_permission_catalog (
 code text primary key,module text,action text,active boolean not null,
 owner_bypass boolean not null,high_risk boolean not null
);
create or replace function public.office_department_for_permission(p_permission text)
returns text language sql stable as $$
 select case when p.module='FINANCE' then 'FINANCE'
             when p.module='PEOPLE' then 'PEOPLE'
             when p.module='PORTFOLIO' then 'PRODUCT'
             when p.module='MASTER_DATA' then 'PRODUCT'
             when p.module='STRATEGY' then 'EXECUTIVE'
             when p.module='SECURITY' then 'SECURITY'
             else null end
 from public.office_permission_catalog p where p.code=p_permission and p.active;
$$;

insert into public.office_identity_users(user_id,status,authorization_version) values
 ('00000000-0000-0000-0000-000000000001','ACTIVE',3),
 ('00000000-0000-0000-0000-000000000002','ACTIVE',7),
 ('00000000-0000-0000-0000-000000000003','ACTIVE',1);
insert into public.office_user_roles(user_id,role) values
 ('00000000-0000-0000-0000-000000000001','OWNER');
insert into public.office_department_ownership(department_code,owner_user_id)
values ('FINANCE','00000000-0000-0000-0000-000000000002'),
 ('PEOPLE','00000000-0000-0000-0000-000000000002'),
 ('PRODUCT','00000000-0000-0000-0000-000000000002'),
 ('EXECUTIVE','00000000-0000-0000-0000-000000000002');
insert into public.office_department_former_owners(department_code,user_id)
values ('FINANCE','00000000-0000-0000-0000-000000000001');
insert into public.office_permission_catalog values
('finance.read','FINANCE','READ',true,true,false),
('finance.bank.read','FINANCE','READ',true,true,false),
('finance.payment.approve','FINANCE','APPROVE',true,true,true),
('people.basic.read','PEOPLE','READ',true,true,false),
('people.sensitive.read','PEOPLE','READ',true,false,false),
('master.product.read','MASTER_DATA','READ_PRODUCT',true,true,false),
('portfolio.read','PORTFOLIO','READ',true,true,false),
('strategy.read','STRATEGY','READ',true,true,false),
('security.overview.read','SECURITY','READ_OVERVIEW',true,true,false);
insert into public.office_department_transfer_requests
 (id,department_code,from_owner_user_id,to_owner_user_id,status,decided_at)
values ('00000000-0000-0000-0000-000000000010','FINANCE',
 '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 'ACCEPTED',now()-interval '1 hour');
\ir ../migrations/202611140002_department_handover_access_sync.sql

do $$
declare founder uuid:='00000000-0000-0000-0000-000000000001';
  owner uuid:='00000000-0000-0000-0000-000000000002';
  other uuid:='00000000-0000-0000-0000-000000000003';
begin
 if public.office_department_permission_verdict(owner,'finance.read')<>'DEPARTMENT_OWNER' then
   raise exception 'Finance owner basic read not granted';
 end if;
 if public.office_department_permission_verdict(owner,'people.basic.read')<>'DEPARTMENT_OWNER' then
   raise exception 'People owner basic read not granted';
 end if;
 if public.office_department_permission_verdict(owner,'portfolio.read')<>'DEPARTMENT_OWNER' then
   raise exception 'Product owner portfolio read not granted';
 end if;
 if public.office_department_permission_verdict(owner,'master.product.read')<>'DEPARTMENT_OWNER' then
   raise exception 'Product owner master read not granted';
 end if;
 if public.office_department_permission_verdict(owner,'strategy.read')<>'DEPARTMENT_OWNER' then
   raise exception 'Executive owner strategy read not granted';
 end if;
 if public.office_department_permission_verdict(owner,'finance.bank.read')<>'DEFAULT' then
   raise exception 'Restricted banking read silently granted';
 end if;
 if public.office_department_permission_verdict(owner,'people.sensitive.read')<>'DEFAULT' then
   raise exception 'Sensitive people read silently granted';
 end if;
 if public.office_department_permission_verdict(owner,'security.overview.read')<>'DEFAULT' then
   raise exception 'Unrelated security data exposed';
 end if;
 if public.office_department_permission_verdict(owner,'finance.payment.approve')<>'DEPARTMENT_OWNER' then
   raise exception 'Existing accepted Finance write authority broken';
 end if;
 if public.office_department_permission_verdict(founder,'finance.payment.approve')<>'DENY' then
   raise exception 'Former owner lost write DENY protection';
 end if;
 if public.office_department_permission_verdict(founder,'finance.read')<>'DEFAULT' then
   raise exception 'Founder read-only oversight was removed';
 end if;
 if public.office_department_permission_verdict(other,'finance.read')<>'DEFAULT' then
   raise exception 'Third-party user gained department read';
 end if;
 if (select authorization_version from public.office_identity_users where user_id=founder)<>4
    or (select authorization_version from public.office_identity_users where user_id=owner)<>8 then
   raise exception 'Existing accepted transfers were not reconciled to fresh authz versions';
 end if;
end;
$$;

insert into public.office_department_transfer_requests
 (id,department_code,from_owner_user_id,to_owner_user_id,status,decided_at)
values ('00000000-0000-0000-0000-000000000011','LEGAL',
 '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',
 'PENDING',null);
update public.office_department_transfer_requests
set status='ACCEPTED',decided_at=now()
where id='00000000-0000-0000-0000-000000000011';
do $$
begin
 if (select authorization_version from public.office_identity_users
     where user_id='00000000-0000-0000-0000-000000000001')<>5
   or (select authorization_version from public.office_identity_users
     where user_id='00000000-0000-0000-0000-000000000003')<>2 then
   raise exception 'New acceptance failed to bump both participants';
 end if;
 raise notice 'PASS: transferred owner can read limited overview; former-owner write DENY; authz versions updated';
end;
$$;
