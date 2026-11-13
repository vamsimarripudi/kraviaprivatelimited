-- KRAVIA Office 5.0: private employee-to-employee communication ledger.
-- Additive migration only. No employee messages, invitations or external mail sent.
-- Deploy only after isolated PostgreSQL rehearsal and explicit production approval.
create table if not exists public.office_chat_conversations (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('DM','GROUP','DEPARTMENT')),
 dm_key text unique,
 title text,
 classification text not null default 'INTERNAL'
   check(classification in ('INTERNAL','CONFIDENTIAL','RESTRICTED')),
 state text not null default 'ACTIVE' check(state in ('ACTIVE','ARCHIVED','LOCKED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint office_chat_dm_key_shape check((kind='DM' and dm_key is not null and title is null)
   or (kind<>'DM' and dm_key is null and title is not null))
);
create index if not exists office_chat_conversations_updated_idx on public.office_chat_conversations(updated_at desc);

create table if not exists public.office_chat_memberships (
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','REVOKED','LEFT')),
 joined_at timestamptz not null default now(),
 revoked_at timestamptz,
 added_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 primary key(conversation_id,user_id)
);
create index if not exists office_chat_memberships_user_idx
 on public.office_chat_memberships(user_id,status,conversation_id);

create table if not exists public.office_chat_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 sender_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 client_nonce uuid not null,
 body text not null check(char_length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted_at timestamptz,
 unique(conversation_id,sender_user_id,client_nonce)
);
create index if not exists office_chat_message_timeline_idx
 on public.office_chat_messages(conversation_id,created_at desc,id);

create table if not exists public.office_chat_read_cursors (
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 last_read_at timestamptz not null default now(),
 primary key(conversation_id,user_id)
);

create table if not exists public.office_chat_audit_events (
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in ('DM_CREATED','MESSAGE_SENT','READ_ADVANCED')),
 object_id uuid,
 occurred_at timestamptz not null default now()
);
create index if not exists office_chat_audit_conversation_idx
 on public.office_chat_audit_events(conversation_id,occurred_at desc);

alter table public.office_chat_conversations enable row level security;
alter table public.office_chat_memberships enable row level security;
alter table public.office_chat_messages enable row level security;
alter table public.office_chat_read_cursors enable row level security;
alter table public.office_chat_audit_events enable row level security;

-- Browser roles cannot query metadata or enumerate membership even with leaked identifiers.
revoke all on public.office_chat_conversations, public.office_chat_memberships,
 public.office_chat_messages, public.office_chat_read_cursors,
 public.office_chat_audit_events from public,anon,authenticated;
grant select,insert,update on public.office_chat_conversations,
 public.office_chat_memberships,public.office_chat_messages,
 public.office_chat_read_cursors to service_role;
grant select,insert on public.office_chat_audit_events to service_role;
grant usage,select on sequence public.office_chat_audit_events_id_seq to service_role;

-- Invoker RPCs can be called only by server service role. p_actor is never
-- accepted from the browser; it is bound to the verified Office AAL2 session.
create or replace function public.office_chat_start_dm(p_actor uuid,p_recipient uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_key text;
begin
 if p_actor is null or p_recipient is null or p_actor=p_recipient then
   raise exception 'Two distinct Office identities are required';
 end if;
 if not exists(select 1 from public.office_identity_users
               where user_id=p_actor and status='ACTIVE')
 or not exists(select 1 from public.office_identity_users
               where user_id=p_recipient and status='ACTIVE') then
   raise exception 'Both employees must be active';
 end if;
 v_key:=least(p_actor::text,p_recipient::text)||':'||greatest(p_actor::text,p_recipient::text);
 insert into public.office_chat_conversations(kind,dm_key,created_by)
 values('DM',v_key,p_actor) on conflict(dm_key) do nothing;
 select id into v_id from public.office_chat_conversations
   where dm_key=v_key and kind='DM' and state='ACTIVE';
 if v_id is null then raise exception 'This conversation is unavailable'; end if;
 insert into public.office_chat_memberships(conversation_id,user_id,added_by)
 values(v_id,p_actor,p_actor),(v_id,p_recipient,p_actor)
 on conflict(conversation_id,user_id) do nothing;
 if not exists (select 1 from public.office_chat_audit_events
                where conversation_id=v_id and event_type='DM_CREATED') then
   insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
   values(v_id,p_actor,'DM_CREATED',v_id);
 end if;
 return v_id;
end; $$;

create or replace function public.office_chat_send_message(
 p_actor uuid,p_conversation uuid,p_nonce uuid,p_body text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if p_actor is null or p_conversation is null or p_nonce is null
    or length(trim(coalesce(p_body,''))) not between 1 and 4000 then
   raise exception 'Invalid message';
 end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
   or not exists (
     select 1 from public.office_chat_memberships m
     join public.office_chat_conversations c on c.id=m.conversation_id
     where m.user_id=p_actor and m.conversation_id=p_conversation
       and m.status='ACTIVE' and c.state='ACTIVE'
   ) then raise exception 'Conversation unavailable'; end if;
 insert into public.office_chat_messages(conversation_id,sender_user_id,client_nonce,body)
 values(p_conversation,p_actor,p_nonce,trim(p_body))
 on conflict(conversation_id,sender_user_id,client_nonce) do nothing
 returning id into v_id;
 if v_id is not null then
   update public.office_chat_conversations set updated_at=now() where id=p_conversation;
   insert into public.office_chat_audit_events(conversation_id,actor_user_id,event_type,object_id)
   values(p_conversation,p_actor,'MESSAGE_SENT',v_id);
 else
   select id into v_id from public.office_chat_messages
     where conversation_id=p_conversation and sender_user_id=p_actor and client_nonce=p_nonce;
 end if;
 return v_id;
end; $$;

create or replace function public.office_chat_advance_read(
 p_actor uuid,p_conversation uuid
) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE')
    or not exists (select 1 from public.office_chat_memberships
                   where conversation_id=p_conversation and user_id=p_actor and status='ACTIVE')
 then raise exception 'Conversation unavailable'; end if;
 insert into public.office_chat_read_cursors(conversation_id,user_id,last_read_at)
 values(p_conversation,p_actor,now())
 on conflict(conversation_id,user_id) do update
   set last_read_at=greatest(public.office_chat_read_cursors.last_read_at,excluded.last_read_at);
 return true;
end; $$;

revoke all on function public.office_chat_start_dm(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_chat_send_message(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_chat_advance_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_chat_start_dm(uuid,uuid) to service_role;
grant execute on function public.office_chat_send_message(uuid,uuid,uuid,text) to service_role;
grant execute on function public.office_chat_advance_read(uuid,uuid) to service_role;
comment on table public.office_chat_messages is
 'Private Office employee message history. Chat is never an authoritative approval, financial instruction or access grant.';
