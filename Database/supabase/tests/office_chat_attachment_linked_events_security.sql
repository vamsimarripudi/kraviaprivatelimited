\set ON_ERROR_STOP on
-- Independent disposable PostgreSQL 17 fixture for sender-only attachment events.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create extension if not exists pgcrypto;
create table public.office_chat_change_events(
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  event_type text not null
);
create table public.office_chat_attachment_objects(
  id uuid primary key,
  conversation_id uuid not null,
  message_id uuid,
  status text not null
);
grant insert,select on public.office_chat_change_events to service_role;
grant usage,select on sequence public.office_chat_change_events_id_seq to service_role;
\ir ../migrations/202611160002_office_chat_linked_attachment_event_guard.sql

insert into public.office_chat_attachment_objects
(id,conversation_id,status) values
('00000000-0000-0000-0000-000000000101',
 '00000000-0000-0000-0000-000000000010','QUARANTINED');
update public.office_chat_attachment_objects set status='CLEAN'
where id='00000000-0000-0000-0000-000000000101';
do $test$
begin
 if exists(select 1 from public.office_chat_change_events) then
  raise exception 'An unlinked draft disclosed recipient event before Send';
 end if;
 if has_function_privilege('anon','public.office_chat_record_linked_attachment()','EXECUTE') or
    has_function_privilege('authenticated','public.office_chat_record_linked_attachment()','EXECUTE') then
  raise exception 'Browser roles must never invoke internal attachment event trigger';
 end if;
end $test$;

update public.office_chat_attachment_objects
 set message_id='00000000-0000-0000-0000-000000000201'
where id='00000000-0000-0000-0000-000000000101';
do $test$
begin
 if (select count(*) from public.office_chat_change_events
     where event_type='ATTACHMENT')<>1 then
  raise exception 'Committed attachment failed to emit exactly one change event';
 end if;
end $test$;
