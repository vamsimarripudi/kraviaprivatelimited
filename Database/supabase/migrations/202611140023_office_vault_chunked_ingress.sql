-- KRAVIA K-Vault: private, encrypted chunk staging for 10 MiB uploads.
-- Every HTTP part is 1 MiB or less; nothing is stored in plaintext.
-- Apply only in isolated rehearsals until a separately approved production release.
create table if not exists public.office_vault_secret_ingress_sessions(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 document_id uuid not null,
 version_id uuid not null unique,
 title text not null check(length(trim(title)) between 3 and 180),
 classification text not null check(classification in
  ('CONFIDENTIAL','RESTRICTED','BOARD','FINANCE','HR','LEGAL','SECURITY')),
 filename text not null check(length(trim(filename)) between 1 and 180),
 declared_mime text not null check(length(trim(declared_mime)) between 1 and 150),
 total_bytes bigint not null check(total_bytes between 1 and 10485760),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 part_size integer not null default 1048576 check(part_size=1048576),
 part_count integer not null check(part_count between 1 and 10),
 state text not null default 'OPEN' check(state in ('OPEN','FINALIZING','DONE','ABORTED')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint vault_ingress_count_matches_size
  check(part_count=((total_bytes+1048575)/1048576)),
 constraint vault_ingress_expiration_limited
  check(expires_at>created_at and expires_at<=created_at+interval '2 hours')
);
create index if not exists office_vault_secret_ingress_owner_idx
 on public.office_vault_secret_ingress_sessions(owner_user_id,state,expires_at);

create table if not exists public.office_vault_secret_ingress_parts(
 session_id uuid not null references public.office_vault_secret_ingress_sessions(id) on delete cascade,
 part_index integer not null check(part_index between 0 and 9),
 part_id uuid not null unique,
 byte_size integer not null check(byte_size between 1 and 1048576),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 sealed_path text not null unique,
 key_id text not null check(length(key_id) between 1 and 60),
 wrapped_key text not null check(length(wrapped_key) between 32 and 200),
 wrap_nonce text not null check(wrap_nonce ~ '^[a-f0-9]{24}$'),
 wrap_tag text not null check(wrap_tag ~ '^[a-f0-9]{32}$'),
 content_nonce text not null check(content_nonce ~ '^[a-f0-9]{24}$'),
 content_tag text not null check(content_tag ~ '^[a-f0-9]{32}$'),
 state text not null default 'PENDING' check(state in ('PENDING','READY')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(session_id,part_index)
);

-- Browser roles can neither enumerate sealed chunk metadata nor use any
-- ingestion staging table directly, even if Data API is enabled.
alter table public.office_vault_secret_ingress_sessions enable row level security;
alter table public.office_vault_secret_ingress_parts enable row level security;
revoke all on public.office_vault_secret_ingress_sessions,
 public.office_vault_secret_ingress_parts from public,anon,authenticated;
grant select,insert,update,delete on public.office_vault_secret_ingress_sessions,
 public.office_vault_secret_ingress_parts to service_role;

-- Immutable scope: never change who owns a staging session or what file was
-- authorized by the upload initiator. Only state and updated_at may change.
create or replace function public.office_vault_secret_ingress_scope_guard()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if row(new.owner_user_id,new.document_id,new.version_id,new.title,
  new.classification,new.filename,new.declared_mime,new.total_bytes,
  new.sha256,new.part_size,new.part_count,new.expires_at,new.created_at)
  is distinct from row(old.owner_user_id,old.document_id,old.version_id,old.title,
  old.classification,old.filename,old.declared_mime,old.total_bytes,
  old.sha256,old.part_size,old.part_count,old.expires_at,old.created_at)
 then raise exception 'Sealed ingress scope cannot be changed'; end if;
 if old.state='DONE' or old.state='ABORTED' then
  if new.state<>old.state then raise exception 'Completed ingress is immutable'; end if;
 end if;
 if old.state='OPEN' and new.state not in ('OPEN','FINALIZING','ABORTED')
  or old.state='FINALIZING' and new.state not in ('OPEN','FINALIZING','DONE')
    and not(new.state='ABORTED' and old.expires_at<=now())
 then raise exception 'Invalid sealed ingress transition'; end if;
 return new;
end; $$;
revoke all on function public.office_vault_secret_ingress_scope_guard() from public,anon,authenticated;
grant execute on function public.office_vault_secret_ingress_scope_guard() to service_role;
drop trigger if exists office_vault_secret_ingress_scope_guard
 on public.office_vault_secret_ingress_sessions;
create trigger office_vault_secret_ingress_scope_guard before update
 on public.office_vault_secret_ingress_sessions for each row
 execute function public.office_vault_secret_ingress_scope_guard();

-- Chunk index, bytes and wrapped key are immutable after the first insert.
-- This prevents one writer from swapping encrypted storage under another.
create or replace function public.office_vault_secret_ingress_part_guard()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.office_vault_secret_ingress_sessions s
   where s.id=new.session_id and s.state='OPEN' and s.expires_at>now())
 then raise exception 'Upload session is not open for parts'; end if;
 if tg_op='INSERT' then return new; end if;
 if row(new.session_id,new.part_index,new.part_id,new.byte_size,
  new.sha256,new.sealed_path,new.key_id,new.wrapped_key,new.wrap_nonce,
  new.wrap_tag,new.content_nonce,new.content_tag,new.created_at)
  is distinct from row(old.session_id,old.part_index,old.part_id,old.byte_size,
  old.sha256,old.sealed_path,old.key_id,old.wrapped_key,old.wrap_nonce,
  old.wrap_tag,old.content_nonce,old.content_tag,old.created_at)
 then raise exception 'Encrypted ingress part evidence is immutable'; end if;
 if old.state='READY' and new.state<>'READY' then
  raise exception 'Ready encrypted ingress part is immutable'; end if;
 return new;
end; $$;
revoke all on function public.office_vault_secret_ingress_part_guard() from public,anon,authenticated;
grant execute on function public.office_vault_secret_ingress_part_guard() to service_role;
drop trigger if exists office_vault_secret_ingress_part_guard
 on public.office_vault_secret_ingress_parts;
create trigger office_vault_secret_ingress_part_guard before insert or update
 on public.office_vault_secret_ingress_parts for each row
 execute function public.office_vault_secret_ingress_part_guard();
