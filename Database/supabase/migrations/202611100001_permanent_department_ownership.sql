-- KRAVIA Office: permanent departmental handover (schema only until deployed).
-- Nothing is transferred by this migration. All 20 departments retain their
-- existing owner-authority defaults until a recipient accepts a transfer.
-- Service-role-only RPCs; never grant this control plane to browser roles.

create table if not exists public.office_department_ownership (
  department_code text primary key references public.office_department_catalog(code),
  owner_user_id uuid not null references public.office_identity_users(user_id),
  previous_owner_user_id uuid references public.office_identity_users(user_id),
  last_transfer_id uuid not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint department_owner_differs_from_previous check (owner_user_id is distinct from previous_owner_user_id)
);

create table if not exists public.office_department_former_owners (
  department_code text not null references public.office_department_catalog(code),
  user_id uuid not null references public.office_identity_users(user_id),
  transferred_away_at timestamptz not null default now(),
  primary key (department_code, user_id)
);

create table if not exists public.office_department_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  department_code text not null references public.office_department_catalog(code),
  from_owner_user_id uuid not null references public.office_identity_users(user_id),
  to_owner_user_id uuid not null references public.office_identity_users(user_id),
  proposed_by uuid not null references public.office_identity_users(user_id),
  reason text not null check (length(btrim(reason)) >= 12),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','CANCELLED')),
  proposed_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.office_identity_users(user_id),
  constraint transfer_requires_other_person check (from_owner_user_id <> to_owner_user_id)
);
create unique index if not exists office_department_one_pending_transfer
  on public.office_department_transfer_requests(department_code) where status='PENDING';
create index if not exists office_department_transfers_recipient
  on public.office_department_transfer_requests(to_owner_user_id,status);

create table if not exists public.office_department_transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.office_department_transfer_requests(id),
  actor_user_id uuid not null references public.office_identity_users(user_id),
  department_code text not null references public.office_department_catalog(code),
  event_type text not null check (event_type in ('PROPOSED','ACCEPTED','CANCELLED')),
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.office_department_ownership enable row level security;
alter table public.office_department_former_owners enable row level security;
alter table public.office_department_transfer_requests enable row level security;
alter table public.office_department_transfer_events enable row level security;
revoke all on public.office_department_ownership, public.office_department_former_owners,
  public.office_department_transfer_requests, public.office_department_transfer_events
  from public, anon, authenticated;
grant select, insert, update, delete on public.office_department_ownership,
  public.office_department_former_owners, public.office_department_transfer_requests
  to service_role;
grant select, insert on public.office_department_transfer_events to service_role;
grant usage, select on sequence public.office_department_transfer_events_id_seq to service_role;

-- No global ACCESS-admin delegation: Founder must retain role-administration ability
-- without acquiring business-write authority in a department already handed over.
create or replace function public.office_department_for_permission(p_permission text)
returns text language sql stable security definer set search_path='' as $$
  select case
    when p.code in ('document.finance.create') then 'FINANCE'
    when p.code in ('document.hr.create') then 'PEOPLE'
    when p.code in ('document.legal.create') then 'LEGAL'
    when p.code in ('document.sales.create') then 'SALES'
    when p.code in ('document.operations.create') then 'OPERATIONS'
    when p.code in ('document.secretarial.create') then 'SECRETARIAL'
    when p.code in ('master.customer.create','master.customer.read') then 'SALES'
    when p.code in ('master.product.create','master.product.read') then 'PRODUCT'
    when p.module in ('FINANCE','PAYROLL','INSURANCE') then 'FINANCE'
    when p.module='ENGINEERING' then 'ENGINEERING'
    when p.module='INFRASTRUCTURE' then 'DEVOPS'
    when p.module in ('HIRING','PEOPLE','TRAVEL') then 'PEOPLE'
    when p.module='SALES' then 'SALES'
    when p.module='OPERATIONS' then 'OPERATIONS'
    when p.module='PROCUREMENT' then 'PROCUREMENT'
    when p.module in ('PRODUCT','PORTFOLIO') then 'PRODUCT'
    when p.module='QUALITY' then 'QUALITY'
    when p.module='SUPPORT' then 'SUPPORT'
    when p.module='CUSTOMER_TRUST' then 'CUSTOMER_SUCCESS'
    when p.module='SECURITY' then 'SECURITY'
    when p.module in ('IT','IDENTITY') then 'IT'
    when p.module in ('LEGAL','PRIVACY','COMPLIANCE','ETHICS') then 'LEGAL'
    when p.module='SECRETARIAL' or p.module='REGISTRATIONS' then 'SECRETARIAL'
    when p.module='TAX' then 'TAX'
    when p.module in ('AUDIT','ASSURANCE') then 'AUDIT'
    when p.module in ('GOVERNANCE','STRATEGY') then 'EXECUTIVE'
    when p.module in ('ADMIN','FACILITIES','KNOWLEDGE') then 'ADMINISTRATION'
    else null
  end
  from public.office_permission_catalog p
  where p.code=p_permission and p.active=true;
