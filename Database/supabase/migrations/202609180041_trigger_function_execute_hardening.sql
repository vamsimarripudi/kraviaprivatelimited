-- KRAVIA Office — remove browser-callable EXECUTE from trigger-only SECURITY DEFINER helpers.
-- These functions are invoked by database triggers; they are not public RPC endpoints.
-- Keep explicit service-role execution for trusted server-side administrative use.

revoke execute on function public.office_identity_create_person() from public, anon, authenticated;
revoke execute on function public.office_sync_employment_identity() from public, anon, authenticated;

grant execute on function public.office_identity_create_person() to service_role;
grant execute on function public.office_sync_employment_identity() to service_role;
