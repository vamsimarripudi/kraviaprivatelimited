-- KRAVIA Office: close unintended Data API access to a SECURITY DEFINER
-- salary-settlement trigger helper. This function is used by a database trigger,
-- not as an unauthenticated or logged-in user RPC.
-- Fixes Supabase Security Advisor lints 0028 and 0029.
-- Do not change the trigger, financial rows, pay evidence, or role policies.
REVOKE EXECUTE ON FUNCTION public.office_salary_settlement_immutable_after_review()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.office_salary_settlement_immutable_after_review()
  TO service_role;
