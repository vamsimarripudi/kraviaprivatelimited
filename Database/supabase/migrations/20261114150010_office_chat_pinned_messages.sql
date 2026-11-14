-- KRAVIA Connect: shared, auditable message pins. Code-only until approved migration.
-- A member must still have effective authority to the conversation; stored pins
-- never grant access or cause a message to bypass private-message read rules.
create table if not exists public.office_chat_pinned_messages (
 message_id uuid primary key references public.office_chat_messages(id) on delete restrict,
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 pinned_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 pinned_at timestamptz not null default now()
);
create index if not exists office_chat_pins_conversation_idx
 on public.office_chat_pinned_messages(conversation_id,pinned_at desc);

alter table public.office_chat_pinned_messages enable row level security;
revoke all on public.office_chat_pinned_messages from public,anon,authenticated;
grant select,insert,delete on public.office_chat_pinned_messages to service_role;

alter table public.office_chat_audit_events drop constraint if exists office_chat_audit_events_event_type_check;
alter table public.office_chat_audit_events add constraint office_chat_audit_events_event_type_check
 check(event_type in ('DM_CREATED','GROUP_CREATED','GROUP_MEMBER_ADDED','MESSAGE_SENT','READ_ADVANCED',
 'MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SAVED','MESSAGE_UNSAVED','THREAD_REPLY','MENTION_CREATED',
 'DEPARTMENT_JOINED','MESSAGE_PINNED','MESSAGE_UNPINNED'));

create or replace function public.office_chat_set_pin(p_actor uuid,p_message uuid,p_pin boolean)
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_conversation public.office_chat_conversations%rowtype;v_rows integer;
begin
 select c.* into v_conversation
 from public.office_chat_messages m join public.office_chat_conversations c on c.id=m.conversation_id
 where m.id=p_message and m.deleted_at is null and c.state='ACTIVE';
 if v_conversation.id is null or p_pin is null
 or not exists(select 1 from public.office_identity_users i where i.user_id=p_actor and i.status='ACTIVE')
 or not exists(select 1 from public.office_chat_memberships member
  where member.conversation_id=v_conversation.id and member.user_id=p_actor and member.status='ACTIVE')
 then raise exception 'Conversation pin authority unavailable'; end if;
 if v_conversation.kind='GROUP' and v_conversation.created_by<>p_actor then
  raise exception 'Only the group creator can manage shared pins'; end if;
 if v_conversation.kind='DEPARTMENT' and not exists(
  select 1 from public.office_job_assignments j where j.user_id=p_actor and j.status='ACTIVE'
   and upper(j.department_code)=upper(v_conversation.department_code)
 ) then raise exception 'Current department assignment required'; end if;

 if p_pin then
  insert into public.office_chat_pinned_messages(message_id,conversation_id,pinned_by)
  values(p_message,v_conversation.id,p_actor) on conflict(message_id) do nothing;
 else
  delete from public.office_chat_pinned_messages where message_id=p_message
   and conversation_id=v_conversation.id;
 end if;
 get diagnostics v_rows=row_count;
 if v_rows>0 then
  insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
  values(v_conversation.id,p_actor,case when p_pin then 'MESSAGE_PINNED' else 'MESSAGE_UNPINNED' end,p_message);
 end if;
 return true;
end; $$;
revoke all on function public.office_chat_set_pin(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.office_chat_set_pin(uuid,uuid,boolean) to service_role;
