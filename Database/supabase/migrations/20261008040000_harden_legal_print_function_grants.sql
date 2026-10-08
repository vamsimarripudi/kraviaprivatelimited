-- Existing projects may have role-specific default function privileges. Ensure
-- these server-only SECURITY DEFINER functions are never callable through the
-- public Data API and remain exclusive to the server-side service role.

revoke all on function public.reserve_legal_print_job(text,text,integer,text,text,text) from public, anon, authenticated;
revoke all on function public.confirm_legal_print_job(uuid,text,boolean) from public, anon, authenticated;

grant execute on function public.reserve_legal_print_job(text,text,integer,text,text,text) to service_role;
grant execute on function public.confirm_legal_print_job(uuid,text,boolean) to service_role;
