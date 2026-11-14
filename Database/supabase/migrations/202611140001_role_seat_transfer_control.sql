-- KRAVIA Office: transferable role seats, scoped authority, and governed handovers.
-- Schema-only: NO employee is appointed, transferred, granted rights, or notified.
-- Apply with approved migration tooling BEFORE deploying matching server/client code.

-- Register the reusable job vocabulary without assigning it to any person.
insert into public.office_position_catalog
  (code,label,family,level,is_manager,description,active)
values ('FULL_STACK_DEVELOPER','Full Stack Developer','ENGINEERING',5,false,
  'Frontend, backend, database, integration and test delivery under assigned project/repository scope',true)
on conflict (code) do nothing;

create table if not exists public.office_role_seats (
  id uuid primary key default gen_random_uuid(),
  seat_code text not null unique check (seat_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  label text not null check (char_length(trim(label)) between 3 and 120),
  position_code text not null references public.office_position_catalog(code),
  department_code text not null references public.office_department_catalog(code),
  description text not null default '',
  responsibilities jsonb not null default '[]'::jsonb check (jsonb_typeof(responsibilities)='array'),
  current_holder_user_id uuid references public.office_identity_users(user_id),
  status text not null default 'VACANT' check (status in ('VACANT','ACTIVE','RETIRED')),
  department_ownership_required boolean not null default false,
  version bigint not null default 1,
  created_by uuid not null references public.office_identity_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seat_holder_status check (
    (status='ACTIVE' and current_holder_user_id is not null) or
    (status in ('VACANT','RETIRED') and current_holder_user_id is null)
  ),
  constraint no_general_founder_seat check (position_code <> 'OWNER_FOUNDER')
);

create table if not exists public.office_role_seat_assignments (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.office_role_seats(id),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  status text not null check (status in ('ACTIVE','FORMER')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  handover_id uuid,
  created_at timestamptz not null default now(),
  constraint assignment_date_order check (ended_at is null or ended_at >= started_at),
  constraint assignment_end_state check ((status='ACTIVE' and ended_at is null) or (status='FORMER' and ended_at is not null))
);
create unique index if not exists office_role_seat_one_active_assignment
  on public.office_role_seat_assignments(seat_id) where status='ACTIVE';
create index if not exists office_role_seat_assignments_employee
  on public.office_role_seat_assignments(employee_user_id, status);

create table if not exists public.office_role_seat_grants (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.office_role_seats(id),
  permission_code text not null references public.office_permission_catalog(code),
  scope_type text not null default 'COMPANY'
    check (scope_type in ('COMPANY','DEPARTMENT','TEAM','PRODUCT','PROJECT','REPOSITORY','COST_CENTER','OWN')),
  scope_key text,
  exclusive boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','REJECTED')),
  created_by uuid not null references public.office_identity_users(user_id),
  reviewed_by uuid references public.office_identity_users(user_id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_reason text,
  constraint seat_grant_scope_key check (
    (scope_type in ('COMPANY','OWN') and scope_key is null) or
    (scope_type not in ('COMPANY','OWN') and scope_key is not null and char_length(trim(scope_key))>0)
  )
);
create unique index if not exists office_role_seat_unique_grant
  on public.office_role_seat_grants(seat_id, permission_code,scope_type,coalesce(scope_key,''));

create table if not exists public.office_role_seat_former_holders (
  seat_id uuid not null references public.office_role_seats(id),
  employee_user_id uuid not null references public.office_identity_users(user_id),
  transferred_away_at timestamptz not null default now(),
  primary key (seat_id, employee_user_id)
);

create table if not exists public.office_role_seat_transfers (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.office_role_seats(id),
  from_user_id uuid references public.office_identity_users(user_id),
  to_user_id uuid not null references public.office_identity_users(user_id),
  proposed_by uuid not null references public.office_identity_users(user_id),
  reason text not null check (char_length(trim(reason)) between 12 and 2000),
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED','ACCEPTED','COMPLETED','CANCELLED')),
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.office_identity_users(user_id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.office_identity_users(user_id),
  cutover_evidence text,
  constraint transfer_not_self check (from_user_id is distinct from to_user_id),
  constraint transfer_dates check (
    (status <> 'ACCEPTED' or accepted_at is not null) and
    (status <> 'COMPLETED' or (accepted_at is not null and completed_at is not null))
  )
);
create unique index if not exists office_role_seat_one_open_transfer
  on public.office_role_seat_transfers(seat_id) where status in ('PROPOSED','ACCEPTED');

create table if not exists public.office_role_seat_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.office_role_seat_transfers(id),
  item_code text not null check (item_code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  label text not null check (char_length(trim(label)) between 5 and 180),
  category text not null check (category in ('INTERNAL','PROVIDER','GOVERNANCE')),
  required boolean not null default true,
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED')),
  evidence_reference text,
  verified_by uuid references public.office_identity_users(user_id),
  verified_at timestamptz,
  unique(transfer_id,item_code),
  constraint seat_item_evidence check (
    (status='PENDING' and verified_by is null and verified_at is null) or
    (status='VERIFIED' and verified_by is not null and verified_at is not null and char_length(trim(evidence_reference))>=8)
  )
);

create table if not exists public.office_role_seat_events (
  id bigint generated always as identity primary key,
  seat_id uuid not null references public.office_role_seats(id),
  transfer_id uuid references public.office_role_seat_transfers(id),
  actor_user_id uuid not null references public.office_identity_users(user_id),
  event_type text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.office_role_seat_event_immutable()
returns trigger language plpgsql set search_path to '' as $$
begin
  raise exception 'Role-seat audit history is immutable';
end;
$$;
drop trigger if exists office_role_seat_events_immutable on public.office_role_seat_events;
create trigger office_role_seat_events_immutable before update or delete
on public.office_role_seat_events for each row execute function public.office_role_seat_event_immutable();

do $$
declare t text;
begin
  foreach t in array array[
    'office_role_seats','office_role_seat_assignments','office_role_seat_grants',
    'office_role_seat_former_holders','office_role_seat_transfers',
    'office_role_seat_transfer_items','office_role_seat_events'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end;
$$;
revoke update,delete on public.office_role_seat_events from service_role;
grant usage,select on sequence public.office_role_seat_events_id_seq to service_role;

-- The protected Founder/OWNER authority is never re-issued through a transferable role seat.
create or replace function public.office_role_seat_is_owner(p_actor uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists(select 1 from public.office_identity_users i
     join public.office_user_roles r on r.user_id=i.user_id
     where i.user_id=p_actor and i.status='ACTIVE'
       and r.role='OWNER' and (r.expires_at is null or r.expires_at>now()));
$$;

create or replace function public.office_role_seat_is_independent_reviewer(
  p_actor uuid, p_from uuid, p_to uuid
) returns boolean language plpgsql stable security definer set search_path to '' as $
begin
  if p_actor is not distinct from p_from or p_actor is not distinct from p_to then return false; end if;
  if not exists(select 1 from public.office_identity_users i
     join public.office_user_roles r on r.user_id=i.user_id
     where i.user_id=p_actor and i.status='ACTIVE'
       and r.role in ('OWNER','ADMIN','DIRECTOR')
       and (r.expires_at is null or r.expires_at>now())) then return false; end if;
  -- A title alone never supplies reviewer authority. The reviewer must have
  -- independent COMPANY-scoped access administration or security review rights.
  return public.office_effective_permission(p_actor,'access.profile.assign','COMPANY',null,null)
      or public.office_effective_permission(p_actor,'security.change.review','COMPANY',null,null);
end;
$;

create or replace function public.office_role_seat_create(
 p_actor uuid,p_code text,p_label text,p_position text,p_department text,
 p_description text,p_department_owner boolean
) returns uuid language plpgsql security definer set search_path to '' as $$
declare sid uuid;
begin
  if not public.office_role_seat_is_owner(p_actor) then raise exception 'OWNER authority required'; end if;
  if p_position='OWNER_FOUNDER' then raise exception 'Founder identity cannot be transferred as a role seat'; end if;
  if not exists(select 1 from public.office_position_catalog where code=p_position and active=true) then raise exception 'Unknown active position'; end if;
  if not exists(select 1 from public.office_department_catalog where code=p_department and active=true) then raise exception 'Unknown active department'; end if;
  insert into public.office_role_seats
    (seat_code,label,position_code,department_code,description,department_ownership_required,created_by)
  values(upper(trim(p_code)),trim(p_label),p_position,p_department,coalesce(p_description,''),coalesce(p_department_owner,false),p_actor)
  returning id into sid;
  insert into public.office_role_seat_events(seat_id,actor_user_id,event_type,evidence)
  values(sid,p_actor,'SEAT_REGISTERED',jsonb_build_object('position',p_position,'department',p_department,'status','VACANT'));
  return sid;
end;
$$;

-- A grant is a seat entitlement only, not a modification of an employee's base role.
-- High-risk grants require a separate independent reviewer before becoming usable.
create or replace function public.office_role_seat_add_grant(
 p_actor uuid,p_seat uuid,p_permission text,p_scope_type text,p_scope_key text,p_exclusive boolean
) returns uuid language plpgsql security definer set search_path to '' as $$
declare rec public.office_role_seats%rowtype; pr public.office_permission_catalog%rowtype; gid uuid; state text; mapped_department text;
begin
  if not public.office_role_seat_is_owner(p_actor) then raise exception 'OWNER authority required'; end if;
  select * into rec from public.office_role_seats where id=p_seat for update;
  if not found or rec.status='RETIRED' then raise exception 'Active role seat not found'; end if;
  select * into pr from public.office_permission_catalog where code=p_permission and active=true;
  if not found then raise exception 'Invalid permission'; end if;
  if pr.owner_bypass=false then raise exception 'Protected permission needs independent governance, not a role seat'; end if;
  if p_scope_type not in ('COMPANY','DEPARTMENT','TEAM','PRODUCT','PROJECT','REPOSITORY','COST_CENTER','OWN')
      or (p_scope_type in ('COMPANY','OWN') and p_scope_key is not null)
      or (p_scope_type not in ('COMPANY','OWN') and nullif(trim(coalesce(p_scope_key,'')),'') is null) then
    raise exception 'Invalid grant scope';
  end if;
  if coalesce(p_exclusive,false) and (pr.action='VIEW' or pr.action='AUDIT_USAGE' or pr.action like 'READ%') then
    raise exception 'Exclusive transfer does not apply to read-only permission';
  end if;
  mapped_department:=public.office_department_for_permission(p_permission);
  if coalesce(p_exclusive,false) and mapped_department is not null
      and mapped_department<>rec.department_code then
    raise exception 'Exclusive permission must belong to this seat department';
  end if;
  state:=case when pr.high_risk then 'PENDING' else 'ACTIVE' end;
  insert into public.office_role_seat_grants
    (seat_id,permission_code,scope_type,scope_key,exclusive,status,created_by)
  values(p_seat,p_permission,p_scope_type,p_scope_key,coalesce(p_exclusive,false),state,p_actor)
  returning id into gid;
  insert into public.office_role_seat_events(seat_id,actor_user_id,event_type,evidence)
  values(p_seat,p_actor,'SEAT_GRANT_ADDED',jsonb_build_object('permission',p_permission,'scope',p_scope_type,'exclusive',p_exclusive,'status',state));
  return gid;
end;
$$;

create or replace function public.office_role_seat_review_grant(
 p_actor uuid,p_grant uuid,p_approve boolean,p_reason text
) returns text language plpgsql security definer set search_path to '' as $$
declare g public.office_role_seat_grants%rowtype; holder uuid; result text;
begin
  select * into g from public.office_role_seat_grants where id=p_grant for update;
  if not found or g.status<>'PENDING' then raise exception 'Pending grant not found'; end if;
  select current_holder_user_id into holder from public.office_role_seats where id=g.seat_id;
  if not public.office_role_seat_is_independent_reviewer(p_actor,g.created_by,holder) then
    raise exception 'Independent authorized review required';
  end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Review reason required'; end if;
  result:=case when p_approve then 'ACTIVE' else 'REJECTED' end;
  update public.office_role_seat_grants set status=result,reviewed_by=p_actor,
    reviewed_at=now(),review_reason=trim(p_reason) where id=p_grant;
  insert into public.office_role_seat_events(seat_id,actor_user_id,event_type,evidence)
  values(g.seat_id,p_actor,'SEAT_GRANT_REVIEWED',jsonb_build_object('permission',g.permission_code,'decision',result));
  return result;
end;
$$;

create or replace function public.office_role_seat_propose_transfer(
 p_actor uuid,p_seat uuid,p_recipient uuid,p_reason text
) returns uuid language plpgsql security definer set search_path to '' as $$
declare s public.office_role_seats%rowtype; tid uuid;
begin
  select * into s from public.office_role_seats where id=p_seat for update;
  if not found or s.status='RETIRED' then raise exception 'Seat not transferable'; end if;
  if s.current_holder_user_id is null then
    if not public.office_role_seat_is_owner(p_actor) then raise exception 'Only OWNER may appoint a vacant seat'; end if;
  elsif p_actor is distinct from s.current_holder_user_id and not public.office_role_seat_is_owner(p_actor) then
    raise exception 'Current holder or OWNER must propose';
  end if;
  if p_recipient=s.current_holder_user_id then raise exception 'Recipient already holds this seat'; end if;
  if length(trim(coalesce(p_reason,'')))<12 then raise exception 'Document the transfer reason'; end if;
  if not exists(select 1 from public.office_identity_users i
    join public.office_auth_users a on a.id=i.user_id::text
    where i.user_id=p_recipient and i.status='ACTIVE'
      and a.status='ACTIVE' and a.workspace_status='ACTIVE') then
    raise exception 'Recipient must have an active approved Office identity';
  end if;
  insert into public.office_role_seat_transfers
    (seat_id,from_user_id,to_user_id,proposed_by,reason)
  values(s.id,s.current_holder_user_id,p_recipient,p_actor,trim(p_reason))
  returning id into tid;
  insert into public.office_role_seat_transfer_items(transfer_id,item_code,label,category) values
    (tid,'WORK_HANDOVER','Open work, responsibilities, and decision queue','INTERNAL'),
    (tid,'ACCESS_REVIEW','Role permissions and former-holder revocation review','GOVERNANCE');
  if s.department_ownership_required then
    insert into public.office_role_seat_transfer_items(transfer_id,item_code,label,category)
    values(tid,'DEPARTMENT_HANDOVER','Recorded department ownership accepted by recipient','GOVERNANCE');
  end if;
  if s.department_code in ('ENGINEERING','DEVOPS','IT','FINANCE','SECURITY','PRODUCT') then
    insert into public.office_role_seat_transfer_items(transfer_id,item_code,label,category)
    values(tid,'PROVIDER_CUTOVER','External provider access, project ownership and secrets review','PROVIDER');
  end if;
  if s.position_code in ('CEO','CFO','COO','CTO','DIRECTOR','MANAGING_DIRECTOR') then
    insert into public.office_role_seat_transfer_items(transfer_id,item_code,label,category)
    values(tid,'APPOINTMENT_EVIDENCE','Independent appointment and governance evidence','GOVERNANCE');
  end if;
  insert into public.office_role_seat_events(seat_id,transfer_id,actor_user_id,event_type,evidence)
  values(s.id,tid,p_actor,'TRANSFER_PROPOSED',jsonb_build_object('recipient',p_recipient,'former_holder',s.current_holder_user_id));
  return tid;
end;
$$;

create or replace function public.office_role_seat_accept_transfer(p_actor uuid,p_transfer uuid)
returns text language plpgsql security definer set search_path to '' as $$
declare tr public.office_role_seat_transfers%rowtype; current_holder uuid;
begin
  select * into tr from public.office_role_seat_transfers where id=p_transfer for update;
  if not found or tr.status<>'PROPOSED' then raise exception 'Proposed transfer not found'; end if;
  if p_actor<>tr.to_user_id then raise exception 'Only the recipient can accept'; end if;
  select current_holder_user_id into current_holder from public.office_role_seats where id=tr.seat_id;
  if current_holder is distinct from tr.from_user_id then raise exception 'Role holder changed'; end if;
  update public.office_role_seat_transfers set status='ACCEPTED',accepted_at=now() where id=p_transfer;
  insert into public.office_role_seat_events(seat_id,transfer_id,actor_user_id,event_type)
  values(tr.seat_id,tr.id,p_actor,'TRANSFER_ACCEPTED');
  return 'ACCEPTED';
end;
$$;

create or replace function public.office_role_seat_verify_item(
 p_actor uuid,p_item uuid,p_evidence text
) returns text language plpgsql security definer set search_path to '' as $$
declare item public.office_role_seat_transfer_items%rowtype; tr public.office_role_seat_transfers%rowtype; s public.office_role_seats%rowtype;
begin
  select * into item from public.office_role_seat_transfer_items where id=p_item for update;
  if not found or item.status<>'PENDING' then raise exception 'Pending checklist item not found'; end if;
  select * into tr from public.office_role_seat_transfers where id=item.transfer_id for update;
  if tr.status<>'ACCEPTED' then raise exception 'Recipient must accept first'; end if;
  if not public.office_role_seat_is_independent_reviewer(p_actor,tr.from_user_id,tr.to_user_id) then
    raise exception 'Independent authorized review required';
  end if;
  if length(trim(coalesce(p_evidence,'')))<8 then raise exception 'Evidence reference required'; end if;
  select * into s from public.office_role_seats where id=tr.seat_id;
  if item.item_code='DEPARTMENT_HANDOVER' and not exists (
    select 1 from public.office_department_ownership
      where department_code=s.department_code and owner_user_id=tr.to_user_id
  ) then raise exception 'Department owner must accept the separate department transfer first'; end if;
  update public.office_role_seat_transfer_items set status='VERIFIED',
    evidence_reference=trim(p_evidence),verified_by=p_actor,verified_at=now() where id=item.id;
  insert into public.office_role_seat_events(seat_id,transfer_id,actor_user_id,event_type,evidence)
  values(s.id,tr.id,p_actor,'TRANSFER_ITEM_VERIFIED',jsonb_build_object('item',item.item_code,'reference',trim(p_evidence)));
  return 'VERIFIED';
end;
$$;

create or replace function public.office_role_seat_finalize_transfer(
 p_actor uuid,p_transfer uuid,p_evidence text
) returns text language plpgsql security definer set search_path to '' as $$
declare tr public.office_role_seat_transfers%rowtype; s public.office_role_seats%rowtype;
begin
  select * into tr from public.office_role_seat_transfers where id=p_transfer for update;
  if not found or tr.status<>'ACCEPTED' then raise exception 'Accepted transfer not found'; end if;
  if not public.office_role_seat_is_independent_reviewer(p_actor,tr.from_user_id,tr.to_user_id) then
    raise exception 'Independent authorized cutover required';
  end if;
  if length(trim(coalesce(p_evidence,'')))<8 then raise exception 'Cutover evidence required'; end if;
  select * into s from public.office_role_seats where id=tr.seat_id for update;
  if s.current_holder_user_id is distinct from tr.from_user_id then raise exception 'Role holder changed before cutover'; end if;
  if exists(select 1 from public.office_role_seat_transfer_items where transfer_id=tr.id and required and status<>'VERIFIED') then
    raise exception 'Required internal, governance or provider handover evidence is incomplete';
  end if;
  if s.department_ownership_required and not exists(
    select 1 from public.office_department_ownership
    where department_code=s.department_code and owner_user_id=tr.to_user_id
  ) then raise exception 'Formal department ownership handover has not completed'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=tr.to_user_id and status='ACTIVE') then
    raise exception 'Recipient must remain active'; end if;
  update public.office_role_seat_assignments
    set status='FORMER',ended_at=now(),handover_id=tr.id
    where seat_id=s.id and status='ACTIVE';
  if tr.from_user_id is not null then
    insert into public.office_role_seat_former_holders(seat_id,employee_user_id)
    values(s.id,tr.from_user_id)
    on conflict (seat_id,employee_user_id) do update set transferred_away_at=now();
  end if;
  delete from public.office_role_seat_former_holders where seat_id=s.id and employee_user_id=tr.to_user_id;
  update public.office_role_seats set current_holder_user_id=tr.to_user_id,
    status='ACTIVE',version=version+1,updated_at=now() where id=s.id;
  insert into public.office_role_seat_assignments
    (seat_id,employee_user_id,status,handover_id)
  values(s.id,tr.to_user_id,'ACTIVE',tr.id);
  update public.office_role_seat_transfers set status='COMPLETED',
    completed_at=now(),completed_by=p_actor,cutover_evidence=trim(p_evidence)
    where id=tr.id;
  insert into public.office_role_seat_events(seat_id,transfer_id,actor_user_id,event_type,evidence)
  values(s.id,tr.id,p_actor,'TRANSFER_COMPLETED',
    jsonb_build_object('former_holder',tr.from_user_id,'successor',tr.to_user_id,'evidence',trim(p_evidence)));
  return 'COMPLETED';
end;
$$;

create or replace function public.office_role_seat_cancel_transfer(
 p_actor uuid,p_transfer uuid,p_reason text
) returns text language plpgsql security definer set search_path to '' as $$
declare tr public.office_role_seat_transfers%rowtype;
begin
  select * into tr from public.office_role_seat_transfers where id=p_transfer for update;
  if not found or tr.status not in ('PROPOSED','ACCEPTED') then raise exception 'Open transfer not found'; end if;
  if p_actor is distinct from tr.proposed_by and p_actor is distinct from tr.from_user_id
      and p_actor is distinct from tr.to_user_id and not public.office_role_seat_is_owner(p_actor) then
    raise exception 'Only the transfer participants or OWNER can cancel';
  end if;
  if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Cancellation reason required'; end if;
  update public.office_role_seat_transfers set status='CANCELLED',cancelled_at=now(),cancelled_by=p_actor where id=tr.id;
  insert into public.office_role_seat_events(seat_id,transfer_id,actor_user_id,event_type,evidence)
  values(tr.seat_id,tr.id,p_actor,'TRANSFER_CANCELLED',jsonb_build_object('reason',trim(p_reason)));
  return 'CANCELLED';
end;
$$;

-- The same resource-specific role seat is the only source of transferable seat grants.
-- A former holder cannot revive an exclusive CTO/CFO/etc write right through OWNER,
-- a legacy access profile, or an arbitrary browser-selected role label.
-- A separate CURRENT seat with an independently configured matching permission is
-- respected, e.g. developer code permissions after handing over CTO.
create or replace function public.office_role_seat_permission_verdict(
 p_actor uuid,p_permission text,p_scope_type text default 'COMPANY',
 p_scope_key text default null,p_owner_user_id uuid default null
) returns text language plpgsql stable security definer set search_path to '' as $$
declare action_name text;
begin
  select action into action_name from public.office_permission_catalog
    where code=p_permission and active=true;
  if action_name is null then return 'DENY'; end if;
  if exists(
    select 1 from public.office_role_seats s
    join public.office_role_seat_grants g on g.seat_id=s.id and g.status='ACTIVE'
    where s.current_holder_user_id=p_actor and s.status='ACTIVE'
      and g.permission_code=p_permission
      and public.office_scope_matches(g.scope_type,g.scope_key,p_scope_type,p_scope_key,p_actor,p_owner_user_id)
  ) then return 'GRANTED'; end if;
  if action_name='VIEW' or action_name='AUDIT_USAGE' or action_name like 'READ%' then return 'DEFAULT'; end if;
  if exists(
    select 1 from public.office_role_seat_former_holders f
    join public.office_role_seats s on s.id=f.seat_id and s.current_holder_user_id is distinct from p_actor
    join public.office_role_seat_grants g on g.seat_id=s.id and g.status='ACTIVE' and g.exclusive=true
    where f.employee_user_id=p_actor and g.permission_code=p_permission
      and public.office_scope_matches(g.scope_type,g.scope_key,p_scope_type,p_scope_key,p_actor,p_owner_user_id)
  ) then return 'DENY'; end if;
  return 'DEFAULT';
end;
$$;

create or replace function public.office_role_seat_capability_changes(p_actor uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'held',coalesce((
      select jsonb_agg(jsonb_build_object('permission',g.permission_code,
        'scope_type',g.scope_type,'scope_key',g.scope_key))
      from public.office_role_seats s
      join public.office_role_seat_grants g on g.seat_id=s.id and g.status='ACTIVE'
      where s.current_holder_user_id=p_actor and s.status='ACTIVE'
    ),'[]'::jsonb),
    'denied',coalesce((
      select jsonb_agg(distinct g.permission_code)
      from public.office_role_seat_former_holders f
      join public.office_role_seats s on s.id=f.seat_id and s.current_holder_user_id is distinct from p_actor
      join public.office_role_seat_grants g on g.seat_id=s.id and g.status='ACTIVE' and g.exclusive=true
      join public.office_permission_catalog p on p.code=g.permission_code
      where f.employee_user_id=p_actor and g.scope_type='COMPANY'
        and p.action not in ('VIEW','AUDIT_USAGE') and p.action not like 'READ%'
        and not exists(
          select 1 from public.office_role_seats current_seat
          join public.office_role_seat_grants active_grant on active_grant.seat_id=current_seat.id and active_grant.status='ACTIVE'
          where current_seat.current_holder_user_id=p_actor and current_seat.status='ACTIVE'
            and active_grant.permission_code=g.permission_code and active_grant.scope_type='COMPANY'
        )
    ),'[]'::jsonb)
  );
$$;

-- Apply the transferable-seat deny BEFORE legacy OWNER shortcuts in the canonical
-- database permission checker; backend/FastAPI database checks then agree with Next.js.
create or replace function public.office_effective_permission(
 p_user_id uuid,p_permission text,p_scope_type text default 'COMPANY',
 p_scope_key text default null,p_owner_user_id uuid default null
) returns boolean language plpgsql stable security definer set search_path to '' as $$
declare pr public.office_permission_catalog%rowtype; verdict text; seat_verdict text;
begin
  if not exists(select 1 from public.office_identity_users i
     where i.user_id=p_user_id and i.status='ACTIVE') then return false; end if;
  select * into pr from public.office_permission_catalog p
    where p.code=p_permission and p.active=true;
  if not found then return false; end if;
  verdict:=public.office_department_permission_verdict(p_user_id,p_permission);
  if verdict='DENY' then return false; end if;
  seat_verdict:=public.office_role_seat_permission_verdict(
    p_user_id,p_permission,p_scope_type,p_scope_key,p_owner_user_id);
  if seat_verdict='DENY' then return false; end if;
  if exists(select 1 from public.office_user_permission_overrides o
    where o.user_id=p_user_id and o.permission_code=p_permission and o.effect='DENY'
      and (o.expires_at is null or o.expires_at>now())
      and public.office_scope_matches(o.scope_type,o.scope_key,
        p_scope_type,p_scope_key,p_user_id,p_owner_user_id)) then return false; end if;
  if seat_verdict='GRANTED' then return true; end if;
  if pr.owner_bypass is distinct from false and (
    verdict='DEPARTMENT_OWNER' or exists(
      select 1 from public.office_user_roles r where r.user_id=p_user_id
      and r.role='OWNER' and (r.expires_at is null or r.expires_at>now()))
  ) then return true; end if;
  if exists(select 1 from public.office_user_permission_overrides o
    where o.user_id=p_user_id and o.permission_code=p_permission and o.effect='ALLOW'
      and (o.expires_at is null or o.expires_at>now())
      and public.office_scope_matches(o.scope_type,o.scope_key,
        p_scope_type,p_scope_key,p_user_id,p_owner_user_id)) then return true; end if;
  return exists(
    select 1 from public.office_user_access_profiles up
    join public.office_access_profile_permissions pp on
      pp.profile_code=up.profile_code and pp.permission_code=p_permission and pp.effect='ALLOW'
    where up.user_id=p_user_id and up.status='ACTIVE'
      and (up.effective_from is null or up.effective_from<=now())
      and (up.expires_at is null or up.expires_at>now())
      and public.office_scope_matches(up.scope_type,up.scope_key,
        p_scope_type,p_scope_key,p_user_id,p_owner_user_id)
  );
end;
$$;

-- No direct browser write or execute access to this control plane.
do $$
declare f text;
begin
  foreach f in array array[
    'office_role_seat_is_owner(uuid)',
    'office_role_seat_is_independent_reviewer(uuid,uuid,uuid)',
    'office_role_seat_create(uuid,text,text,text,text,text,boolean)',
    'office_role_seat_add_grant(uuid,uuid,text,text,text,boolean)',
    'office_role_seat_review_grant(uuid,uuid,boolean,text)',
    'office_role_seat_propose_transfer(uuid,uuid,uuid,text)',
    'office_role_seat_accept_transfer(uuid,uuid)',
    'office_role_seat_verify_item(uuid,uuid,text)',
    'office_role_seat_finalize_transfer(uuid,uuid,text)',
    'office_role_seat_cancel_transfer(uuid,uuid,text)',
    'office_role_seat_permission_verdict(uuid,text,text,text,uuid)',
    'office_role_seat_capability_changes(uuid)'
  ] loop
    execute 'revoke all on function public.' || f || ' from public,anon,authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
end;
$$;

-- End of schema-only migration; no live employee assignments or provider actions.
