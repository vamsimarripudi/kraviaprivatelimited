-- KRAVIA Connect: close revocation / department-transfer races in supporting
-- projections. RPC authorization remains required; table guards add defense in depth.
-- Code-only migration, not executed against production without approval.
create or replace function public.office_chat_current_member(p_actor uuid,p_conversation uuid)
returns boolean language sql stable security invoker set search_path=public as $$
 select exists(
  select 1 from public.office_chat_conversations c
  join public.office_chat_memberships m on m.conversation_id=c.id
  join public.office_identity_users i on i.user_id=m.user_id
  where c.id=p_conversation and c.state='ACTIVE'
    and m.user_id=p_actor and m.status='ACTIVE' and i.status='ACTIVE'
    and (c.kind<>'DEPARTMENT' or exists(
      select 1 from public.office_job_assignments j
      where j.user_id=p_actor and j.status='ACTIVE'
        and upper(j.department_code)=upper(c.department_code)
    ))
 );
$$;
revoke all on function public.office_chat_current_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_chat_current_member(uuid,uuid) to service_role;

create or replace function public.office_chat_projection_membership_guard()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_actor uuid;v_conversation uuid;
begin
 if tg_table_name='office_chat_read_cursors' then
   v_actor:=new.user_id;v_conversation:=new.conversation_id;
 elsif tg_table_name='office_chat_saved_messages' then
   v_actor:=new.user_id;
   select conversation_id into v_conversation from public.office_chat_messages
    where id=new.message_id and deleted_at is null;
 elsif tg_table_name='office_chat_message_mentions' then
   v_actor:=new.mentioned_user_id;
   select conversation_id into v_conversation from public.office_chat_messages
    where id=new.message_id and deleted_at is null;
 else
   raise exception 'Unexpected Connect projection';
 end if;
 if v_conversation is null or not public.office_chat_current_member(v_actor,v_conversation)
 then raise exception 'Current conversation membership is required'; end if;
 return new;
end; $$;
revoke all on function public.office_chat_projection_membership_guard() from public,anon,authenticated;
grant execute on function public.office_chat_projection_membership_guard() to service_role;

drop trigger if exists office_chat_read_cursor_current_guard on public.office_chat_read_cursors;
create trigger office_chat_read_cursor_current_guard before insert or update
 on public.office_chat_read_cursors for each row
 execute function public.office_chat_projection_membership_guard();

drop trigger if exists office_chat_saved_message_current_guard on public.office_chat_saved_messages;
create trigger office_chat_saved_message_current_guard before insert or update
 on public.office_chat_saved_messages for each row
 execute function public.office_chat_projection_membership_guard();

drop trigger if exists office_chat_mention_current_guard on public.office_chat_message_mentions;
create trigger office_chat_mention_current_guard before insert or update
 on public.office_chat_message_mentions for each row
 execute function public.office_chat_projection_membership_guard();
