-- KRAVIA Connect: internal, explicitly member-scoped groups.
-- Additive to 202611140007. No external invites or notifications.
alter table public.office_chat_audit_events
 drop constraint if exists office_chat_audit_events_event_type_check;
alter table public.office_chat_audit_events
 add constraint office_chat_audit_events_event_type_check
 check(event_type in ('DM_CREATED','GROUP_CREATED','GROUP_MEMBER_ADDED','MESSAGE_SENT','READ_ADVANCED'));

create or replace function public.office_chat_create_group(
 p_actor uuid,p_title text,p_members uuid[]
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_count integer;
begin
 if p_actor is null or length(trim(coalesce(p_title,''))) not between 3 and 120
 or p_members is null or array_position(p_members,null) is not null then
   raise exception 'Invalid private group';
 end if;
 select count(distinct candidate.user_id) into v_count from unnest(p_members) as candidate(user_id);
 if v_count<1 or v_count>29 or array_length(p_members,1)<>v_count
 or p_actor=any(p_members) then
   raise exception 'Group requires 1 to 29 distinct verified colleagues';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then
   raise exception 'An active Office identity is required';
 end if;
 if (select count(*) from public.office_identity_users
     where user_id=any(p_members) and status='ACTIVE')<>v_count then
   raise exception 'Every member must be an active Office employee';
 end if;
 insert into public.office_chat_conversations(kind,title,classification,created_by)
 values('GROUP',trim(p_title),'INTERNAL',p_actor) returning id into v_id;
 insert into public.office_chat_memberships(conversation_id,user_id,added_by)
 values(v_id,p_actor,p_actor);
 insert into public.office_chat_memberships(conversation_id,user_id,added_by)
 select v_id,candidate.user_id,p_actor from unnest(p_members) as candidate(user_id);
 insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
 values(v_id,p_actor,'GROUP_CREATED',v_id);
 return v_id;
end; $$;

create or replace function public.office_chat_add_group_member(
 p_actor uuid,p_conversation uuid,p_member uuid
) returns boolean language plpgsql security invoker set search_path=public as $$
declare v_conversation public.office_chat_conversations%rowtype;
begin
 select * into v_conversation from public.office_chat_conversations
   where id=p_conversation and kind='GROUP' and state='ACTIVE' for update;
 if v_conversation.id is null or v_conversation.created_by<>p_actor
 or not exists(select 1 from public.office_chat_memberships
               where conversation_id=p_conversation and user_id=p_actor and status='ACTIVE')
 or not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
 or not exists(select 1 from public.office_identity_users where user_id=p_member and status='ACTIVE') then
    raise exception 'Group membership authority is unavailable';
 end if;
 if (select count(*) from public.office_chat_memberships
     where conversation_id=p_conversation and status='ACTIVE')>=30 then
   raise exception 'Maximum group size reached';
 end if;
 insert into public.office_chat_memberships(conversation_id,user_id,added_by)
 values(p_conversation,p_member,p_actor)
 on conflict(conversation_id,user_id) do update
 set status='ACTIVE',joined_at=now(),revoked_at=null,added_by=excluded.added_by;
 insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
 values(p_conversation,p_actor,'GROUP_MEMBER_ADDED',p_member);
 return true;
end; $$;
revoke all on function public.office_chat_create_group(uuid,text,uuid[]) from public,anon,authenticated;
revoke all on function public.office_chat_add_group_member(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_chat_create_group(uuid,text,uuid[]) to service_role;
grant execute on function public.office_chat_add_group_member(uuid,uuid,uuid) to service_role;
