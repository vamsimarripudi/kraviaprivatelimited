-- KRAVIA Connect: member-scoped reactions, no exposure of other reactors' names.
-- Additive code-only migration; apply only after explicit release approval.
create table if not exists public.office_chat_message_reactions (
 message_id uuid not null references public.office_chat_messages(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 emoji text not null check(emoji in ('👍','❤️','✅','🎉','👀','🤔')),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji)
);
create index if not exists office_chat_reactions_message_idx
 on public.office_chat_message_reactions(message_id,emoji);
alter table public.office_chat_message_reactions enable row level security;
revoke all on public.office_chat_message_reactions from public,anon,authenticated;
grant select,insert,delete on public.office_chat_message_reactions to service_role;

alter table public.office_chat_audit_events drop constraint if exists office_chat_audit_events_event_type_check;
alter table public.office_chat_audit_events add constraint office_chat_audit_events_event_type_check
 check(event_type in ('DM_CREATED','GROUP_CREATED','GROUP_MEMBER_ADDED','MESSAGE_SENT','READ_ADVANCED',
 'MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SAVED','MESSAGE_UNSAVED','THREAD_REPLY','MENTION_CREATED',
 'DEPARTMENT_JOINED','MESSAGE_PINNED','MESSAGE_UNPINNED','REACTION_ADDED','REACTION_REMOVED'));

create or replace function public.office_chat_set_reaction(
 p_actor uuid,p_message uuid,p_emoji text,p_react boolean
) returns boolean language plpgsql security invoker set search_path=public as $$
declare v_conversation uuid;v_rows integer;
begin
 select m.conversation_id into v_conversation from public.office_chat_messages m
 join public.office_chat_conversations c on c.id=m.conversation_id
 join public.office_chat_memberships member on member.conversation_id=c.id
 join public.office_identity_users i on i.user_id=member.user_id
 where m.id=p_message and m.deleted_at is null and c.state='ACTIVE'
 and member.user_id=p_actor and member.status='ACTIVE' and i.status='ACTIVE';
 if v_conversation is null or p_react is null
 or p_emoji not in ('👍','❤️','✅','🎉','👀','🤔')
 then raise exception 'Reaction unavailable'; end if;
 if exists(select 1 from public.office_chat_conversations c
   where c.id=v_conversation and c.kind='DEPARTMENT' and not exists(
    select 1 from public.office_job_assignments j where j.user_id=p_actor
     and j.status='ACTIVE' and upper(j.department_code)=upper(c.department_code)
   )) then raise exception 'Current department assignment required'; end if;
 if p_react then
  insert into public.office_chat_message_reactions(message_id,user_id,emoji)
  values(p_message,p_actor,p_emoji) on conflict do nothing;
 else
  delete from public.office_chat_message_reactions
  where message_id=p_message and user_id=p_actor and emoji=p_emoji;
 end if;
 get diagnostics v_rows=row_count;
 if v_rows>0 then
  insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
  values(v_conversation,p_actor,
    case when p_react then 'REACTION_ADDED' else 'REACTION_REMOVED' end,p_message);
 end if;
 return true;
end; $$;

create or replace function public.office_chat_reaction_snapshot(
 p_actor uuid,p_conversation uuid,p_messages uuid[]
) returns table(message_id uuid,emoji text,reaction_count bigint,mine boolean)
 language plpgsql security invoker set search_path=public as $$
begin
 if coalesce(array_length(p_messages,1),0)>100
 or not exists(select 1 from public.office_chat_memberships m
  join public.office_identity_users i on i.user_id=m.user_id
  join public.office_chat_conversations c on c.id=m.conversation_id
  where m.conversation_id=p_conversation and m.user_id=p_actor
   and m.status='ACTIVE' and i.status='ACTIVE' and c.state='ACTIVE'
   and (c.kind<>'DEPARTMENT' or exists(select 1 from public.office_job_assignments j
    where j.user_id=p_actor and j.status='ACTIVE'
     and upper(j.department_code)=upper(c.department_code))))
 then raise exception 'Reaction scope unavailable'; end if;
 return query
  select r.message_id,r.emoji,count(*)::bigint, bool_or(r.user_id=p_actor)
  from public.office_chat_message_reactions r
  join public.office_chat_messages m on m.id=r.message_id
  where m.conversation_id=p_conversation and m.deleted_at is null
   and r.message_id=any(coalesce(p_messages,array[]::uuid[]))
  group by r.message_id,r.emoji;
end; $$;

revoke all on function public.office_chat_set_reaction(uuid,uuid,text,boolean)
 from public,anon,authenticated;
revoke all on function public.office_chat_reaction_snapshot(uuid,uuid,uuid[])
 from public,anon,authenticated;
grant execute on function public.office_chat_set_reaction(uuid,uuid,text,boolean) to service_role;
grant execute on function public.office_chat_reaction_snapshot(uuid,uuid,uuid[]) to service_role;
