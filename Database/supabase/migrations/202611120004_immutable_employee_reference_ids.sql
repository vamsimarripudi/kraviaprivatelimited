-- KRAVIA Office: issued employee reference IDs are permanent and write-once.
-- Safe follow-up to 202611120003_verified_employee_intake_and_ids.sql.
-- No existing employee IDs, identity UUIDs, approval records or outbox rows are changed.
-- The reviewed SECURITY DEFINER office_employee_reference_issue RPC is the only
-- authorised issuance path; it runs with the function owner's privileges.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.office_employee_reference_ids
  FROM public, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.office_employee_reference_ids TO service_role;

-- Defence in depth: even a privileged accidental UPDATE or DELETE must fail.
-- Existing identity and issuance history remain intact and auditable.
CREATE OR REPLACE FUNCTION public.office_employee_reference_ids_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $kravia_immutable_ref$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'Issued employee reference IDs cannot be changed or deleted';
END;
$kravia_immutable_ref$;

REVOKE ALL ON FUNCTION public.office_employee_reference_ids_immutable_guard()
  FROM public, anon, authenticated, service_role;

DO $kravia_install_immutable_ref$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.office_employee_reference_ids'::pg_catalog.regclass
      AND tgname = 'office_employee_reference_ids_immutable'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER office_employee_reference_ids_immutable
      BEFORE UPDATE OR DELETE ON public.office_employee_reference_ids
      FOR EACH ROW
      EXECUTE FUNCTION public.office_employee_reference_ids_immutable_guard();
  END IF;
END;
$kravia_install_immutable_ref$;

-- Fail the release if the service role can mutate already-issued references.
DO $kravia_assert_immutable_ref$
BEGIN
  IF pg_catalog.has_table_privilege('service_role', 'public.office_employee_reference_ids', 'INSERT')
    OR pg_catalog.has_table_privilege('service_role', 'public.office_employee_reference_ids', 'UPDATE')
    OR pg_catalog.has_table_privilege('service_role', 'public.office_employee_reference_ids', 'DELETE')
  THEN
    RAISE EXCEPTION 'Employee ID issuance privilege boundary is not enforced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.office_employee_reference_ids'::pg_catalog.regclass
      AND tgname = 'office_employee_reference_ids_immutable'
      AND tgenabled <> 'D'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Employee ID immutability trigger was not installed';
  END IF;
END;
$kravia_assert_immutable_ref$;
