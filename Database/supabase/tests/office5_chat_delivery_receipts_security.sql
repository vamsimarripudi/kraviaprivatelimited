-- Isolated Postgres 17 test only. All synthetic data is rolled back.
begin;
do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000081';
 b uuid:='00000000-0000-4000-8000-000000000082';
 outsider uuid:='00000000-0000-4000-8000-000000000083';
 dm uuid;msg uuid;ack integer;
begin
 if not (select relrowsecurity from pg_class
   where oid='public.office_chat_message_deliveries'::regclass)
  or has_table_privilege('anon','public.office_chat_message_deliveries','SELECT')
  or has_table_privilege('authenticated','public.office_chat_message_deliveries','SELECT')
  or has_table_privilege('authenticated','public.office_chat_message_deliveries','INSERT')
  or has_function_privilege('authenticated','public.office_chat_ack_delivery(uuid,uuid,uuid[])','EXECUTE')
 then raise exception 'Chat receipt privileges are not private'; end if;
 insert into public.office_identity_users(user_id,status)
 values(a,'ACTIVE'),(b,'ACTIVE'),(outsider,'ACTIVE');
 dm:=public.office_chat_start_dm(a,b);
 msg:=public.office_chat_send_message(a,dm,'00000000-0000-4000-8000-000000000084','Test delivery');
 ack:=public.office_chat_ack_delivery(b,dm,array[msg]);
 if ack<>1 then raise exception 'Expected one recipient delivery, got %',ack; end if;
 ack:=public.office_chat_ack_delivery(b,dm,array[msg]);
 if ack<>0 then raise exception 'Idempotent receipt inserted twice'; end if;
 ack:=public.office_chat_ack_delivery(a,dm,array[msg]);
 if ack<>0 then raise exception 'Sender should not acknowledge own delivery'; end if;
 if not exists(select 1 from public.office_chat_message_deliveries
    where message_id=msg and recipient_user_id=b)
 or not exists(select 1 from public.office_chat_change_events
    where conversation_id=dm and event_type='RECEIPT')
 then raise exception 'Recipient receipt/event missing'; end if;
 perform public.office_chat_advance_read(b,dm);
 if (select count(*) from public.office_chat_change_events
   where conversation_id=dm and event_type='RECEIPT')<2
 then raise exception 'Read cursor failed to invalidate sender receipts'; end if;
 begin
  perform public.office_chat_ack_delivery(outsider,dm,array[msg]);
  raise exception 'Non-member acknowledged a private message';
 exception when raise_exception then
  if sqlerrm='Non-member acknowledged a private message' then raise; end if;
 end;
 update public.office_chat_memberships set status='REVOKED'
 where conversation_id=dm and user_id=b;
 begin
  perform public.office_chat_ack_delivery(b,dm,array[msg]);
  raise exception 'Revoked member acknowledged a message';
 exception when raise_exception then
  if sqlerrm='Revoked member acknowledged a message' then raise; end if;
 end;
end $$;
rollback;
