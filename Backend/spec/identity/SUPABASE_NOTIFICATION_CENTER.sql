-- KRAVIA Office — notification center lifecycle.

create table if not exists public.office_notification_events (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.office_notifications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('READ','UNREAD','DISMISSED')),
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);
create index if not exists office_notification_events_notification_idx on public.office_notification_events(notification_id,created_at desc);
create index if not exists office_notification_events_user_idx on public.office_notification_events(user_id,created_at desc);
alter table public.office_notification_events enable row level security;
revoke all on public.office_notification_events from anon,authenticated,public;
drop policy if exists office_notification_events_deny_client_access on public.office_notification_events;
create policy office_notification_events_deny_client_access on public.office_notification_events as restrictive for all to anon,authenticated using(false) with check(false);

create or replace function public.office_notification_events_immutable() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'KRAVIA Office notification events are immutable';
end; $$;
drop trigger if exists office_notification_events_immutable_guard on public.office_notification_events;
create trigger office_notification_events_immutable_guard before update or delete on public.office_notification_events for each row execute function public.office_notification_events_immutable();

create or replace function public.office_update_notification_state(p_actor uuid,p_notification uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_notifications%rowtype; v_status text;
begin
  select * into v from public.office_notifications where id=p_notification and user_id=p_actor for update;
  if v.id is null then raise exception 'Notification not found'; end if;
  case p_action when 'READ' then v_status:='READ'; when 'UNREAD' then v_status:='UNREAD'; when 'DISMISS' then v_status:='DISMISSED'; else raise exception 'Invalid notification action'; end case;
  if v.status=v_status then return v_status; end if;
  update public.office_notifications set status=v_status,read_at=case when v_status='READ' then coalesce(read_at,now()) when v_status='UNREAD' then null else read_at end where id=v.id;
  insert into public.office_notification_events(notification_id,user_id,action,previous_status,new_status) values(v.id,p_actor,case when p_action='DISMISS' then 'DISMISSED' else p_action end,v.status,v_status);
  return v_status;
end; $$;

create or replace function public.office_mark_all_notifications_read(p_actor uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  with changed as (
    update public.office_notifications set status='READ',read_at=coalesce(read_at,now()) where user_id=p_actor and status='UNREAD' returning id
  ), events as (
    insert into public.office_notification_events(notification_id,user_id,action,previous_status,new_status)
    select id,p_actor,'READ','UNREAD','READ' from changed returning id
  ) select count(*)::integer into v_count from events;
  return coalesce(v_count,0);
end; $$;

revoke all on function public.office_update_notification_state(uuid,uuid,text) from anon,authenticated,public;
revoke all on function public.office_mark_all_notifications_read(uuid) from anon,authenticated,public;
grant execute on function public.office_update_notification_state(uuid,uuid,text) to service_role;
grant execute on function public.office_mark_all_notifications_read(uuid) to service_role;
comment on table public.office_notification_events is 'Immutable user-state transitions for KRAVIA Office notifications.';
