-- KRAVIA Connect: accurate, membership-scoped unread counters for Office 5.0.
-- No external notifications. Only service-role invocation from verified AAL2
-- Office sessions; never an authorization substitute for message reads.
create or replace function public.office_chat_unread_snapshot(p_actor uuid)
returns table(conversation_id uuid, unread_count bigint)
language sql stable security invoker set search_path=public as $$
  select member.conversation_id,
    (
      select count(*)::bigint
      from public.office_chat_messages message
      where message.conversation_id=member.conversation_id
        and message.deleted_at is null
        and message.sender_user_id<>p_actor
        and message.created_at>greatest(member.joined_at,coalesce(cursor.last_read_at,member.joined_at))
    ) as unread_count
  from public.office_chat_memberships member
  join public.office_chat_conversations conversation on conversation.id=member.conversation_id
  join public.office_identity_users identity on identity.user_id=member.user_id and identity.status='ACTIVE'
  left join public.office_chat_read_cursors cursor on cursor.user_id=member.user_id
    and cursor.conversation_id=member.conversation_id
  where member.user_id=p_actor and member.status='ACTIVE'
    and conversation.state='ACTIVE'
    and (
      conversation.kind<>'DEPARTMENT'
      or exists (
        select 1 from public.office_job_assignments assignment
        where assignment.user_id=p_actor and assignment.status='ACTIVE'
          and upper(assignment.department_code)=conversation.department_code
      )
    );
$$;
revoke all on function public.office_chat_unread_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.office_chat_unread_snapshot(uuid) to service_role;
comment on function public.office_chat_unread_snapshot(uuid) is
  'Unread private messages after verified join/read cursor, excluding own messages and revoked department access.';
