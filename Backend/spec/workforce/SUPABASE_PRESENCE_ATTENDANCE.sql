-- KRAVIA Office OS — workforce presence and attendance foundation
-- Service-role only. Presence is not payroll authority; attendance remains a separate governed record.

create table if not exists public.office_presence_state (
  user_id uuid primary key references public.office_identity_users(user_id) on delete restrict,
  availability_status text not null default 'AVAILABLE' check (availability_status in ('AVAILABLE','FOCUS','IN_MEETING','OOO','DND')),
  work_mode text not null default 'UNSPECIFIED' check (work_mode in ('UNSPECIFIED','OFFICE','REMOTE','BUSINESS_TRAVEL')),
  status_note text check (status_note is null or char_length(status_note) <= 240),
  status_until timestamptz,
  last_interaction_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.office_work_status_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  status text not null check (status in ('WORKING','PAID_LEAVE','SICK_LEAVE','UNPAID_LEAVE','HOLIDAY','WEEK_OFF','BUSINESS_TRAVEL','SUSPENDED','EXITED')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  source text not null default 'SYSTEM' check (source in ('SYSTEM','HR','LEAVE','CALENDAR','SECURITY','OFFBOARDING')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint office_work_status_window check (effective_to is null or effective_to > effective_from)
);

create table if not exists public.office_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  work_date date not null,
  time_zone text not null,
  work_mode text not null check (work_mode in ('OFFICE','REMOTE','BUSINESS_TRAVEL')),
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  source text not null default 'KRAVIA_OFFICE' check (source in ('KRAVIA_OFFICE','NFC','HR_CORRECTION','SYSTEM')),
  note text check (note is null or char_length(note) <= 500),
  closing_reason text check (closing_reason is null or char_length(closing_reason) <= 240),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_attendance_time_order check (check_out_at is null or check_out_at >= check_in_at),
  constraint office_attendance_status_consistency check ((status='OPEN' and check_out_at is null) or (status='CLOSED' and check_out_at is not null))
);

create unique index if not exists office_one_open_attendance_session on public.office_attendance_sessions(user_id) where status='OPEN';
create index if not exists office_attendance_user_date_idx on public.office_attendance_sessions(user_id,work_date desc,check_in_at desc);

create table if not exists public.office_attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  attendance_session_id uuid not null references public.office_attendance_sessions(id) on delete restrict,
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  break_kind text not null default 'REST' check (break_kind in ('REST','MEAL','PERSONAL')),
  started_at timestamptz not null,
  ended_at timestamptz,
  note text check (note is null or char_length(note) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_break_time_order check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists office_one_open_break_per_session on public.office_attendance_breaks(attendance_session_id) where ended_at is null;
create index if not exists office_break_user_idx on public.office_attendance_breaks(user_id,started_at desc);

create table if not exists public.office_workforce_events (
  id bigint generated always as identity primary key,
  client_event_id uuid not null unique,
  actor_user_id uuid not null,
  actor_roles text[] not null default '{}',
  target_user_id uuid not null,
  event_type text not null check (event_type in ('PRESENCE_CHANGED','WORK_MODE_CHANGED','ATTENDANCE_CHECK_IN','ATTENDANCE_BREAK_START','ATTENDANCE_BREAK_END','ATTENDANCE_CHECK_OUT','WORK_STATUS_ASSIGNED','ATTENDANCE_CORRECTED')),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_workforce_events_target_idx on public.office_workforce_events(target_user_id,created_at desc);
create index if not exists office_workforce_events_actor_idx on public.office_workforce_events(actor_user_id,created_at desc);

alter table public.office_presence_state enable row level security;
alter table public.office_work_status_assignments enable row level security;
alter table public.office_attendance_sessions enable row level security;
alter table public.office_attendance_breaks enable row level security;
alter table public.office_workforce_events enable row level security;

revoke all on public.office_presence_state, public.office_work_status_assignments, public.office_attendance_sessions, public.office_attendance_breaks, public.office_workforce_events from anon, authenticated, public;

drop policy if exists office_presence_deny_client_access on public.office_presence_state;
create policy office_presence_deny_client_access on public.office_presence_state as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_work_status_deny_client_access on public.office_work_status_assignments;
create policy office_work_status_deny_client_access on public.office_work_status_assignments as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_attendance_deny_client_access on public.office_attendance_sessions;
create policy office_attendance_deny_client_access on public.office_attendance_sessions as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_breaks_deny_client_access on public.office_attendance_breaks;
create policy office_breaks_deny_client_access on public.office_attendance_breaks as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_workforce_events_deny_client_access on public.office_workforce_events;
create policy office_workforce_events_deny_client_access on public.office_workforce_events as restrictive for all to anon,authenticated using(false) with check(false);

create or replace function public.office_workforce_event_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'KRAVIA Office workforce events are immutable';
end; $$;
drop trigger if exists office_workforce_event_immutable_guard on public.office_workforce_events;
create trigger office_workforce_event_immutable_guard before update or delete on public.office_workforce_events for each row execute function public.office_workforce_event_immutable();

create or replace function public.office_set_presence(
  p_actor uuid,
  p_status text,
  p_note text default null,
  p_until timestamptz default null,
  p_work_mode text default null,
  p_client_event_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_previous public.office_presence_state%rowtype;
  v_result public.office_presence_state%rowtype;
  v_roles text[];
begin
  if not exists(select 1 from public.office_identity_users u where u.user_id=p_actor and u.status='ACTIVE') then
    raise exception 'Office identity is not active';
  end if;
  if p_status not in ('AVAILABLE','FOCUS','IN_MEETING','OOO','DND') then raise exception 'Invalid availability status'; end if;
  if p_work_mode is not null and p_work_mode not in ('UNSPECIFIED','OFFICE','REMOTE','BUSINESS_TRAVEL') then raise exception 'Invalid work mode'; end if;
  if p_until is not null and p_until <= now() then raise exception 'Presence expiry must be in the future'; end if;
  if p_note is not null and char_length(p_note) > 240 then raise exception 'Presence note is too long'; end if;

  if exists(select 1 from public.office_workforce_events e where e.client_event_id=p_client_event_id and e.actor_user_id=p_actor) then
    select * into v_result from public.office_presence_state where user_id=p_actor;
    return jsonb_build_object('idempotent',true,'presence',to_jsonb(v_result));
  end if;

  select * into v_previous from public.office_presence_state where user_id=p_actor;
  select coalesce(array_agg(r.role order by r.role),'{}'::text[]) into v_roles from public.office_user_roles r where r.user_id=p_actor and (r.expires_at is null or r.expires_at>now());

  insert into public.office_presence_state(user_id,availability_status,work_mode,status_note,status_until,last_interaction_at,updated_by,updated_at)
  values(p_actor,p_status,coalesce(p_work_mode,'UNSPECIFIED'),nullif(btrim(p_note),''),p_until,now(),p_actor,now())
  on conflict(user_id) do update set
    availability_status=excluded.availability_status,
    work_mode=coalesce(p_work_mode,public.office_presence_state.work_mode),
    status_note=excluded.status_note,
    status_until=excluded.status_until,
    last_interaction_at=now(),
    updated_by=p_actor,
    updated_at=now()
  returning * into v_result;

  insert into public.office_workforce_events(client_event_id,actor_user_id,actor_roles,target_user_id,event_type,entity_type,entity_id,metadata)
  values(p_client_event_id,p_actor,coalesce(v_roles,'{}'::text[]),p_actor,'PRESENCE_CHANGED','PRESENCE',p_actor,
    jsonb_build_object('before_status',v_previous.availability_status,'after_status',v_result.availability_status,'before_work_mode',v_previous.work_mode,'after_work_mode',v_result.work_mode,'status_until',v_result.status_until));

  return jsonb_build_object('idempotent',false,'presence',to_jsonb(v_result));
end; $$;

create or replace function public.office_attendance_act(
  p_actor uuid,
  p_action text,
  p_work_mode text default null,
  p_note text default null,
  p_time_zone text default 'Asia/Kolkata',
  p_client_event_id uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session public.office_attendance_sessions%rowtype;
  v_break public.office_attendance_breaks%rowtype;
  v_roles text[];
  v_event_type text;
  v_now timestamptz:=now();
begin
  if not exists(select 1 from public.office_identity_users u where u.user_id=p_actor and u.status='ACTIVE') then
    raise exception 'Office identity is not active';
  end if;
  if p_action not in ('CHECK_IN','BREAK_START','BREAK_END','CHECK_OUT') then raise exception 'Invalid attendance action'; end if;
  if p_work_mode is not null and p_work_mode not in ('OFFICE','REMOTE','BUSINESS_TRAVEL') then raise exception 'Invalid work mode'; end if;
  if p_note is not null and char_length(p_note) > 500 then raise exception 'Attendance note is too long'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_time_zone) then raise exception 'Invalid time zone'; end if;

  if exists(select 1 from public.office_workforce_events e where e.client_event_id=p_client_event_id and e.actor_user_id=p_actor) then
    select * into v_session from public.office_attendance_sessions where user_id=p_actor order by check_in_at desc limit 1;
    return jsonb_build_object('idempotent',true,'action',p_action,'session',to_jsonb(v_session));
  end if;

  select coalesce(array_agg(r.role order by r.role),'{}'::text[]) into v_roles from public.office_user_roles r where r.user_id=p_actor and (r.expires_at is null or r.expires_at>v_now);
  select * into v_session from public.office_attendance_sessions where user_id=p_actor and status='OPEN' order by check_in_at desc limit 1 for update;

  if p_action='CHECK_IN' then
    if v_session.id is not null then raise exception 'Attendance session is already open'; end if;
    if p_work_mode is null then raise exception 'Work mode is required to check in'; end if;
    insert into public.office_attendance_sessions(user_id,work_date,time_zone,work_mode,check_in_at,status,source,note,created_by,created_at,updated_at)
    values(p_actor,(v_now at time zone p_time_zone)::date,p_time_zone,p_work_mode,v_now,'OPEN','KRAVIA_OFFICE',nullif(btrim(p_note),''),p_actor,v_now,v_now)
    returning * into v_session;
    insert into public.office_presence_state(user_id,availability_status,work_mode,last_interaction_at,updated_by,updated_at)
    values(p_actor,'AVAILABLE',p_work_mode,v_now,p_actor,v_now)
    on conflict(user_id) do update set work_mode=excluded.work_mode,last_interaction_at=v_now,updated_by=p_actor,updated_at=v_now;
    v_event_type:='ATTENDANCE_CHECK_IN';
  elsif p_action='BREAK_START' then
    if v_session.id is null then raise exception 'Check in before starting a break'; end if;
    if exists(select 1 from public.office_attendance_breaks b where b.attendance_session_id=v_session.id and b.ended_at is null) then raise exception 'A break is already active'; end if;
    insert into public.office_attendance_breaks(attendance_session_id,user_id,break_kind,started_at,note,created_at,updated_at)
    values(v_session.id,p_actor,'REST',v_now,nullif(btrim(p_note),''),v_now,v_now) returning * into v_break;
    v_event_type:='ATTENDANCE_BREAK_START';
  elsif p_action='BREAK_END' then
    if v_session.id is null then raise exception 'No open attendance session'; end if;
    select * into v_break from public.office_attendance_breaks where attendance_session_id=v_session.id and ended_at is null order by started_at desc limit 1 for update;
    if v_break.id is null then raise exception 'No active break'; end if;
    update public.office_attendance_breaks set ended_at=v_now,updated_at=v_now where id=v_break.id returning * into v_break;
    v_event_type:='ATTENDANCE_BREAK_END';
  else
    if v_session.id is null then raise exception 'No open attendance session'; end if;
    update public.office_attendance_breaks set ended_at=v_now,updated_at=v_now where attendance_session_id=v_session.id and ended_at is null;
    update public.office_attendance_sessions set check_out_at=v_now,status='CLOSED',closing_reason=coalesce(nullif(btrim(p_note),''),'USER_CHECK_OUT'),updated_at=v_now where id=v_session.id returning * into v_session;
    v_event_type:='ATTENDANCE_CHECK_OUT';
  end if;

  update public.office_presence_state set last_interaction_at=v_now,updated_by=p_actor,updated_at=v_now where user_id=p_actor;

  insert into public.office_workforce_events(client_event_id,actor_user_id,actor_roles,target_user_id,event_type,entity_type,entity_id,metadata)
  values(p_client_event_id,p_actor,coalesce(v_roles,'{}'::text[]),p_actor,v_event_type,'ATTENDANCE',v_session.id,
    jsonb_build_object('action',p_action,'work_mode',v_session.work_mode,'work_date',v_session.work_date,'time_zone',v_session.time_zone,'break_id',v_break.id));

  return jsonb_build_object('idempotent',false,'action',p_action,'session',to_jsonb(v_session),'break',to_jsonb(v_break));
end; $$;

revoke all on function public.office_set_presence(uuid,text,text,timestamptz,text,uuid) from anon,authenticated,public;
revoke all on function public.office_attendance_act(uuid,text,text,text,text,uuid) from anon,authenticated,public;
grant execute on function public.office_set_presence(uuid,text,text,timestamptz,text,uuid) to service_role;
grant execute on function public.office_attendance_act(uuid,text,text,text,text,uuid) to service_role;

comment on table public.office_presence_state is 'Current user-controlled availability and work-mode state. Leave/employment status is not stored here.';
comment on table public.office_work_status_assignments is 'Authoritative effective-dated HR/system work status such as leave, holiday, suspension or exit.';
comment on table public.office_attendance_sessions is 'Attendance sessions kept separate from authentication sessions and browser presence.';
comment on table public.office_workforce_events is 'Immutable workforce timeline events; never use raw login duration as payroll payable time.';
