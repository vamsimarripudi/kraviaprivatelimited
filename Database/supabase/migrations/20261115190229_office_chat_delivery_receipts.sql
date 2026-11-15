-- Private KRAVIA Connect delivery acknowledgements (review-only migration).
-- A delivered tick means another authorized signed-in client fetched the message.
-- Read ticks are tracked separately via the focused-view read cursor.
create table if not exists public.office_chat_message_deliveries(
 message_id uuid not null references public.office_chat_messages(id) on delete restrict,
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 recipient_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 acknowledged_at timestamptz not null default now(),
 primary key(message_id,recipient_user_id),
 foreign key(conversation_id,recipient_user_id)
  references public.office_chat_memberships(conversation_id,user_id) on delete restrict
);
create index if not exists office_chat_delivery_conversation_idx
 on public.office_chat_message_deliveries(conversation_id,message_id);
alter table public.office_chat_message_deliveries enable row level security;
revoke all on public.office_chat_message_deliveries from public,anon,authenticated;
grant select,insert on public.office_chat_message_deliveries to service_role;

alter table public.office_chat_change_events
 drop constraint if exists office_chat_change_events_event_type_check;
alter table public.office_chat_change_events
 add constraint office_chat_change_events_event_type_check
 check(event_type in ('MESSAGE','MESSAGE_CHANGED','MEMBERSHIP','PIN','REACTION','ATTACHMENT','PRESENCE','RECEIPT'));

create or replace function public.office_chat_ack_delivery(
 p_actor uuid,p_conversation uuid,p_message_ids uuid[]
) returns integer language plpgsql security invoker set search_path=public as $$
declare v_count integer;
begin
 if p_actor is null or p_conversation is null or p_message_ids is null
   or cardinality(p_message_ids) not between 1 and 100
   or not public.office_chat_current_member(p_actor,p_conversation)
 then raise exception 'Conversation unavailable'; end if;
 with inserted as (
  insert into public.office_chat_message_deliveries(message_id,conversation_id,recipient_user_id)
  select distinct m.id,p_conversation,p_actor
  from public.office_chat_messages m
  where m.conversation_id=p_conversation and m.id=any(p_message_ids)
   and m.sender_user_id<>p_actor and m.deleted_at is null
  on conflict(message_id,recipient_user_id) do nothing
  returning message_id
 )
 select count(*) into v_count from inserted;
 return v_count;
end; $$;
revoke all on function public.office_chat_ack_delivery(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.office_chat_ack_delivery(uuid,uuid,uuid[]) to service_role;

create or replace function public.office_chat_receipt_event()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into public.office_chat_change_events(conversation_id,event_type)
 values(new.conversation_id,'RECEIPT');
 return new;
end; $$;
revoke all on function public.office_chat_receipt_event() from public,anon,authenticated;
grant execute on function public.office_chat_receipt_event() to service_role;
drop trigger if exists office_chat_delivery_live on public.office_chat_message_deliveries;
create trigger office_chat_delivery_live after insert on public.office_chat_message_deliveries
 for each row execute function public.office_chat_receipt_event();
drop trigger if exists office_chat_read_live on public.office_chat_read_cursors;
create trigger office_chat_read_live after insert or update of last_read_at on public.office_chat_read_cursors
 for each row execute function public.office_chat_receipt_event();
comment on table public.office_chat_message_deliveries is
 'Signed-in recipient retrieval acknowledgement. Read is a separate focused-view action.';
