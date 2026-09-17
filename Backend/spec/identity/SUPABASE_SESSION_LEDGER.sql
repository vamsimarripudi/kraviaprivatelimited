-- KRAVIA Office OS — authenticated session ledger.
-- Tracks successful Office sessions and security events without storing access/refresh tokens.

create table if not exists public.office_auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  provider_session_id text,
  device_id uuid references public.office_device_registry(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED','REVOKED','EXPIRED')),
  aal text not null default 'aal1' check (aal in ('aal1','aal2')),
  mfa_verified boolean not null default false,
  risk_level text not null default 'LOW' check (risk_level in ('LOW','MEDIUM','HIGH','BLOCKED')),
  ip_address inet,
  user_agent_hash text check (user_agent_hash is null or char_length(user_agent_hash)=64),
  user_agent_summary text check (user_agent_summary is null or char_length(user_agent_summary) <= 512),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason is null or char_length(end_reason) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_auth_session_end_consistency check ((status='ACTIVE' and ended_at is null) or (status<>'ACTIVE' and ended_at is not null))
);

create unique index if not exists office_active_provider_session_unique on public.office_auth_sessions(provider_session_id) where provider_session_id is not null and status='ACTIVE';
create index if not exists office_auth_sessions_user_idx on public.office_auth_sessions(user_id,started_at desc);
create index if not exists office_auth_sessions_active_idx on public.office_auth_sessions(user_id,last_seen_at desc) where status='ACTIVE';
create index if not exists office_auth_sessions_device_idx on public.office_auth_sessions(device_id,last_seen_at desc) where device_id is not null;

create table if not exists public.office_auth_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  session_id uuid not null references public.office_auth_sessions(id) on delete restrict,
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  actor_roles text[] not null default '{}',
  event_type text not null check (event_type in ('LOGIN_SUCCESS','MFA_VERIFIED','SESSION_SEEN','LOGOUT','SESSION_REVOKED','SESSION_EXPIRED','DEVICE_LINKED')),
  aal text not null check (aal in ('aal1','aal2')),
  ip_address inet,
  user_agent_hash text check (user_agent_hash is null or char_length(user_agent_hash)=64),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_auth_events_session_idx on public.office_auth_events(session_id,created_at desc);
create index if not exists office_auth_events_user_idx on public.office_auth_events(user_id,created_at desc);

alter table public.office_auth_sessions enable row level security;
alter table public.office_auth_events enable row level security;
revoke all on public.office_auth_sessions, public.office_auth_events from anon, authenticated, public;

drop policy if exists office_auth_sessions_deny_client_access on public.office_auth_sessions;
create policy office_auth_sessions_deny_client_access on public.office_auth_sessions as restrictive for all to anon,authenticated using(false) with check(false);
drop policy if exists office_auth_events_deny_client_access on public.office_auth_events;
create policy office_auth_events_deny_client_access on public.office_auth_events as restrictive for all to anon,authenticated using(false) with check(false);

create or replace function public.office_auth_event_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
  raise exception 'KRAVIA Office authentication events are immutable';
end; $$;
drop trigger if exists office_auth_event_immutable_guard on public.office_auth_events;
create trigger office_auth_event_immutable_guard before update or delete on public.office_auth_events for each row execute function public.office_auth_event_immutable();

