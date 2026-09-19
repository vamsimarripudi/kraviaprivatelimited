-- Allow the least-privilege KRAVIA Office backend role to mirror first-party
-- identity state into the protected Office control plane.
--
-- Client roles remain denied. RLS stays enabled; this grants only the trusted
-- backend role access required for Founder bootstrap and private invitations.

grant select, insert, update
on table
  public.office_identity_users,
  public.office_user_roles,
  public.office_access_invitations
to kravia_office_backend;

drop policy if exists office_identity_backend_access on public.office_identity_users;
create policy office_identity_backend_access
on public.office_identity_users
as permissive
for all
to kravia_office_backend
using (true)
with check (true);

drop policy if exists office_roles_backend_access on public.office_user_roles;
create policy office_roles_backend_access
on public.office_user_roles
as permissive
for all
to kravia_office_backend
using (true)
with check (true);

drop policy if exists office_invitations_backend_access on public.office_access_invitations;
create policy office_invitations_backend_access
on public.office_access_invitations
as permissive
for all
to kravia_office_backend
using (true)
with check (true);
