-- KRAVIA Connect: authorized private attachment references and scan gating.
-- Reuses the existing Office quarantine bucket and FastAPI scanning endpoint.
-- Only clean, explicitly linked attachments may ever be read by conversation
-- members. Browser roles receive no storage policies or table grants.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('office-chat-attachments','office-chat-attachments',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.office_chat_attachment_objects(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.office_chat_conversations(id) on delete restrict,
 message_id uuid references public.office_chat_messages(id) on delete restrict,
 uploader_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 original_filename text not null check(char_length(trim(original_filename)) between 1 and 180),
 detected_mime_type text not null check(detected_mime_type in (
  'application/pdf','image/jpeg','image/png','image/webp'
 )),
 byte_size bigint not null check(byte_size between 1 and 10485760),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 quarantine_path text not null unique,
 released_path text unique,
 status text not null default 'QUARANTINED'
  check(status in ('QUARANTINED','SCANNING','CLEAN','BLOCKED','FAILED')),
 scanned_at timestamptz,
 linked_at timestamptz,
 created_at timestamptz not null default now(),
 check((status='CLEAN' and released_path is not null and scanned_at is not null) or status<>'CLEAN'),
 check((message_id is null and linked_at is null) or (message_id is not null and linked_at is not null))
);
create index if not exists office_chat_attachment_conversation_idx
 on public.office_chat_attachment_objects(conversation_id,status,created_at desc);
create index if not exists office_chat_attachment_message_idx
 on public.office_chat_attachment_objects(message_id) where message_id is not null;
create index if not exists office_chat_attachment_upload_idx
 on public.office_chat_attachment_objects(uploader_user_id,status,created_at desc);

create table if not exists public.office_chat_attachment_events(
 id bigint generated always as identity primary key,
 attachment_id uuid not null references public.office_chat_attachment_objects(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null check(event_type in (
  'QUARANTINED','SCAN_CLEAN','SCAN_BLOCKED','SCAN_UNKNOWN','LINKED','DOWNLOADED'
 )),
 occurred_at timestamptz not null default now()
);
create index if not exists office_chat_attachment_events_idx
 on public.office_chat_attachment_events(attachment_id,occurred_at);
alter table public.office_chat_attachment_objects enable row level security;
alter table public.office_chat_attachment_events enable row level security;
revoke all on public.office_chat_attachment_objects,public.office_chat_attachment_events
 from public,anon,authenticated;
grant select,insert,update on public.office_chat_attachment_objects to service_role;
grant select,insert on public.office_chat_attachment_events to service_role;
grant usage,select on sequence public.office_chat_attachment_events_id_seq to service_role;

create or replace function public.office_chat_send_attachment_message(
 p_actor uuid,p_conversation uuid,p_nonce uuid,p_body text,p_mentions uuid[],p_attachments uuid[]
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_message uuid;v_row public.office_chat_attachment_objects%rowtype;
 v_total integer;v_distinct integer;
begin
 if p_attachments is null then p_attachments:=array[]::uuid[]; end if;
 v_total:=coalesce(array_length(p_attachments,1),0);
 if v_total<1 or v_total>5 or array_position(p_attachments,null) is not null
 then raise exception 'One to five clean attachments are required'; end if;
 select count(distinct item.id) into v_distinct from unnest(p_attachments) as item(id);
 if v_distinct<>v_total then raise exception 'Duplicate attachment references'; end if;
 -- Fail before sending the associated message; then lock all attachments
 -- so concurrent sends cannot link the same file to different messages.
 for v_row in select * from public.office_chat_attachment_objects
   where id=any(p_attachments) for update
 loop
   if v_row.uploader_user_id<>p_actor or v_row.conversation_id<>p_conversation
    or v_row.status<>'CLEAN' or v_row.message_id is not null
   then
     raise exception 'Attachment is not clean, unlinked and owned in this conversation';
   end if;
 end loop;
 if (select count(*) from public.office_chat_attachment_objects
     where id=any(p_attachments))<>v_total then raise exception 'Some attachments are unavailable'; end if;
 v_message:=public.office_chat_send_with_mentions(
   p_actor,p_conversation,p_nonce,p_body,coalesce(p_mentions,array[]::uuid[])
 );
 update public.office_chat_attachment_objects set message_id=v_message,linked_at=now()
 where id=any(p_attachments);
 insert into public.office_chat_attachment_events(attachment_id,actor_user_id,event_type)
 select item.id,p_actor,'LINKED' from unnest(p_attachments) as item(id);
 return v_message;
end; $$;
revoke all on function public.office_chat_send_attachment_message(uuid,uuid,uuid,text,uuid[],uuid[])
 from public,anon,authenticated;
grant execute on function public.office_chat_send_attachment_message(uuid,uuid,uuid,text,uuid[],uuid[])
 to service_role;
comment on table public.office_chat_attachment_objects is
 'Office-only message evidence, never released while scan unknown or absent. Quarantine is private; no public object URLs.';