$$;

-- DENY for a former owner or a non-current OWNER is non-overridable by a
-- COMPANY profile, an explicit ALLOW override or the legacy OWNER bypass.
-- READ, READ_*, VIEW and AUDIT_USAGE remain available under existing rules.
-- Only a completed transfer (not a proposed transfer) changes permissions.
create or replace function public.office_department_permission_verdict(
  p_actor uuid, p_permission text
) returns text language plpgsql stable security definer set search_path='' as $$
declare
  department text;
  permission_action text;
  current_owner uuid;
begin
  select p.action into permission_action from public.office_permission_catalog p
  where p.code=p_permission and p.active=true;
  if permission_action is null then return 'DENY'; end if;
  if permission_action='VIEW' or permission_action='AUDIT_USAGE'
      or permission_action like 'READ%' then return 'DEFAULT'; end if;

  department:=public.office_department_for_permission(p_permission);
  if department is null then return 'DEFAULT'; end if;
  select o.owner_user_id into current_owner from public.office_department_ownership o
  where o.department_code=department;
  if current_owner is null then return 'DEFAULT'; end if;
  if current_owner=p_actor then return 'DEPARTMENT_OWNER'; end if;

  if exists(select 1 from public.office_department_former_owners f
            where f.department_code=department and f.user_id=p_actor)
     or exists(select 1 from public.office_user_roles r where r.user_id=p_actor
               and r.role='OWNER' and (r.expires_at is null or r.expires_at>now())) then
    return 'DENY';
  end if;
  return 'DEFAULT';
end; $$;

