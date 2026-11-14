-- KRAVIA Connect: versioned conversations, saved references, mentions and threads.
-- Office chat remains internal. No external sends, no implicit approvals.
alter table public.office_chat_messages
 add column if not exists parent_message_id uuid references public.office_chat_messages(id) on delete restrict;
create index if not exists office_chat_thread_idx
 on public.office_chat_messages(parent_message_id,created_at,id) where parent_message_id is not null;

create table if not exists public.office_chat_saved_messages (
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 message_id uuid not null references public.office_chat_messages(id) on delete restrict,
 saved_at timestamptz not null default now(),
 primary key(user_id,message_id)
);
create index if not exists office_chat_saved_recent_idx on public.office_chat_saved_messages(user_id,saved_at desc);

create table if not exists public.office_chat_message_mentions (
 message_id uuid not null references public.office_chat_messages(id) on delete restrict,
 mentioned_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(message_id,mentioned_user_id)
);
create index if not exists office_chat_mention_recipient_idx
 on public.office_chat_message_mentions(mentioned_user_id,read_at,created_at desc);

create table if not exists public.office_chat_message_revisions (
 id bigint generated always as identity primary key,
 message_id uuid not null references public.office_chat_messages(id) on delete restrict,
 edited_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 previous_body text not null,
 revised_at timestamptz not null default now()
);
create index if not exists office_chat_revisions_message_idx
 on public.office_chat_message_revisions(message_id,revised_at desc);

alter table public.office_chat_saved_messages enable row level security;
alter table public.office_chat_message_mentions enable row level security;
alter table public.office_chat_message_revisions enable row level security;
revoke all on public.office_chat_saved_messages,public.office_chat_message_mentions,
 public.office_chat_message_revisions from public,anon,authenticated;
grant select,insert,delete on public.office_chat_saved_messages to service_role;
grant select,insert,update on public.office_chat_message_mentions to service_role;
grant select,insert on public.office_chat_message_revisions to service_role;
grant usage,select on sequence public.office_chat_message_revisions_id_seq to service_role;

alter table public.office_chat_audit_events drop constraint if exists office_chat_audit_events_event_type_check;
alter table public.office_chat_audit_events add constraint office_chat_audit_events_event_type_check
 check(event_type in ('DM_CREATED','GROUP_CREATED','GROUP_MEMBER_ADDED','MESSAGE_SENT','READ_ADVANCED',
   'MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SAVED','MESSAGE_UNSAVED','THREAD_REPLY','MENTION_CREATED'));

