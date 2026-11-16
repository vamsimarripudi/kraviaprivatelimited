-- KRAVIA Connect: suppress recipient-visible attachment invalidations
-- until a sender commits the attachment to a persisted message.
-- Incremental migration: the original presence migration is already applied.
create or replace function public.office_chat_record_linked_attachment()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  -- Upload, scan and cancellation are private draft activity.
  if new.message_id is null then return new; end if;

  if tg_op='INSERT' then
    insert into public.office_chat_change_events(conversation_id,event_type)
    values(new.conversation_id,'ATTACHMENT');
    return new;
  end if;

  if old.message_id is distinct from new.message_id or
     old.status is distinct from new.status then
    insert into public.office_chat_change_events(conversation_id,event_type)
    values(new.conversation_id,'ATTACHMENT');
  end if;
  return new;
end;
$$;

revoke all on function public.office_chat_record_linked_attachment()
 from public, anon, authenticated;
grant execute on function public.office_chat_record_linked_attachment()
 to service_role;

drop trigger if exists office_chat_live_attachment
 on public.office_chat_attachment_objects;
create trigger office_chat_live_attachment
after insert or update of status,message_id
on public.office_chat_attachment_objects
for each row execute function public.office_chat_record_linked_attachment();

comment on function public.office_chat_record_linked_attachment() is
 'No recipient chat event for unlinked uploads, scan changes or cancelled drafts; emits only for already committed attachment links.';
