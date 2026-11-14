-- KRAVIA Office 5.0: signed-in employee-only private chat media and personal templates.
-- Additive only. No employee communications, messages, approvals or public buckets.
-- Apply AFTER 20261114150017. New functionality remains unavailable until migration reviewed.
alter table public.office_chat_attachment_objects
  drop constraint if exists office_chat_attachment_objects_detected_mime_type_check;
alter table public.office_chat_attachment_objects
  add constraint office_chat_attachment_objects_detected_mime_type_check
  check (detected_mime_type in (
    'application/pdf','image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ));

update storage.buckets set
 public=false,
 file_size_limit=10485760,
 allowed_mime_types=array[
   'application/pdf','image/jpeg','image/png','image/webp','image/gif',
   'video/mp4','video/webm','text/plain',
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
 ]::text[]
where id='office-chat-attachments' and public=false;

create table if not exists public.office_chat_personal_templates (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 title varchar(60) not null check (char_length(trim(title)) between 1 and 60),
 body text not null check (char_length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (owner_user_id,title)
);
create index if not exists office_chat_personal_templates_owner_idx
 on public.office_chat_personal_templates(owner_user_id,updated_at desc);
alter table public.office_chat_personal_templates enable row level security;
revoke all on public.office_chat_personal_templates from public,anon,authenticated;
grant select,insert,update,delete on public.office_chat_personal_templates to service_role;

comment on table public.office_chat_personal_templates is
 'Private per-employee reusable chat composer text; never an authorization grant, company policy, or external communication.';
