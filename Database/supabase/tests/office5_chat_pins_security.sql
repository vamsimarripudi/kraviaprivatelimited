-- Isolation-only pin authorization and audit checks; no persistent fixtures.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','ACTIVE');
insert into public.office_job_assignments(user_id,department_code,status) values
 ('00000000-0000-4000-8000-000000000001','ENGINEERING','ACTIVE'),
 ('00000000-0000-4000-8000-000000000002','ENGINEERING','ACTIVE'),
 ('00000000-0000-4000-8000-000000000003','FINANCE','ACTIVE');
do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000001';
 b uuid:='00000000-0000-4000-8000-000000000002';
 outsider uuid:='00000000-0000-4000-8000-000000000003';
 dm uuid;grp uuid;dept uuid; msg uuid;group_msg uuid;department_msg uuid;
 audit_count integer;
begin
 if has_table_privilege('authenticated','public.office_chat_pinned_messages','SELECT')
 or has_function_privilege('anon','public.office_chat_set_pin(uuid,uuid,boolean)','EXECUTE')
 then raise exception 'Browser can enumerate or mutate pinned messages'; end if;
 dm:=public.office_chat_start_dm(a,b);
 msg:=public.office_chat_send_message(a,dm,'00000000-0000-4000-8000-000000000030','A private message');
 begin
  perform public.office_chat_set_pin(outsider,msg,true);
  raise exception 'Outsider pinned a private message';
 exception when raise_exception then
  if sqlerrm='Outsider pinned a private message' then raise; end if;
 end;
 perform public.office_chat_set_pin(b,msg,true);
 perform public.office_chat_set_pin(b,msg,true);
 select count(*) into audit_count from public.office_chat_audit_events
  where conversation_id=dm and event_type='MESSAGE_PINNED' and object_id=msg;
 if audit_count<>1 then raise exception 'Idempotent pin emitted duplicate audit events'; end if;
 perform public.office_chat_set_pin(a,msg,false);
 if exists(select 1 from public.office_chat_pinned_messages where message_id=msg)
 then raise exception 'Pin was not removed'; end if;

 grp:=public.office_chat_create_group(a,'Private engineering project',array[b]);
 group_msg:=public.office_chat_send_message(b,grp,'00000000-0000-4000-8000-000000000031','Project note');
 begin
  perform public.office_chat_set_pin(b,group_msg,true);
  raise exception 'Group member pinned without group administration';
 exception when raise_exception then
  if sqlerrm='Group member pinned without group administration' then raise; end if;
 end;
 perform public.office_chat_set_pin(a,group_msg,true);
 if not exists(select 1 from public.office_chat_pinned_messages where message_id=group_msg)
 then raise exception 'Authorized group pin unavailable'; end if;

 dept:=public.office_chat_open_department(a,'ENGINEERING');
 perform public.office_chat_open_department(b,'ENGINEERING');
 department_msg:=public.office_chat_send_message(a,dept,'00000000-0000-4000-8000-000000000032','Department note');
 update public.office_job_assignments set department_code='FINANCE' where user_id=a;
 begin
  perform public.office_chat_set_pin(a,department_msg,true);
  raise exception 'Transferred employee pinned previous department note';
 exception when raise_exception then
  if sqlerrm='Transferred employee pinned previous department note' then raise; end if;
 end;
 perform public.office_chat_set_pin(b,department_msg,true);
 if not exists(select 1 from public.office_chat_pinned_messages where message_id=department_msg)
 then raise exception 'Active department pin not recorded'; end if;
end; $$;
rollback;
