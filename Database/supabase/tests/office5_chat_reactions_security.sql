-- KRAVIA Connect reaction authorization and privacy, isolated rollback-only.
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
 dm uuid;dept uuid;msg uuid;dep_msg uuid;total integer;v_mine boolean;
begin
 if has_table_privilege('authenticated','public.office_chat_message_reactions','SELECT')
 or has_function_privilege('anon','public.office_chat_set_reaction(uuid,uuid,text,boolean)','EXECUTE')
 or has_function_privilege('authenticated','public.office_chat_reaction_snapshot(uuid,uuid,uuid[])','EXECUTE')
 then raise exception 'Public/private reaction access exposed to browser role'; end if;
 dm:=public.office_chat_start_dm(a,b);
 msg:=public.office_chat_send_message(a,dm,'00000000-0000-4000-8000-000000000040','Internal message');
 begin
  perform public.office_chat_set_reaction(outsider,msg,'👍',true);
  raise exception 'Outsider reacted to private message';
 exception when raise_exception then
  if sqlerrm='Outsider reacted to private message' then raise; end if;
 end;
 begin
  perform * from public.office_chat_reaction_snapshot(outsider,dm,array[msg]);
  raise exception 'Outsider read private reaction counts';
 exception when raise_exception then
  if sqlerrm='Outsider read private reaction counts' then raise; end if;
 end;
 perform public.office_chat_set_reaction(a,msg,'👍',true);
 perform public.office_chat_set_reaction(a,msg,'👍',true);
 perform public.office_chat_set_reaction(b,msg,'👍',true);
 select snapshot.reaction_count,snapshot.mine into total,v_mine from public.office_chat_reaction_snapshot(a,dm,array[msg])
  as snapshot where snapshot.emoji='👍' and snapshot.message_id=msg;
 if total<>2 or v_mine is distinct from true then raise exception 'Reaction snapshot incorrect'; end if;
 perform public.office_chat_set_reaction(a,msg,'👍',false);
 select snapshot.reaction_count,snapshot.mine into total,v_mine from public.office_chat_reaction_snapshot(a,dm,array[msg])
  as snapshot where snapshot.emoji='👍' and snapshot.message_id=msg;
 if total<>1 or v_mine is distinct from false then raise exception 'Reaction removal not reflected'; end if;
 if (select count(*) from public.office_chat_audit_events where event_type='REACTION_ADDED')<>2 then
  raise exception 'Reaction idempotency audit duplicated'; end if;
 begin
  perform public.office_chat_set_reaction(a,msg,'🚫',true);
  raise exception 'Unsupported emoji reaction accepted';
 exception when raise_exception then
  if sqlerrm='Unsupported emoji reaction accepted' then raise; end if;
 end;
 dept:=public.office_chat_open_department(a,'ENGINEERING');
 perform public.office_chat_open_department(b,'ENGINEERING');
 dep_msg:=public.office_chat_send_message(a,dept,'00000000-0000-4000-8000-000000000041','Engineering');
 update public.office_job_assignments set department_code='FINANCE' where user_id=a;
 begin
  perform public.office_chat_set_reaction(a,dep_msg,'👍',true);
  raise exception 'Former department reacted';
 exception when raise_exception then
  if sqlerrm='Former department reacted' then raise; end if;
 end;
 begin
  perform * from public.office_chat_reaction_snapshot(a,dept,array[dep_msg]);
  raise exception 'Former department read reactions';
 exception when raise_exception then
  if sqlerrm='Former department read reactions' then raise; end if;
 end;
end; $$;
rollback;
