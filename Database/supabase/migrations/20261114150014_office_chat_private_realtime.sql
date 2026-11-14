-- KRAVIA Connect 5.0: private, ordered change ledger for first-party SSE.
-- This file is branch-only until the separately approved production migration.
-- Message text, employee addresses, device tokens and file paths are NEVER
-- inserted into the event ledger. A subscriber must pass live membership checks.
create table if not exists public.office_chat_change_events(
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 event_type text not null check(event_type in (
  'MESSAGE','MESSAGE_CHANGED','MEMBERSHIP','PIN','REACTION','ATTACHMENT'
 )),
 occurred_at timestamptz not null default now()
);
create index if not exists office_chat_change_events_lookup_idx
 on public.office_chat_change_events(conversation_id,id desc);

alter table public.office_chat_change_events enable row level security;
revoke all on public.office_chat_change_events from public,anon,authenticated;
revoke all on sequence public.office_chat_change_events_id_seq from public,anon,authenticated;
grant select,insert on public.office_chat_change_events to service_role;
grant usage,select on sequence public.office_chat_change_events_id_seq to service_role;

create or replace function public.office_chat_record_change()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_conversation uuid;v_type text;
begin
 if tg_table_name='office_chat_messages' then
   v_conversation:=coalesce(new.conversation_id,old.conversation_id);
   v_type:=case when tg_op='INSERT' then 'MESSAGE' else 'MESSAGE_CHANGED' end;
 elsif tg_table_name='office_chat_memberships' then
   v_conversation:=case when tg_op='DELETE' then old.conversation_id else new.conversation_id end;
   v_type:='MEMBERSHIP';
 elsif tg_table_name='office_chat_pinned_messages' then
   v_conversation:=case when tg_op='DELETE' then old.conversation_id else new.conversation_id end;
   v_type:='PIN';
 elsif tg_table_name='office_chat_message_reactions' then
   select conversation_id into v_conversation from public.office_chat_messages
    where id=(case when tg_op='DELETE' then old.message_id else new.message_id end);
   v_type:='REACTION';
 elsif tg_table_name='office_chat_attachment_objects' then
   v_conversation:=coalesce(new.conversation_id,old.conversation_id);
   v_type:='ATTACHMENT';
 else
   raise exception 'Unexpected Connect change source';
 end if;
 if v_conversation is not null then
   insert into public.office_chat_change_events(conversation_id,event_type)
    values(v_conversation,v_type);
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.office_chat_record_change() from public,anon,authenticated;
grant execute on function public.office_chat_record_change() to service_role;

drop trigger if exists office_chat_live_message on public.office_chat_messages;
create trigger office_chat_live_message after insert or update of body,edited_at,deleted_at
 on public.office_chat_messages for each row execute function public.office_chat_record_change();
drop trigger if exists office_chat_live_member on public.office_chat_memberships;
create trigger office_chat_live_member after insert or update of status or delete
 on public.office_chat_memberships for each row execute function public.office_chat_record_change();
drop trigger if exists office_chat_live_pin on public.office_chat_pinned_messages;
create trigger office_chat_live_pin after insert or delete
 on public.office_chat_pinned_messages for each row execute function public.office_chat_record_change();
drop trigger if exists office_chat_live_reaction on public.office_chat_message_reactions;
create trigger office_chat_live_reaction after insert or delete
 on public.office_chat_message_reactions for each row execute function public.office_chat_record_change();
-- Attachment objects exist in the earlier private scan migration, which has
-- its own independent source authorization and physical quarantine checks.
drop trigger if exists office_chat_live_attachment on public.office_chat_attachment_objects;
create trigger office_chat_live_attachment after insert or update of status,message_id
 on public.office_chat_attachment_objects for each row execute function public.office_chat_record_change();

comment on table public.office_chat_change_events is
 'Private ordered invalidation events only; never grant browser SQL access. The Office SSE service must check current membership on every batch.';
