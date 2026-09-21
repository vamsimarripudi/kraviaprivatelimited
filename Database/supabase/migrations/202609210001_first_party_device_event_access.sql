-- KRAVIA Office — least-privilege device validation for first-party identity events.
--
-- The FastAPI identity runtime needs read-only access to the trusted-device
-- registry when recording DEVICE_LINKED / DEVICE_UNLINKED events against the
-- canonical first-party session ledger. Browser roles remain explicitly denied.

alter table public.office_device_registry enable row level security;

revoke all on table public.office_device_registry from anon, authenticated, public;

grant select on table public.office_device_registry to kravia_office_backend;

drop policy if exists office_device_backend_identity_read on public.office_device_registry;
create policy office_device_backend_identity_read
on public.office_device_registry
as permissive
for select
to kravia_office_backend
using (true);
