begin;
do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000071';
 b uuid:='00000000-0000-4000-8000-000000000072';
 outsider uuid:='00000000-0000-4000-8000-000000000073';
 dm uuid;
begin
 if has_table_privilege('anon','public.office_chat_typing_presence','SELECT')
   or has_table_privilege('authenticated','public.office_chat_typing_presence','INSERT')
 then raise exception 'Presence is exposed to browsers'; end if;
 insert into public.office_identity_users(user_id,status)
 values(a,'ACTIVE'),(b,'ACTIVE'),(outsider,'ACTIVE');
 dm:=public.office_chat_start_dm(a,b);
 insert into public.office_chat_typing_presence(conversation_id,user_id,is_typing)
 values(dm,a,true);
 if not exists(select 1 from public.office_chat_change_events
   where conversation_id=dm and event_type='PRESENCE')
 then raise exception 'Live presence notification missing'; end if;
 begin
  insert into public.office_chat_typing_presence(conversation_id,user_id,is_typing)
   values(dm,outsider,true);
  raise exception 'Nonmember created a private typing signal';
 exception when raise_exception then
  if sqlerrm='Nonmember created a private typing signal' then raise; end if;
 end;
 update public.office_chat_memberships set status='REVOKED'
   where conversation_id=dm and user_id=a;
 begin
  update public.office_chat_typing_presence set last_signal=now()
   where conversation_id=dm and user_id=a;
  raise exception 'Revoked member refreshed presence';
 exception when raise_exception then
  if sqlerrm='Revoked member refreshed presence' then raise; end if;
 end;
end;
$$;
rollback;