create or replace function public.office_open_auth_session(
  p_session_id uuid,
  p_user uuid,
  p_provider_session_id text,
  p_aal text,
  p_ip text,
  p_user_agent_hash text,
  p_user_agent_summary text,
  p_event_id uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_existing uuid;
  v_roles text[];
  v_ip inet;
begin
  if p_aal not in ('aal1','aal2') then raise exception 'Invalid assurance level'; end if;
  if p_user_agent_hash is not null and char_length(p_user_agent_hash)<>64 then raise exception 'Invalid user-agent hash'; end if;
  if p_user_agent_summary is not null and char_length(p_user_agent_summary)>512 then raise exception 'User-agent summary is too long'; end if;
  if not exists(select 1 from public.office_identity_users u where u.user_id=p_user and u.status='ACTIVE') then raise exception 'Office identity is not active'; end if;
  if p_ip is not null and btrim(p_ip)<>'' then v_ip:=p_ip::inet; end if;

  if p_provider_session_id is not null then
    select s.id into v_existing from public.office_auth_sessions s where s.provider_session_id=p_provider_session_id and s.user_id=p_user and s.status='ACTIVE' order by s.started_at desc limit 1;
  end if;
  if v_existing is not null then
    update public.office_auth_sessions set last_seen_at=now(),updated_at=now(),ip_address=coalesce(v_ip,ip_address) where id=v_existing;
    return v_existing;
  end if;

  select coalesce(array_agg(r.role order by r.role),'{}'::text[]) into v_roles from public.office_user_roles r where r.user_id=p_user and (r.expires_at is null or r.expires_at>now());

  insert into public.office_auth_sessions(id,user_id,provider_session_id,status,aal,mfa_verified,ip_address,user_agent_hash,user_agent_summary,started_at,last_seen_at,created_at,updated_at)
  values(p_session_id,p_user,nullif(p_provider_session_id,''),'ACTIVE',p_aal,p_aal='aal2',v_ip,p_user_agent_hash,nullif(p_user_agent_summary,''),now(),now(),now(),now());

  insert into public.office_auth_events(event_id,session_id,user_id,actor_roles,event_type,aal,ip_address,user_agent_hash,metadata)
  values(p_event_id,p_session_id,p_user,coalesce(v_roles,'{}'::text[]),'LOGIN_SUCCESS',p_aal,v_ip,p_user_agent_hash,jsonb_build_object('provider_session_tracked',p_provider_session_id is not null));

  return p_session_id;
end; $$;

create or replace function public.office_record_auth_session_event(
  p_session_id uuid,
  p_user uuid,
  p_event_type text,
  p_aal text,
  p_ip text,
  p_user_agent_hash text,
  p_event_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session public.office_auth_sessions%rowtype;
  v_roles text[];
  v_ip inet;
  v_insert_event boolean:=true;
begin
  if p_event_type not in ('MFA_VERIFIED','SESSION_SEEN','LOGOUT','SESSION_REVOKED','SESSION_EXPIRED','DEVICE_LINKED') then raise exception 'Invalid authentication event'; end if;
  if p_aal not in ('aal1','aal2') then raise exception 'Invalid assurance level'; end if;
  if p_user_agent_hash is not null and char_length(p_user_agent_hash)<>64 then raise exception 'Invalid user-agent hash'; end if;
  if p_ip is not null and btrim(p_ip)<>'' then v_ip:=p_ip::inet; end if;

  select * into v_session from public.office_auth_sessions where id=p_session_id and user_id=p_user for update;
  if v_session.id is null then raise exception 'Tracked Office session not found'; end if;
  if exists(select 1 from public.office_auth_events e where e.event_id=p_event_id) then return true; end if;

  select coalesce(array_agg(r.role order by r.role),'{}'::text[]) into v_roles from public.office_user_roles r where r.user_id=p_user and (r.expires_at is null or r.expires_at>now());

  if p_event_type='MFA_VERIFIED' then
    if v_session.status<>'ACTIVE' then raise exception 'Tracked Office session is not active'; end if;
    update public.office_auth_sessions set aal='aal2',mfa_verified=true,last_seen_at=now(),ip_address=coalesce(v_ip,ip_address),updated_at=now() where id=p_session_id;
  elsif p_event_type='SESSION_SEEN' then
    if v_session.status<>'ACTIVE' then return false; end if;
    v_insert_event:=v_session.last_seen_at <= now()-interval '5 minutes';
    update public.office_auth_sessions set aal=p_aal,mfa_verified=(mfa_verified or p_aal='aal2'),last_seen_at=now(),ip_address=coalesce(v_ip,ip_address),updated_at=now() where id=p_session_id;
  elsif p_event_type='DEVICE_LINKED' then
    if v_session.status<>'ACTIVE' then raise exception 'Tracked Office session is not active'; end if;
    update public.office_auth_sessions set last_seen_at=now(),updated_at=now() where id=p_session_id;
  elsif p_event_type='LOGOUT' then
    if v_session.status='ACTIVE' then update public.office_auth_sessions set status='CLOSED',aal=p_aal,mfa_verified=(mfa_verified or p_aal='aal2'),last_seen_at=now(),ended_at=now(),end_reason='USER_LOGOUT',updated_at=now() where id=p_session_id; end if;
  elsif p_event_type='SESSION_REVOKED' then
    if v_session.status='ACTIVE' then update public.office_auth_sessions set status='REVOKED',last_seen_at=now(),ended_at=now(),end_reason='SECURITY_REVOKED',updated_at=now() where id=p_session_id; end if;
  elsif p_event_type='SESSION_EXPIRED' then
    if v_session.status='ACTIVE' then update public.office_auth_sessions set status='EXPIRED',ended_at=now(),end_reason='SESSION_EXPIRED',updated_at=now() where id=p_session_id; end if;
  end if;

  if v_insert_event then
    insert into public.office_auth_events(event_id,session_id,user_id,actor_roles,event_type,aal,ip_address,user_agent_hash,metadata)
    values(p_event_id,p_session_id,p_user,coalesce(v_roles,'{}'::text[]),p_event_type,p_aal,v_ip,p_user_agent_hash,coalesce(p_metadata,'{}'::jsonb));
  end if;
  return true;
end; $$;

revoke all on function public.office_open_auth_session(uuid,uuid,text,text,text,text,text,uuid) from anon,authenticated,public;
revoke all on function public.office_record_auth_session_event(uuid,uuid,text,text,text,text,uuid,jsonb) from anon,authenticated,public;
grant execute on function public.office_open_auth_session(uuid,uuid,text,text,text,text,text,uuid) to service_role;
grant execute on function public.office_record_auth_session_event(uuid,uuid,text,text,text,text,uuid,jsonb) to service_role;

comment on table public.office_auth_sessions is 'KRAVIA Office successful authentication-session ledger. Tokens are never stored.';
comment on table public.office_auth_events is 'Immutable KRAVIA Office authentication/security event timeline.';
