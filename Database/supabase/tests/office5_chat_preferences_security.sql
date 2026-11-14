-- SQL isolation; never persists fixture rows.
begin;
insert into public.office_identity_users(user_id,status) values
 ('00000000-0000-4000-8000-000000000001','ACTIVE');
do $$
declare me uuid:='00000000-0000-4000-8000-000000000001'; count_events integer;
begin
 if has_table_privilege('authenticated','public.office_chat_user_preferences','SELECT')
 or has_table_privilege('anon','public.office_chat_preference_events','SELECT')
 or has_function_privilege('authenticated',
 'public.office_chat_update_preferences(uuid,boolean,boolean,boolean,boolean,boolean,boolean)','EXECUTE')
 then raise exception 'Browser can inspect or mutate private preference evidence'; end if;
 perform public.office_chat_update_preferences(me,true,true,true,false,false,false);
 select count(*) into count_events from public.office_chat_preference_events where actor_user_id=me;
 if count_events<>0 then raise exception 'Default settings generated an audit event'; end if;
 perform public.office_chat_update_preferences(me,false,true,true,true,false,true);
 perform public.office_chat_update_preferences(me,false,true,true,true,false,true);
 select count(*) into count_events from public.office_chat_preference_events where actor_user_id=me;
 if count_events<>1 then raise exception 'Modified settings must be audited exactly once'; end if;
 if not exists(select 1 from public.office_chat_user_preferences where user_id=me
   and notify_direct=false and email_digest_opt_in=true and reduce_motion=true)
 then raise exception 'Preferences did not persist for the actor'; end if;
 begin
  perform public.office_chat_update_preferences(
   '00000000-0000-4000-8000-000000000099',false,false,false,false,false,false);
  raise exception 'Unknown actor wrote preferences';
 exception when raise_exception then
  if sqlerrm='Unknown actor wrote preferences' then raise; end if;
 end;
 begin
  perform public.office_chat_update_preferences(me,null,false,false,false,false,false);
  raise exception 'Null preference accepted';
 exception when raise_exception then
  if sqlerrm='Null preference accepted' then raise; end if;
 end;
end; $$;
rollback;
