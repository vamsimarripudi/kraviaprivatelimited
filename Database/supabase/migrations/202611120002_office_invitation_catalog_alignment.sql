-- Fix the live invitation blocker: the historical CHECK predates MEMBER
-- and the expanded 20-department catalog. The first-party invite API already
-- validates these controlled values before writing to the database.
--
-- Safe additive policy alignment: does not create identities, invitations,
-- messages, access profiles, or role assignments. Existing data is retained.
BEGIN;
SET LOCAL lock_timeout = '8s';
ALTER TABLE public.office_access_invitations
  DROP CONSTRAINT office_access_invitations_requested_roles_check;
ALTER TABLE public.office_access_invitations
  ADD CONSTRAINT office_access_invitations_requested_roles_check
    CHECK (
      requested_roles <@ ARRAY[
        'OWNER','DIRECTOR','ADMIN','MEMBER','FINANCE','CA','CS','LEGAL',
        'HR','OPERATIONS','AUDITOR','PRODUCT_ADMIN'
      ]::text[]
    );
ALTER TABLE public.office_access_invitations
  DROP CONSTRAINT office_access_invitations_department_check;
ALTER TABLE public.office_access_invitations
  ADD CONSTRAINT office_access_invitations_department_check
    CHECK (
      department IS NULL OR department = ANY(ARRAY[
        'EXECUTIVE','ADMINISTRATION','ENGINEERING','DEVOPS','SECURITY',
        'IT','QUALITY','PRODUCT','PEOPLE','FINANCE','TAX','SECRETARIAL',
        'LEGAL','SALES','MARKETING','CUSTOMER_SUCCESS','SUPPORT',
        'OPERATIONS','PROCUREMENT','AUDIT'
      ]::text[])
    );
COMMIT;
