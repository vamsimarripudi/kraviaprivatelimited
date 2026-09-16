-- KRAVIA Office — invitation lifecycle hardening
-- Apply after SUPABASE_ACCESS_GOVERNANCE.sql.
-- Contains no user-specific identities, invite secrets or credentials.

alter table public.office_identity_users drop constraint if exists office_identity_users_status_check;
alter table public.office_identity_users add constraint office_identity_users_status_check
  check (status in ('INVITED','ACTIVE','SUSPENDED','REVOKED'));

create or replace function public.office_protect_owner_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'ACTIVE'
     and exists (select 1 from public.office_user_roles r where r.user_id=old.user_id and r.role='OWNER') then
    raise exception 'OWNER identity cannot be suspended, revoked or returned to invited state through ordinary administration';
  end if;
  return new;
end;
$$;
drop trigger if exists office_owner_identity_guard on public.office_identity_users;
create trigger office_owner_identity_guard before update of status on public.office_identity_users
for each row execute function public.office_protect_owner_identity();

-- Immutable audit keeps historical UUID snapshots even after an Auth identity is deleted.
-- Foreign-key SET NULL would mutate history and conflict with append-only semantics.
alter table public.office_access_audit drop constraint if exists office_access_audit_actor_user_id_fkey;
alter table public.office_access_audit drop constraint if exists office_access_audit_target_user_id_fkey;
comment on column public.office_access_audit.actor_user_id is 'Historical UUID snapshot; intentionally not an FK so account deletion cannot mutate immutable audit history.';
comment on column public.office_access_audit.target_user_id is 'Historical UUID snapshot; intentionally not an FK so account deletion cannot mutate immutable audit history.';

create or replace function public.office_accept_invitation(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invitation_row public.office_access_invitations%rowtype;
begin
  select * into invitation_row
    from public.office_access_invitations
   where auth_user_id=p_user_id and status='PENDING'
   order by created_at desc
   limit 1
   for update;

  if not found then return false; end if;

  if invitation_row.expires_at <= now() then
    update public.office_access_invitations set status='EXPIRED',updated_at=now() where id=invitation_row.id;
    insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,target_email,action,metadata)
      values(p_user_id,'{}'::text[],p_user_id,invitation_row.email,'INVITE_EXPIRED','{}'::jsonb);
    return false;
  end if;

  update public.office_identity_users set status='ACTIVE',updated_at=now()
   where user_id=p_user_id and status='INVITED';
  if not found then return false; end if;

  update public.office_access_invitations set status='ACCEPTED',accepted_at=now(),updated_at=now()
   where id=invitation_row.id;
  insert into public.office_access_audit(actor_user_id,actor_roles,target_user_id,target_email,action,metadata)
    values(p_user_id,'{}'::text[],p_user_id,invitation_row.email,'INVITE_ACCEPTED','{}'::jsonb);
  return true;
end;
$$;
revoke execute on function public.office_accept_invitation(uuid) from public,anon,authenticated;
grant execute on function public.office_accept_invitation(uuid) to service_role;

comment on column public.office_identity_users.status is 'INVITED has no workspace access; valid controlled invitation acceptance promotes to ACTIVE.';
comment on function public.office_accept_invitation(uuid) is 'Atomically accepts one live KRAVIA Office invitation and promotes INVITED identity to ACTIVE.';
