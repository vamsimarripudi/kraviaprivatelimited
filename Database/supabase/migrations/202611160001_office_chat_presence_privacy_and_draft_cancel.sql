-- KRAVIA Connect: scoped live-device leases and privacy-aware last-seen.
-- Existing Office attendance/worktime status is deliberately not used.
-- This additive migration does not alter employee assignments or messages.
create table if not exists public.office_chat_presence_state (
  user_id uuid primary key references public.office_identity_users(user_id) on delete restrict,
  last_seen_visibility text not null default 'COWORKERS'
    check (last_seen_visibility in ('COWORKERS','CONVERSATIONS','NOBODY')),
  online_visibility text not null default 'SAME_AS_LAST_SEEN'
    check (online_visibility in ('SAME_AS_LAST_SEEN','COWORKERS')),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.office_chat_presence_devices (
  user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  device_id uuid not null,
  last_active_at timestamptz not null,
  lease_until timestamptz not null,
  primary key (user_id,device_id)
);
create index if not exists office_chat_presence_devices_active_idx
 on public.office_chat_presence_devices(user_id,lease_until desc);
alter table public.office_chat_presence_state enable row level security;
alter table public.office_chat_presence_devices enable row level security;
revoke all on public.office_chat_presence_state,public.office_chat_presence_devices
 from public,anon,authenticated;
grant select,insert,update on public.office_chat_presence_state to service_role;
grant select,insert,update,delete on public.office_chat_presence_devices to service_role;

-- Each active browser tab/device is a distinct, expiring lease.
-- A server-enforced, short TTL handles abrupt network disconnections.
-- A transition event contains no presence details and is always subject
-- to the conversation SSE endpoint's current-member authorization checks.
create or replace function public.office_chat_presence_pulse(
 p_actor uuid,p_device uuid,p_online boolean
) returns boolean language plpgsql security invoker set search_path=public as $$
declare previously_online boolean; currently_online boolean;
begin
 if not exists(select 1 from public.office_identity_users i
  where i.user_id=p_actor and i.status='ACTIVE') then
   raise exception 'Active verified Office identity required';
 end if;
 select exists(select 1 from public.office_chat_presence_devices d
   where d.user_id=p_actor and d.lease_until>now()) into previously_online;
 insert into public.office_chat_presence_state(user_id,last_seen_at)
 values(p_actor,now()) on conflict(user_id) do update
  set last_seen_at=excluded.last_seen_at;
 if p_online then
   insert into public.office_chat_presence_devices
    (user_id,device_id,last_active_at,lease_until)
   values(p_actor,p_device,now(),now()+interval '65 seconds')
   on conflict(user_id,device_id) do update
     set last_active_at=excluded.last_active_at,
         lease_until=excluded.lease_until;
 else
   delete from public.office_chat_presence_devices
    where user_id=p_actor and device_id=p_device;
 end if;
 select exists(select 1 from public.office_chat_presence_devices d
   where d.user_id=p_actor and d.lease_until>now()) into currently_online;
 if previously_online is distinct from currently_online then
   insert into public.office_chat_change_events(conversation_id,event_type)
   select scoped.conversation_id,'PRESENCE'
   from (select m.conversation_id from public.office_chat_memberships m
     join public.office_chat_conversations c on c.id=m.conversation_id
     where m.user_id=p_actor and m.status='ACTIVE' and c.state='ACTIVE'
     order by m.conversation_id limit 200) scoped;
 end if;
 return currently_online;
end; $$;
revoke all on function public.office_chat_presence_pulse(uuid,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.office_chat_presence_pulse(uuid,uuid,boolean) to service_role;

create or replace function public.office_chat_presence_set_privacy(
 p_actor uuid,p_last_seen text,p_online text
) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if p_last_seen not in ('COWORKERS','CONVERSATIONS','NOBODY')
    or p_online not in ('SAME_AS_LAST_SEEN','COWORKERS') then
   raise exception 'Invalid presence privacy setting';
 end if;
 if not exists(select 1 from public.office_identity_users i
  where i.user_id=p_actor and i.status='ACTIVE') then
   raise exception 'Active verified Office identity required';
 end if;
 insert into public.office_chat_presence_state
  (user_id,last_seen_visibility,online_visibility,updated_at)
 values(p_actor,p_last_seen,p_online,now())
 on conflict(user_id) do update set
  last_seen_visibility=excluded.last_seen_visibility,
  online_visibility=excluded.online_visibility,
  updated_at=now();
 insert into public.office_chat_change_events(conversation_id,event_type)
 select scoped.conversation_id,'PRESENCE' from (
   select m.conversation_id from public.office_chat_memberships m
    join public.office_chat_conversations c on c.id=m.conversation_id
   where m.user_id=p_actor and m.status='ACTIVE' and c.state='ACTIVE'
   order by m.conversation_id limit 200
 ) scoped;
 return true;
end; $$;
revoke all on function public.office_chat_presence_set_privacy(uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.office_chat_presence_set_privacy(uuid,text,text) to service_role;

-- Sender-cancelled unlinked uploads remain auditable but become permanently
-- unpublishable; private bytes are removed by the server cleanup endpoint.
alter table public.office_chat_attachment_objects
 drop constraint if exists office_chat_attachment_objects_status_check;
alter table public.office_chat_attachment_objects
 add constraint office_chat_attachment_objects_status_check
 check(status in ('QUARANTINED','SCANNING','CLEAN','BLOCKED','FAILED','CANCELLED'));
alter table public.office_chat_attachment_events
 drop constraint if exists office_chat_attachment_events_event_type_check;
alter table public.office_chat_attachment_events
 add constraint office_chat_attachment_events_event_type_check
 check(event_type in ('QUARANTINED','SCAN_CLEAN','SCAN_BLOCKED','SCAN_UNKNOWN','LINKED','DOWNLOADED','DISCARDED'));
comment on table public.office_chat_presence_state is
 'Chat-only privacy and last activity; never use for attendance or payroll.';
comment on table public.office_chat_presence_devices is
 'Expiring per-device chat leases; accessible only to the server-side Office service role.';
