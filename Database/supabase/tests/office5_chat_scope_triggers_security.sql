-- SQL security rehearsal: transfer and revocation races, rollback only.
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
 dept uuid;msg uuid;msg2 uuid;mentioned uuid;
begin
 if has_function_privilege('anon','public.office_chat_current_member(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.office_chat_projection_membership_guard()','EXECUTE')
 then raise exception 'Client can invoke private membership guard'; end if;
 dept:=public.office_chat_open_department(a,'ENGINEERING');
 perform public.office_chat_open_department(b,'ENGINEERING');
 msg:=public.office_chat_send_message(a,dept,'00000000-0000-4000-8000-000000000050','Initial note');
 msg2:=public.office_chat_send_message(a,dept,'00000000-0000-4000-8000-000000000051','Another note');
 mentioned:=public.office_chat_send_with_mentions(a,dept,'00000000-0000-4000-8000-000000000052',
   'Verified mention',array[b]);
 perform public.office_chat_advance_read(b,dept);
 perform public.office_chat_save_message(b,msg,true);
 if not public.office_chat_current_member(b,dept)
 then raise exception 'Current engineering user missing'; end if;
 update public.office_job_assignments set department_code='FINANCE' where user_id=b;
 if public.office_chat_current_member(b,dept)
 then raise exception 'Historical group membership still effective'; end if;
 begin
  perform public.office_chat_advance_read(b,dept);
  raise exception 'Former employee advanced read cursor';
 exception when raise_exception then
  if sqlerrm='Former employee advanced read cursor' then raise; end if;
 end;
 begin
  perform public.office_chat_save_message(b,msg2,true);
  raise exception 'Former employee saved department evidence';
 exception when raise_exception then
  if sqlerrm='Former employee saved department evidence' then raise; end if;
 end;
 begin
  perform public.office_chat_mark_mention_read(b,mentioned);
  raise exception 'Former employee changed a mention receipt';
 exception when raise_exception then
  if sqlerrm='Former employee changed a mention receipt' then raise; end if;
 end;
 begin
  perform public.office_chat_send_with_mentions(a,dept,'00000000-0000-4000-8000-000000000053',
   'Invalid transferred mention',array[b]);
  raise exception 'Former member was mentioned again';
 exception when raise_exception then
  if sqlerrm='Former member was mentioned again' then raise; end if;
 end;
 begin
  perform public.office_chat_save_message(outsider,msg,true);
  raise exception 'Outsider saved private message';
 exception when raise_exception then
  if sqlerrm='Outsider saved private message' then raise; end if;
 end;
end; $$;
rollback;
