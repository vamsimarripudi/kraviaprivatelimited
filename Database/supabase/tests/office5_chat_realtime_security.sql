-- The private Connect change ledger never emits content or grants browser reads.
begin;
do $$
declare a uuid:='00000000-0000-4000-8000-000000000061';
 b uuid:='00000000-0000-4000-8000-000000000062';
 dm uuid;msg uuid;event_count integer;
begin
 if has_table_privilege('anon','public.office_chat_change_events','SELECT')
 or has_table_privilege('authenticated','public.office_chat_change_events','SELECT')
 or has_function_privilege('authenticated','public.office_chat_record_change()','EXECUTE')
 then raise exception 'Chat change ledger allows browser access'; end if;
 if not (select relrowsecurity from pg_class
   where oid='public.office_chat_change_events'::regclass)
 then raise exception 'Chat change ledger RLS missing'; end if;
 insert into public.office_identity_users(user_id,status) values(a,'ACTIVE'),(b,'ACTIVE');
 dm:=public.office_chat_start_dm(a,b);
 msg:=public.office_chat_send_message(a,dm,'00000000-0000-4000-8000-000000000063','A test message');
 select count(*) into event_count from public.office_chat_change_events
 where conversation_id=dm and event_type='MESSAGE';
 if event_count<>1 then raise exception 'New message event missing or duplicated'; end if;
 update public.office_chat_messages set body='Updated text',edited_at=now() where id=msg;
 if not exists(select 1 from public.office_chat_change_events
    where conversation_id=dm and event_type='MESSAGE_CHANGED')
 then raise exception 'Message edit event missing'; end if;
 if exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='office_chat_change_events'
    and column_name in ('body','message_text','filename','storage_path','secret'))
 then raise exception 'Private message contents are exposed in live event table'; end if;
end;
$$;
rollback;