create or replace function public.office_chat_send_reply(
 p_actor uuid,p_parent uuid,p_nonce uuid,p_body text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_conversation uuid;v_id uuid;
begin
 select conversation_id into v_conversation
 from public.office_chat_messages where id=p_parent and deleted_at is null;
 if v_conversation is null or not exists(
 select 1 from public.office_chat_memberships m
 join public.office_chat_conversations c on c.id=m.conversation_id
 where m.conversation_id=v_conversation and m.user_id=p_actor and m.status='ACTIVE' and c.state='ACTIVE'
 ) then raise exception 'Thread unavailable'; end if;
 if p_nonce is null or length(trim(coalesce(p_body,''))) not between 1 and 4000 then
  raise exception 'Invalid reply'; end if;
 insert into public.office_chat_messages(conversation_id,sender_user_id,client_nonce,body,parent_message_id)
 values(v_conversation,p_actor,p_nonce,trim(p_body),p_parent)
 on conflict(conversation_id,sender_user_id,client_nonce) do nothing
 returning id into v_id;
 if v_id is null then
  select id into v_id from public.office_chat_messages
   where conversation_id=v_conversation and sender_user_id=p_actor and client_nonce=p_nonce
   and parent_message_id=p_parent;
  if v_id is null then raise exception 'Reply nonce belongs to a different message'; end if;
 else
  update public.office_chat_conversations set updated_at=now() where id=v_conversation;
  insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
    values(v_conversation,p_actor,'THREAD_REPLY',v_id);
 end if;
 return v_id;
end; $$;

create or replace function public.office_chat_save_message(
 p_actor uuid,p_message uuid,p_save boolean
) returns boolean language plpgsql security invoker set search_path=public as $$
declare v_conversation uuid;v_updated integer;
begin
 select m.conversation_id into v_conversation from public.office_chat_messages m
 join public.office_chat_memberships member on member.conversation_id=m.conversation_id
 join public.office_chat_conversations c on c.id=m.conversation_id
 where m.id=p_message and m.deleted_at is null
  and member.user_id=p_actor and member.status='ACTIVE' and c.state='ACTIVE';
 if v_conversation is null then raise exception 'Message unavailable'; end if;
 if p_save then
  insert into public.office_chat_saved_messages(user_id,message_id)
  values(p_actor,p_message) on conflict(user_id,message_id) do nothing;
 else
  delete from public.office_chat_saved_messages where user_id=p_actor and message_id=p_message;
 end if;
 get diagnostics v_updated=row_count;
 if v_updated>0 then
  insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
  values(v_conversation,p_actor,case when p_save then 'MESSAGE_SAVED' else 'MESSAGE_UNSAVED' end,p_message);
 end if;
 return true;
end; $$;

create or replace function public.office_chat_edit_message(
 p_actor uuid,p_message uuid,p_body text
) returns boolean language plpgsql security invoker set search_path=public as $$
declare m public.office_chat_messages%rowtype;
begin
 select * into m from public.office_chat_messages where id=p_message for update;
 if m.id is null or m.sender_user_id<>p_actor or m.deleted_at is not null
 or m.created_at<now()-interval '15 minutes'
 or not exists(
  select 1 from public.office_chat_memberships member
  join public.office_chat_conversations c on c.id=member.conversation_id
  where member.conversation_id=m.conversation_id and member.user_id=p_actor
   and member.status='ACTIVE' and c.state='ACTIVE'
 ) then raise exception 'Edit window or membership is unavailable'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'Invalid message'; end if;
 if m.body=trim(p_body) then return true; end if;
 insert into public.office_chat_message_revisions(message_id,edited_by,previous_body)
 values(m.id,p_actor,m.body);
 update public.office_chat_messages set body=trim(p_body),edited_at=now() where id=m.id;
 insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
 values(m.conversation_id,p_actor,'MESSAGE_EDITED',m.id);
 return true;
end; $$;

create or replace function public.office_chat_soft_delete_message(p_actor uuid,p_message uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare m public.office_chat_messages%rowtype;
begin
 select * into m from public.office_chat_messages where id=p_message for update;
 if m.id is null or m.sender_user_id<>p_actor or m.deleted_at is not null
 or not exists(select 1 from public.office_chat_memberships member
  join public.office_chat_conversations c on c.id=member.conversation_id
  where member.conversation_id=m.conversation_id and member.user_id=p_actor
  and member.status='ACTIVE' and c.state='ACTIVE')
 then raise exception 'Message deletion unavailable'; end if;
 update public.office_chat_messages set deleted_at=now() where id=m.id;
 insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
 values(m.conversation_id,p_actor,'MESSAGE_DELETED',m.id);
 return true;
end; $$;

create or replace function public.office_chat_send_with_mentions(
 p_actor uuid,p_conversation uuid,p_nonce uuid,p_body text,p_mentions uuid[]
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;v_count integer;
begin
 if p_mentions is null then p_mentions:=array[]::uuid[]; end if;
 if array_position(p_mentions,null) is not null or coalesce(array_length(p_mentions,1),0)>10 then
  raise exception 'Too many or invalid mentions'; end if;
 select count(distinct candidate.user_id) into v_count from unnest(p_mentions) as candidate(user_id);
 if v_count<>coalesce(array_length(p_mentions,1),0) then raise exception 'Duplicate mentions'; end if;
 if exists(select 1 from unnest(p_mentions) as candidate(user_id)
   where not exists(
   select 1 from public.office_chat_memberships mem
   join public.office_identity_users i on i.user_id=mem.user_id and i.status='ACTIVE'
   where mem.conversation_id=p_conversation and mem.user_id=candidate.user_id and mem.status='ACTIVE'
 )) then raise exception 'Mentioned colleague is not authorized'; end if;
 v_id:=public.office_chat_send_message(p_actor,p_conversation,p_nonce,p_body);
 insert into public.office_chat_message_mentions(message_id,mentioned_user_id)
 select v_id,candidate.user_id from unnest(p_mentions) as candidate(user_id)
 on conflict(message_id,mentioned_user_id) do nothing;
 return v_id;
end; $$;

create or replace function public.office_chat_mark_mention_read(p_actor uuid,p_message uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_conversation uuid;
begin
 select m.conversation_id into v_conversation from public.office_chat_message_mentions mention
 join public.office_chat_messages m on m.id=mention.message_id
 join public.office_chat_memberships member on member.conversation_id=m.conversation_id
 where mention.message_id=p_message and mention.mentioned_user_id=p_actor
  and m.deleted_at is null and member.user_id=p_actor and member.status='ACTIVE';
 if v_conversation is null then raise exception 'Mention unavailable'; end if;
 update public.office_chat_message_mentions set read_at=coalesce(read_at,now())
 where message_id=p_message and mentioned_user_id=p_actor;
 return true;
end; $$;

revoke all on function public.office_chat_send_reply(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_chat_save_message(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.office_chat_edit_message(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_chat_soft_delete_message(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_chat_send_with_mentions(uuid,uuid,uuid,text,uuid[]) from public,anon,authenticated;
revoke all on function public.office_chat_mark_mention_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_chat_send_reply(uuid,uuid,uuid,text) to service_role;
grant execute on function public.office_chat_save_message(uuid,uuid,boolean) to service_role;
grant execute on function public.office_chat_edit_message(uuid,uuid,text) to service_role;
grant execute on function public.office_chat_soft_delete_message(uuid,uuid) to service_role;
grant execute on function public.office_chat_send_with_mentions(uuid,uuid,uuid,text,uuid[]) to service_role;
grant execute on function public.office_chat_mark_mention_read(uuid,uuid) to service_role;
