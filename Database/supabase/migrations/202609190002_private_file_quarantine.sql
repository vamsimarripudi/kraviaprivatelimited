-- Private KRAVIA Office file quarantine and malware-scan control plane.
-- All inbound files are private, quarantined, scanned, then promoted to an
-- existing purpose-specific private bucket. No browser/client storage policy is
-- created; first-party backend/service credentials own the object lifecycle.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'office-quarantine',
  'office-quarantine',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Existing final buckets stay private. These updates deliberately do not add
-- client-side storage policies.
update storage.buckets set public=false where id in (
  'corporate-private','office-documents','office-candidate-documents'
);

create table if not exists public.office_file_objects(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
  purpose text not null check(purpose in ('CORPORATE','DOCUMENT','CANDIDATE')),
  context_type text,
  context_id text,
  original_filename text not null check(char_length(original_filename) between 1 and 255),
  declared_mime_type text,
  detected_mime_type text not null,
  byte_size bigint not null check(byte_size > 0 and byte_size <= 52428800),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  quarantine_bucket text not null default 'office-quarantine',
  quarantine_path text not null unique,
  target_bucket text not null,
  released_path text,
  status text not null default 'QUARANTINED'
    check(status in ('UPLOADING','QUARANTINED','SCANNING','CLEAN','INFECTED','FAILED','DELETED')),
  scan_engine text,
  scan_engine_version text,
  threat_name text,
  scan_attempts integer not null default 0 check(scan_attempts >= 0),
  next_scan_at timestamptz,
  scanned_at timestamptz,
  quarantine_deleted_at timestamptz,
  released_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(
    (status='CLEAN' and released_path is not null and released_at is not null)
    or status<>'CLEAN'
  )
);
create index if not exists office_file_objects_scan_queue_idx
  on public.office_file_objects(status,coalesce(next_scan_at,created_at),created_at);
create index if not exists office_file_objects_owner_idx
  on public.office_file_objects(owner_user_id,created_at desc);
create index if not exists office_file_objects_sha_idx
  on public.office_file_objects(sha256);

create table if not exists public.office_file_scan_events(
  id bigint generated always as identity primary key,
  file_id uuid not null references public.office_file_objects(id) on delete cascade,
  event_type text not null,
  engine text,
  engine_version text,
  result text,
  threat_name text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists office_file_scan_events_file_idx
  on public.office_file_scan_events(file_id,created_at desc);

alter table public.office_file_objects enable row level security;
alter table public.office_file_scan_events enable row level security;
revoke all on public.office_file_objects,public.office_file_scan_events from anon,authenticated;

do $$
begin
  if exists(select 1 from pg_roles where rolname='kravia_office_backend') then
    grant select,insert,update,delete on public.office_file_objects to kravia_office_backend;
    grant select,insert on public.office_file_scan_events to kravia_office_backend;
    grant usage,select on sequence public.office_file_scan_events_id_seq to kravia_office_backend;
  end if;
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant select on public.office_file_objects,public.office_file_scan_events to service_role;
  end if;
end
$$;

comment on table public.office_file_objects is
  'KRAVIA-owned metadata for private inbound files. Objects remain unusable until malware scan status is CLEAN.';
comment on column public.office_file_objects.quarantine_path is
  'Historical private quarantine object path; the object is deleted after CLEAN or INFECTED terminal processing.';
