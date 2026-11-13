-- Source department assignment and write-guard rehearsal; always rollback.
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
 finance uuid:='00000000-0000-4000-8000-000000000003';
 channel uuid; joined uuid;
begin
 if has_function_privilege('authenticated','public.office_chat_open_department(uuid,text)','EXECUTE')
 then raise exception 'Browser can create department channel'; end if;
 channel:=public.office_chat_open_department(a,'ENGINEERING');
 joined:=public.office_chat_open_department(b,'ENGINEERING');
 if channel<>joined then raise exception 'Department channel uniqueness broken'; end if;
 begin
  perform public.office_chat_open_department(finance,'ENGINEERING');
  raise exception 'Cross-department membership granted';
 exception when raise_exception then
  if sqlerrm='Cross-department membership granted' then raise; end if;
 end;
 perform public.office_chat_send_message(a,channel,'00000000-0000-4000-8000-000000000020','Engineering note');
 update public.office_job_assignments set department_code='FINANCE' where user_id=a;
 begin
  perform public.office_chat_send_message(a,channel,'00000000-0000-4000-8000-000000000021','Stale sender');
  raise exception 'Transferred employee wrote to previous channel';
 exception when raise_exception then
  if sqlerrm='Transferred employee wrote to previous channel' then raise; end if;
 end;
 if (select count(*) from public.office_chat_messages where conversation_id=channel)<>1 then
  raise exception 'Stale department message was committed'; end if;
end; $$;
rollback;
