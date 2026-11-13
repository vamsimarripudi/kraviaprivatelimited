-- KRAVIA Office 5.0 isolated PostgreSQL rehearsal:
-- This fixture is intentionally rolled back, never a production migration.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','ACTIVE'),
 ('00000000-0000-4000-8000-000000000004','PENDING');

do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000001';
 b uuid:='00000000-0000-4000-8000-000000000002';
 c uuid:='00000000-0000-4000-8000-000000000003';
 pending_user uuid:='00000000-0000-4000-8000-000000000004';
 nonce uuid:='00000000-0000-4000-8000-000000000010';
 dm uuid; dm_reverse uuid; first_message uuid; again uuid; grp uuid;
 count_rows integer;
begin
 if has_table_privilege('anon','public.office_chat_messages','SELECT')
 or has_table_privilege('authenticated','public.office_chat_conversations','SELECT') then
   raise exception 'Browser-facing roles can read private chat data';
 end if;
 if has_function_privilege('authenticated','public.office_chat_send_message(uuid,uuid,uuid,text)','EXECUTE')
 or has_function_privilege('anon','public.office_chat_create_group(uuid,text,uuid[])','EXECUTE') then
   raise exception 'Browser roles can invoke chat RPCs directly';
 end if;
 if not has_function_privilege('service_role','public.office_chat_start_dm(uuid,uuid)','EXECUTE') then
   raise exception 'Service-role private DM RPC permission missing';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.office_chat_messages'::regclass) then
   raise exception 'Message row-level security is disabled';
 end if;
 dm:=public.office_chat_start_dm(a,b);
 dm_reverse:=public.office_chat_start_dm(b,a);
 if dm<>dm_reverse then raise exception 'DM idempotency failed'; end if;
 select count(*) into count_rows from public.office_chat_memberships
   where conversation_id=dm and status='ACTIVE';
 if count_rows<>2 then raise exception 'DM membership is not limited to both participants'; end if;
 first_message:=public.office_chat_send_message(a,dm,nonce,'A private unit test');
 again:=public.office_chat_send_message(a,dm,nonce,'A private unit test');
 if first_message<>again then raise exception 'Send idempotency failed'; end if;
 select count(*) into count_rows from public.office_chat_messages where conversation_id=dm;
 if count_rows<>1 then raise exception 'Duplicate message committed'; end if;
 if not public.office_chat_advance_read(b,dm) then raise exception 'Read cursor update failed'; end if;
 begin
   perform public.office_chat_send_message(c,dm,'00000000-0000-4000-8000-000000000011','unauthorized');
   raise exception 'Unauthorized outsider was permitted to send';
 exception when raise_exception then
   if sqlerrm='Unauthorized outsider was permitted to send' then raise; end if;
 end;
 begin
   perform public.office_chat_start_dm(a,pending_user);
   raise exception 'Pending identity was allowed into private chat';
 exception when raise_exception then
   if sqlerrm='Pending identity was allowed into private chat' then raise; end if;
 end;
 grp:=public.office_chat_create_group(a,'Internal engineering project',array[b]);
 select count(*) into count_rows from public.office_chat_memberships
   where conversation_id=grp and status='ACTIVE';
 if count_rows<>2 then raise exception 'Private group membership invariant failed'; end if;
 begin
   perform public.office_chat_add_group_member(b,grp,c);
   raise exception 'Non-creator could expand restricted group';
 exception when raise_exception then
   if sqlerrm='Non-creator could expand restricted group' then raise; end if;
 end;
 if not public.office_chat_add_group_member(a,grp,c) then
   raise exception 'Authorized group membership grant failed';
 end if;
 if (select count(*) from public.office_chat_memberships
     where conversation_id=grp and status='ACTIVE')<>3 then
   raise exception 'New group member was not recorded';
 end if;
 if (select count(*) from public.office_chat_audit_events
     where conversation_id=grp and event_type='GROUP_MEMBER_ADDED')<>1 then
   raise exception 'Group membership audit missing';
 end if;
end;
$$;
rollback;
