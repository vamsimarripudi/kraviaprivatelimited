-- Disposable PostgreSQL test fixture only: no real KRAVIA identities or email.
create table public.office_access_invitations (
  requested_roles text[] not null,
  department text,
  constraint office_access_invitations_requested_roles_check
    check (requested_roles <@ array['OWNER','DIRECTOR','ADMIN','FINANCE','CA','CS','LEGAL','HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN']::text[]),
  constraint office_access_invitations_department_check
    check (department is null or department = any(array['EXECUTIVE','ADMINISTRATION','FINANCE','TAX','SECRETARIAL','LEGAL','PEOPLE','OPERATIONS','AUDIT','PRODUCT']::text[]))
);
\i Database/supabase/migrations/202611120002_office_invitation_catalog_alignment.sql
insert into public.office_access_invitations(requested_roles,department) values
  (array['DIRECTOR','FINANCE','HR','MEMBER','PRODUCT_ADMIN'], 'EXECUTIVE'),
  (array['MEMBER'], 'ENGINEERING'),
  (array['MEMBER','LEGAL','CS','OPERATIONS'], 'SECRETARIAL'),
  (array['MEMBER'], 'CUSTOMER_SUCCESS'),
  (array['MEMBER'], 'SUPPORT');
do $$
begin
  begin
    insert into public.office_access_invitations(requested_roles,department)
    values (array['IMPERSONATE_OWNER'], 'ENGINEERING');
    raise exception 'Unknown role unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.office_access_invitations(requested_roles,department)
    values (array['MEMBER'], 'UNKNOWN_DEPARTMENT');
    raise exception 'Unknown department unexpectedly accepted';
  exception when check_violation then null;
  end;
end $$;
select case when count(*)=5 then 'INVITATION_CATALOG_ALIGNMENT_PASS'
else 'INVITATION_CATALOG_ALIGNMENT_FAIL' end from public.office_access_invitations;
