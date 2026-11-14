-- KRAVIA Connect extended access tests: rollback-only.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','ACTIVE');
do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000001';
 b uuid:='00000000-0000-4000-8000-000000000002';
 outsider uuid:='00000000-0000-4000-8000-000000000003';
 dm uuid; parent_msg uuid;reply uuid;again uuid;mentioned uuid;
 n integer;
begin
 if has_table_privilege('anon','public.office_chat_message_revisions','SELECT')
 or has_function_privilege('authenticated','public.office_chat_save_message(uuid,uuid,boolean)','EXECUTE')
 then raise exception 'Browser direct access to chat history is open'; end if;
 dm:=public.office_chat_start_dm(a,b);
 parent_msg:=public.office_chat_send_message(a,dm,'00000000-0000-4000-8000-000000000010','Original message');
 reply:=public.office_chat_send_reply(b,parent_msg,
  '00000000-0000-4000-8000-000000000011','Thread reply');
 again:=public.office_chat_send_reply(b,parent_msg,
  '00000000-0000-4000-8000-000000000011','Thread reply');
 if reply<>again then raise exception 'Thread reply idempotency failed'; end if;
 if not exists(select 1 from public.office_chat_messages where id=reply and parent_message_id=parent_msg)
 then raise exception 'Thread linkage missing'; end if;
 begin
  perform public.office_chat_send_reply(outsider,parent_msg,
   '00000000-0000-4000-8000-000000000012','Outsider reply');
  raise exception 'Outsider joined private thread';
 exception when raise_exception then
  if sqlerrm='Outsider joined private thread' then raise; end if;
 end;
 if not public.office_chat_save_message(a,parent_msg,true) then
  raise exception 'Save failed'; end if;
 if not exists(select 1 from public.office_chat_saved_messages
  where user_id=a and message_id=parent_msg) then raise exception 'Missing save pointer'; end if;
 begin
  perform public.office_chat_save_message(outsider,parent_msg,true);
  raise exception 'Outsider saved private message';
 exception when raise_exception then
  if sqlerrm='Outsider saved private message' then raise; end if;
 end;
 if not public.office_chat_edit_message(a,parent_msg,'Updated message') then
  raise exception 'Author edit not committed'; end if;
 if not exists(select 1 from public.office_chat_message_revisions where message_id=parent_msg and previous_body='Original message')
 then raise exception 'Immutable revision not retained'; end if;
 begin
  perform public.office_chat_edit_message(b,parent_msg,'Unauthorized edit');
  raise exception 'Recipient edited another employee message';
 exception when raise_exception then
  if sqlerrm='Recipient edited another employee message' then raise; end if;
 end;
 mentioned:=public.office_chat_send_with_mentions(a,dm,'00000000-0000-4000-8000-000000000013',
   'Mention from verified employee',array[b]);
 if not exists(select 1 from public.office_chat_message_mentions
  where message_id=mentioned and mentioned_user_id=b) then
  raise exception 'Mention index not committed'; end if;
 if not public.office_chat_mark_mention_read(b,mentioned) then raise exception 'Mention read failed'; end if;
 if not exists(select 1 from public.office_chat_message_mentions
   where message_id=mentioned and mentioned_user_id=b and read_at is not null)
 then raise exception 'Read receipt missing'; end if;
 begin
  perform public.office_chat_send_with_mentions(a,dm,'00000000-0000-4000-8000-000000000014',
   'Private mention to non-member',array[outsider]);
  raise exception 'An outsider was mentioned into a restricted conversation';
 exception when raise_exception then
  if sqlerrm='An outsider was mentioned into a restricted conversation' then raise; end if;
 end;
 if exists(select 1 from public.office_chat_messages
  where client_nonce='00000000-0000-4000-8000-000000000014'::uuid)
 then raise exception 'Unauthorized mention partially committed a message'; end if;
 if not public.office_chat_soft_delete_message(a,parent_msg) then raise exception 'Soft removal failed'; end if;
 if not exists(select 1 from public.office_chat_messages where id=parent_msg and deleted_at is not null)
 then raise exception 'Removal audit/retention not applied'; end if;
 if not public.office_chat_save_message(a,mentioned,true) or
   not public.office_chat_save_message(a,mentioned,false) then raise exception 'Save toggles failed'; end if;
 select count(*) into n from public.office_chat_saved_messages where user_id=a and message_id=mentioned;
 if n<>0 then raise exception 'Unsave did not clear the pointer'; end if;
end; $$;
rollback;