-- Replace the existing permission entrypoint, preserving scoped profile and
-- override semantics, but evaluating ownership and explicit DENY before OWNER.
create or replace function public.office_effective_permission(
  p_user_id uuid, p_permission text, p_scope_type text default 'COMPANY',
  p_scope_key text default null, p_owner_user_id uuid default null
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare
  permission_record public.office_permission_catalog%rowtype;
  verdict text;
begin
  if not exists(select 1 from public.office_identity_users i
                where i.user_id=p_user_id and i.status='ACTIVE') then return false; end if;
  select * into permission_record from public.office_permission_catalog p
  where p.code=p_permission and p.active=true;
  if not found then return false; end if;

  verdict:=public.office_department_permission_verdict(p_user_id,p_permission);
  if verdict='DENY' then return false; end if;

  if exists(
    select 1 from public.office_user_permission_overrides o
    where o.user_id=p_user_id and o.permission_code=p_permission and o.effect='DENY'
      and (o.expires_at is null or o.expires_at>now())
      and public.office_scope_matches(o.scope_type,o.scope_key,
                                      p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  ) then return false; end if;

  if permission_record.owner_bypass is distinct from false and (
    verdict='DEPARTMENT_OWNER' or exists(
      select 1 from public.office_user_roles r where r.user_id=p_user_id
      and r.role='OWNER' and (r.expires_at is null or r.expires_at>now())
    )
  ) then return true; end if;

  if exists(
    select 1 from public.office_user_permission_overrides o
    where o.user_id=p_user_id and o.permission_code=p_permission and o.effect='ALLOW'
      and (o.expires_at is null or o.expires_at>now())
      and public.office_scope_matches(o.scope_type,o.scope_key,
                                      p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  ) then return true; end if;

  return exists(
    select 1 from public.office_user_access_profiles up
    join public.office_access_profile_permissions pp on
       pp.profile_code=up.profile_code and pp.permission_code=p_permission and pp.effect='ALLOW'
    where up.user_id=p_user_id and up.status='ACTIVE'
      and (up.expires_at is null or up.expires_at>now())
      and public.office_scope_matches(up.scope_type,up.scope_key,
                                      p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  );
end; $$;

create or replace function public.office_department_transfer_propose(
  p_actor uuid, p_department text, p_recipient uuid, p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  dept public.office_department_catalog%rowtype;
  existing_owner uuid;
  request_id uuid;
begin
  select * into dept from public.office_department_catalog
    where code=p_department and active=true for update;
  if not found then raise exception 'Active department not found'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
     or not exists(select 1 from public.office_identity_users where user_id=p_recipient and status='ACTIVE') then
    raise exception 'Both current and proposed department owners must be active Office identities';
  end if;
  if p_actor=p_recipient then raise exception 'A different person must receive ownership'; end if;
  if length(btrim(coalesce(p_reason,'')))<12 then raise exception 'A substantive transfer reason is required'; end if;

  select o.owner_user_id into existing_owner from public.office_department_ownership o
    where o.department_code=p_department;
  if existing_owner is null then
    if not exists(select 1 from public.office_user_roles r
                  where r.user_id=p_actor and r.role='OWNER'
                  and (r.expires_at is null or r.expires_at>now())) then
      raise exception 'Only an active Founder can assign an unowned department';
    end if;
  elsif existing_owner<>p_actor then
    raise exception 'Only the current department owner may propose a transfer';
  end if;
  if exists(select 1 from public.office_department_transfer_requests t
            where t.department_code=p_department and t.status='PENDING') then
    raise exception 'A pending transfer already exists for this department';
  end if;

  insert into public.office_department_transfer_requests
     (department_code,from_owner_user_id,to_owner_user_id,proposed_by,reason)
  values(p_department,p_actor,p_recipient,p_actor,btrim(p_reason)) returning id into request_id;
  insert into public.office_department_transfer_events
     (transfer_id,actor_user_id,department_code,event_type,metadata)
  values(request_id,p_actor,p_department,'PROPOSED',jsonb_build_object('to',p_recipient));
  return request_id;
end; $$;

create or replace function public.office_department_transfer_accept(
  p_actor uuid, p_transfer uuid
) returns text language plpgsql security definer set search_path='' as $$
declare
  req public.office_department_transfer_requests%rowtype;
  present_owner uuid;
begin
  -- Lock the department in the same order as proposal to prevent races.
  select * into req from public.office_department_transfer_requests
    where id=p_transfer;
  if not found or req.status<>'PENDING' then raise exception 'Pending transfer not found'; end if;
  perform 1 from public.office_department_catalog where code=req.department_code and active=true for update;
  select * into req from public.office_department_transfer_requests
    where id=p_transfer for update;
  if req.status<>'PENDING' then raise exception 'Transfer already decided'; end if;
  if p_actor<>req.to_owner_user_id then raise exception 'Only the proposed recipient can accept'; end if;
  if p_actor=req.proposed_by then raise exception 'Proposer cannot accept their own transfer'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then
    raise exception 'Recipient must have an active Office identity';
  end if;
  select owner_user_id into present_owner from public.office_department_ownership
    where department_code=req.department_code;
  if present_owner is distinct from req.from_owner_user_id and present_owner is not null then
    raise exception 'Department owner changed before acceptance';
  end if;
  if present_owner is null and not exists(
    select 1 from public.office_user_roles where user_id=req.from_owner_user_id
    and role='OWNER' and (expires_at is null or expires_at>now())
  ) then raise exception 'Founding owner is no longer authorised'; end if;

  insert into public.office_department_ownership
    (department_code,owner_user_id,previous_owner_user_id,last_transfer_id)
  values(req.department_code,p_actor,req.from_owner_user_id,req.id)
  on conflict(department_code) do update set
    owner_user_id=excluded.owner_user_id,
    previous_owner_user_id=excluded.previous_owner_user_id,
    last_transfer_id=excluded.last_transfer_id,
    version=public.office_department_ownership.version+1,
    updated_at=now();

  insert into public.office_department_former_owners(department_code,user_id,transferred_away_at)
  values(req.department_code,req.from_owner_user_id,now())
  on conflict(department_code,user_id) do update set transferred_away_at=now();
  delete from public.office_department_former_owners
    where department_code=req.department_code and user_id=p_actor;
  update public.office_department_transfer_requests set status='ACCEPTED',
    decided_at=now(),decided_by=p_actor where id=req.id;
  insert into public.office_department_transfer_events
     (transfer_id,actor_user_id,department_code,event_type,metadata)
  values(req.id,p_actor,req.department_code,'ACCEPTED',
         jsonb_build_object('previous_owner',req.from_owner_user_id,'owner',p_actor));
  return 'ACCEPTED';
end; $$;

create or replace function public.office_department_transfer_cancel(
  p_actor uuid, p_transfer uuid
) returns text language plpgsql security definer set search_path='' as $$
declare req public.office_department_transfer_requests%rowtype;
begin
  select * into req from public.office_department_transfer_requests where id=p_transfer for update;
  if not found or req.status<>'PENDING' then raise exception 'Pending transfer not found'; end if;
  if p_actor<>req.from_owner_user_id and p_actor<>req.to_owner_user_id then
    raise exception 'Only the current owner or recipient may cancel';
  end if;
  update public.office_department_transfer_requests set status='CANCELLED',
    decided_at=now(),decided_by=p_actor where id=req.id;
  insert into public.office_department_transfer_events
    (transfer_id,actor_user_id,department_code,event_type)
  values(req.id,p_actor,req.department_code,'CANCELLED');
  return 'CANCELLED';
end; $$;

revoke all on function public.office_department_for_permission(text) from public,anon,authenticated;
revoke all on function public.office_department_permission_verdict(uuid,text) from public,anon,authenticated;
revoke all on function public.office_effective_permission(uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.office_department_transfer_propose(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.office_department_transfer_accept(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_department_transfer_cancel(uuid,uuid) from public,anon,authenticated;

grant execute on function public.office_department_for_permission(text) to service_role;
grant execute on function public.office_department_permission_verdict(uuid,text) to service_role;
-- FastAPI runs with a constrained PostgreSQL execution role. It must be able
-- to ask for a read-only verdict before processing protected mutations.
-- Do not grant this backend role transfer proposal/acceptance authority.
grant execute on function public.office_department_permission_verdict(uuid,text) to kravia_office_backend;
grant execute on function public.office_effective_permission(uuid,text,text,text,uuid) to service_role;
grant execute on function public.office_department_transfer_propose(uuid,text,uuid,text) to service_role;
grant execute on function public.office_department_transfer_accept(uuid,uuid) to service_role;
grant execute on function public.office_department_transfer_cancel(uuid,uuid) to service_role;

-- One controlled read for responsive sidebar/action capability presentation.
-- It is a UI hint only; every mutation must still use the DB permission check.
create or replace function public.office_department_capability_changes(p_actor uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'denied',coalesce(jsonb_agg(p.code) filter (where x.verdict='DENY'),'[]'::jsonb),
    'owned',coalesce(jsonb_agg(p.code) filter (
      where x.verdict='DEPARTMENT_OWNER' and p.owner_bypass is distinct from false
    ),'[]'::jsonb)
  ) from public.office_permission_catalog p
  cross join lateral (select public.office_department_permission_verdict(p_actor,p.code) as verdict) x
  where p.active=true;
$$;
revoke all on function public.office_department_capability_changes(uuid) from public,anon,authenticated;
grant execute on function public.office_department_capability_changes(uuid) to service_role;

-- First-party FastAPI executes under the restricted database role.
-- Grant only the read-only verdict function, never ownership mutation RPCs.
grant execute on function public.office_department_permission_verdict(uuid,text) to kravia_office_backend;
