-- KRAVIA Office OS — company calendar with scoped internal events.

create sequence if not exists public.office_calendar_code_seq start with 1 increment by 1;
create table if not exists public.office_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique default ('KR-C-' || lpad(nextval('public.office_calendar_code_seq')::text,6,'0')),
  title text not null check (char_length(title) between 3 and 180),
  description text not null default '' check (char_length(description) <= 4000),
  event_type text not null default 'OTHER' check (event_type in ('MEETING','DEADLINE','LAUNCH','CUSTOMER','MAINTENANCE','REVIEW','REMINDER','OTHER')),
  visibility_scope text not null default 'PERSONAL' check (visibility_scope in ('PERSONAL','COMPANY','DEPARTMENT','TEAM')),
  scope_key text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  source_type text,
  source_key text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check ((visibility_scope in ('PERSONAL','COMPANY')) or nullif(trim(coalesce(scope_key,'')),'') is not null)
);
create index if not exists office_calendar_events_time_idx on public.office_calendar_events(starts_at,status);
create index if not exists office_calendar_events_owner_idx on public.office_calendar_events(owner_user_id,starts_at);
create index if not exists office_calendar_events_scope_idx on public.office_calendar_events(visibility_scope,scope_key,starts_at);
alter table public.office_calendar_events enable row level security;
revoke all on public.office_calendar_events from anon,authenticated,public;
drop policy if exists office_calendar_events_deny_client_access on public.office_calendar_events;
create policy office_calendar_events_deny_client_access on public.office_calendar_events as restrictive for all to anon,authenticated using(false) with check(false);

create or replace function public.office_touch_calendar_event() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists office_calendar_events_touch on public.office_calendar_events;
create trigger office_calendar_events_touch before update on public.office_calendar_events for each row execute function public.office_touch_calendar_event();

create table if not exists public.office_calendar_event_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.office_calendar_events(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('CREATED','CANCELLED')),
  created_at timestamptz not null default now()
);
alter table public.office_calendar_event_audit enable row level security;
revoke all on public.office_calendar_event_audit from anon,authenticated,public;
drop policy if exists office_calendar_event_audit_deny_client_access on public.office_calendar_event_audit;
create policy office_calendar_event_audit_deny_client_access on public.office_calendar_event_audit as restrictive for all to anon,authenticated using(false) with check(false);
create or replace function public.office_calendar_audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'KRAVIA Office calendar audit is immutable'; end; $$;
drop trigger if exists office_calendar_event_audit_guard on public.office_calendar_event_audit;
create trigger office_calendar_event_audit_guard before update or delete on public.office_calendar_event_audit for each row execute function public.office_calendar_audit_immutable();

create or replace function public.office_create_calendar_event(
  p_actor uuid,p_title text,p_description text,p_event_type text,p_visibility text,p_scope_key text,p_starts_at timestamptz,p_ends_at timestamptz,p_all_day boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_department text; v_team text; v_privileged boolean;
begin
  select primary_department into v_department from public.office_identity_users where user_id=p_actor and status='ACTIVE';
  if not found then raise exception 'Actor is not an active Office identity'; end if;
  select team_key into v_team from public.office_job_assignments where user_id=p_actor and status='ACTIVE';
  select exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role in ('OWNER','DIRECTOR','ADMIN') and (r.expires_at is null or r.expires_at>now())) into v_privileged;
  if p_visibility='COMPANY' and not v_privileged then raise exception 'Company-wide events require executive or admin authority'; end if;
  if p_visibility='DEPARTMENT' and not v_privileged and coalesce(p_scope_key,'')<>coalesce(v_department,'') then raise exception 'Department event is outside actor scope'; end if;
  if p_visibility='TEAM' and not v_privileged and coalesce(p_scope_key,'')<>coalesce(v_team,'') then raise exception 'Team event is outside actor scope'; end if;
  if p_event_type not in ('MEETING','DEADLINE','LAUNCH','CUSTOMER','MAINTENANCE','REVIEW','REMINDER','OTHER') then raise exception 'Invalid event type'; end if;
  if p_visibility not in ('PERSONAL','COMPANY','DEPARTMENT','TEAM') then raise exception 'Invalid event visibility'; end if;
  if p_ends_at is not null and p_ends_at<p_starts_at then raise exception 'Event end must follow start'; end if;
  insert into public.office_calendar_events(title,description,event_type,visibility_scope,scope_key,starts_at,ends_at,all_day,created_by,owner_user_id)
  values(trim(p_title),coalesce(p_description,''),p_event_type,p_visibility,nullif(trim(coalesce(p_scope_key,'')),''),p_starts_at,p_ends_at,coalesce(p_all_day,false),p_actor,p_actor) returning id into v_id;
  insert into public.office_calendar_event_audit(event_id,actor_user_id,action) values(v_id,p_actor,'CREATED');
  return v_id;
end; $$;

create or replace function public.office_cancel_calendar_event(p_actor uuid,p_event uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_calendar_events%rowtype; v_privileged boolean;
begin
  select * into v from public.office_calendar_events where id=p_event for update;
  if v.id is null then raise exception 'Calendar event not found'; end if;
  select exists(select 1 from public.office_user_roles r where r.user_id=p_actor and r.role in ('OWNER','DIRECTOR','ADMIN') and (r.expires_at is null or r.expires_at>now())) into v_privileged;
  if p_actor<>v.created_by and p_actor<>v.owner_user_id and not v_privileged then raise exception 'Actor cannot cancel this event'; end if;
  if v.status='CANCELLED' then return true; end if;
  update public.office_calendar_events set status='CANCELLED',cancelled_at=now() where id=p_event;
  insert into public.office_calendar_event_audit(event_id,actor_user_id,action) values(p_event,p_actor,'CANCELLED');
  return true;
end; $$;

revoke all on function public.office_create_calendar_event(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean) from anon,authenticated,public;
revoke all on function public.office_cancel_calendar_event(uuid,uuid) from anon,authenticated,public;
grant execute on function public.office_create_calendar_event(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean) to service_role;
grant execute on function public.office_cancel_calendar_event(uuid,uuid) to service_role;
comment on table public.office_calendar_events is 'Scoped internal KRAVIA Office calendar events; canonical deadlines may also be projected read-only by the application.';
