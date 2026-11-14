-- Rollback-only unread count authorization checks; never company data.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','ACTIVE');
do $$
declare
 alice uuid:='00000000-0000-4000-8000-000000000001';
 bob uuid:='00000000-0000-4000-8000-000000000002';
 outside uuid:='00000000-0000-4000-8000-000000000003';
 conversation uuid;
 unread bigint;
begin
 if has_function_privilege('anon','public.office_chat_unread_snapshot(uuid)','EXECUTE') or
    has_function_privilege('authenticated','public.office_chat_unread_snapshot(uuid)','EXECUTE') then
    raise exception 'Anonymous/browser unread lookup is executable';
 end if;
 conversation:=public.office_chat_start_dm(alice,bob);
 perform public.office_chat_send_message(alice,conversation,'00000000-0000-4000-8000-000000000011','First private message');
 -- PostgreSQL now() is transaction-stable. Represent distinct HTTP requests
 -- with explicit fixture timestamps while retaining rollback-only testing.
 update public.office_chat_messages set created_at=now()+interval '1 second'
 where sender_user_id=alice and client_nonce='00000000-0000-4000-8000-000000000011'::uuid;
 select s.unread_count into unread from public.office_chat_unread_snapshot(bob) s where s.conversation_id=conversation;
 if unread<>1 then raise exception 'Receiver unread count is incorrect: %', unread; end if;
 select s.unread_count into unread from public.office_chat_unread_snapshot(alice) s where s.conversation_id=conversation;
 if unread<>0 then raise exception 'Sender own message was counted as unread'; end if;
 if exists(select 1 from public.office_chat_unread_snapshot(outside)) then
   raise exception 'Outsider could enumerate conversation unread count'; end if;
 perform public.office_chat_advance_read(bob,conversation);
 update public.office_chat_read_cursors set last_read_at=now()+interval '2 seconds'
 where conversation_id=conversation and user_id=bob;
 select s.unread_count into unread from public.office_chat_unread_snapshot(bob) s where s.conversation_id=conversation;
 if unread<>0 then raise exception 'Read cursor did not clear unread count'; end if;
 perform public.office_chat_send_message(alice,conversation,'00000000-0000-4000-8000-000000000012','Second private message');
 update public.office_chat_messages set created_at=now()+interval '3 seconds'
 where sender_user_id=alice and client_nonce='00000000-0000-4000-8000-000000000012'::uuid;
 select s.unread_count into unread from public.office_chat_unread_snapshot(bob) s where s.conversation_id=conversation;
 if unread<>1 then raise exception 'New unread count after cursor is incorrect'; end if;
 update public.office_chat_memberships set status='REVOKED',revoked_at=now()
 where conversation_id=conversation and user_id=bob;
 if exists(select 1 from public.office_chat_unread_snapshot(bob) s where s.conversation_id=conversation) then
   raise exception 'Revoked participant could enumerate unread count';
 end if;
end; $$;
rollback;
