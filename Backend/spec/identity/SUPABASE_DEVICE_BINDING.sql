-- KRAVIA Office OS — cryptographic browser binding for administrator-approved company devices.
-- This is a V1 trust anchor; future company laptops may additionally use MDM/device certificates.

alter table public.office_device_registry add column if not exists binding_token_hash text;
alter table public.office_device_registry add column if not exists bound_at timestamptz;
alter table public.office_device_registry add column if not exists bound_user_agent_hash text;

create unique index if not exists office_device_binding_token_unique
  on public.office_device_registry(binding_token_hash)
  where binding_token_hash is not null;

create or replace function public.office_bind_trusted_device(
  p_user uuid,
  p_device uuid,
  p_token_hash text,
  p_user_agent_hash text default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_device public.office_device_registry%rowtype;
begin
  if p_token_hash is null or char_length(p_token_hash)<>64 then raise exception 'Invalid device binding token hash'; end if;
  if p_user_agent_hash is not null and char_length(p_user_agent_hash)<>64 then raise exception 'Invalid user-agent hash'; end if;
  if not exists(select 1 from public.office_identity_users i where i.user_id=p_user and i.status='ACTIVE') then raise exception 'Office identity is not active'; end if;

  select * into v_device from public.office_device_registry where id=p_device and user_id=p_user for update;
  if v_device.id is null then raise exception 'Registered Office device not found'; end if;
  if v_device.trust_state<>'TRUSTED' or v_device.company_managed is not true or v_device.revoked_at is not null then raise exception 'Only a trusted company-managed device can be bound'; end if;

  update public.office_device_registry
  set binding_token_hash=p_token_hash,bound_at=now(),bound_user_agent_hash=p_user_agent_hash,last_seen_at=now(),updated_at=now()
  where id=p_device;
  return true;
end; $$;

create or replace function public.office_validate_device_binding(
  p_user uuid,
  p_device uuid,
  p_token_hash text
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_valid boolean;
begin
  if p_token_hash is null or char_length(p_token_hash)<>64 then return false; end if;
  select exists(
    select 1 from public.office_device_registry d
    where d.id=p_device and d.user_id=p_user and d.trust_state='TRUSTED' and d.company_managed is true
      and d.revoked_at is null and d.binding_token_hash=p_token_hash
  ) into v_valid;
  if v_valid then update public.office_device_registry set last_seen_at=now(),updated_at=now() where id=p_device; end if;
  return v_valid;
end; $$;

create or replace function public.office_clear_revoked_device_binding() returns trigger
language plpgsql set search_path=''
as $$
begin
  if new.trust_state='REVOKED' or new.revoked_at is not null then
    new.binding_token_hash:=null;
    new.bound_at:=null;
    new.bound_user_agent_hash:=null;
  end if;
  return new;
end; $$;

drop trigger if exists office_device_clear_binding_on_revoke on public.office_device_registry;
create trigger office_device_clear_binding_on_revoke before update of trust_state,revoked_at on public.office_device_registry for each row execute function public.office_clear_revoked_device_binding();

revoke all on function public.office_bind_trusted_device(uuid,uuid,text,text) from anon,authenticated,public;
revoke all on function public.office_validate_device_binding(uuid,uuid,text) from anon,authenticated,public;
grant execute on function public.office_bind_trusted_device(uuid,uuid,text,text) to service_role;
grant execute on function public.office_validate_device_binding(uuid,uuid,text) to service_role;

comment on column public.office_device_registry.binding_token_hash is 'SHA-256 of the HttpOnly Office device binding token. Raw binding tokens are never stored.';
comment on column public.office_device_registry.bound_user_agent_hash is 'Security signal recorded at binding time; not used as sole device identity.';
