-- KRAVIA Connect: source-assignment-bound department channels.
-- A staff member must hold an active canonical job assignment to the department.
-- Existing group/DM membership alone NEVER grants department channel access.
alter table public.office_chat_conversations
 add column if not exists department_code text;
create unique index if not exists office_chat_department_unique_idx
 on public.office_chat_conversations(department_code) where kind='DEPARTMENT';
alter table public.office_chat_conversations
 drop constraint if exists office_chat_department_scope;
alter table public.office_chat_conversations
 add constraint office_chat_department_scope check (
  (kind='DEPARTMENT' and department_code is not null and length(trim(department_code)) between 2 and 80)
  or (kind<>'DEPARTMENT' and department_code is null)
 );

-- Called only by current AAL2 Office session-bound server handlers.
-- OPEN is an explicit POST action; GET never writes a membership or channel.
create or replace function public.office_chat_open_department(p_actor uuid,p_department text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_code text;v_id uuid;
begin
 v_code:=upper(trim(coalesce(p_department,'')));
 if length(v_code) not between 2 and 80
 or not exists(select 1 from public.office_identity_users
               where user_id=p_actor and status='ACTIVE')
 or not exists(
  select 1 from public.office_job_assignments
  where user_id=p_actor and status='ACTIVE' and upper(department_code)=v_code
 ) then raise exception 'Active department assignment required'; end if;
 insert into public.office_chat_conversations(kind,title,classification,department_code,created_by)
 values('DEPARTMENT',v_code||' department','INTERNAL',v_code,p_actor)
 on conflict do nothing;
 select id into v_id from public.office_chat_conversations
 where kind='DEPARTMENT' and department_code=v_code and state='ACTIVE';
 if v_id is null then raise exception 'Department channel is not available'; end if;
 insert into public.office_chat_memberships(conversation_id,user_id,added_by)
 values(v_id,p_actor,p_actor)
 on conflict(conversation_id,user_id) do update
 set status='ACTIVE',joined_at=now(),revoked_at=null,added_by=excluded.added_by;
 insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
 values(v_id,p_actor,'DEPARTMENT_JOINED',v_id);
 return v_id;
end; $$;

alter table public.office_chat_audit_events drop constraint if exists office_chat_audit_events_event_type_check;
alter table public.office_chat_audit_events add constraint office_chat_audit_events_event_type_check
 check(event_type in ('DM_CREATED','GROUP_CREATED','GROUP_MEMBER_ADDED','MESSAGE_SENT','READ_ADVANCED',
   'MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SAVED','MESSAGE_UNSAVED','THREAD_REPLY','MENTION_CREATED',
   'DEPARTMENT_JOINED'));

revoke all on function public.office_chat_open_department(uuid,text) from public,anon,authenticated;
grant execute on function public.office_chat_open_department(uuid,text) to service_role;
