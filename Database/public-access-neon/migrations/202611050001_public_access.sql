-- KRAVIA website visitor identity / resource library / opt-in newsletter store
-- Must be applied ONLY to the dedicated kravia-public-access Neon project, never Office or website-privacy.
-- Protected service-side credential only; no anonymous grants or Data API.
begin;
create extension if not exists pgcrypto;

create schema if not exists public_access;

revoke all on schema public_access from public;

create table if not exists public_access.accounts(
 id uuid primary key default gen_random_uuid(),
 email text not null unique check (email = lower(email) and length(email) between 6 and 254),
 display_name text not null check (length(display_name) between 2 and 120),
 status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','DELETED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public_access.email_challenges(
 id uuid primary key,
 email text not null check (email = lower(email) and length(email) between 6 and 254),
 display_name text not null check (length(display_name) between 2 and 120),
 code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
 marketing_requested boolean not null default false,
 requested_resource text,
 attempt_count integer not null default 0 check (attempt_count between 0 and 5),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);

create index if not exists public_challenges_email_idx on public_access.email_challenges(email,created_at desc);

create table if not exists public_access.request_windows(
 fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
 window_started timestamptz not null default now(),
 request_count integer not null default 1 check (request_count > 0)
);

create table if not exists public_access.sessions(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 account_id uuid not null references public_access.accounts(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz
);

create index if not exists public_sessions_user_idx on public_access.sessions(account_id, expires_at desc);

create table if not exists public_access.newsletters(
 account_id uuid primary key references public_access.accounts(id) on delete cascade,
 status text not null check (status in ('PENDING','ACTIVE','UNSUBSCRIBED')),
 consent_version text not null,
 consent_source text not null,
 requested_at timestamptz not null default now(),
 confirmed_at timestamptz,
 unsubscribed_at timestamptz,
 confirm_token_hash text unique check (confirm_token_hash ~ '^[a-f0-9]{64}$'),
 confirm_expires_at timestamptz,
 unsubscribe_token_hash text not null unique check (unsubscribe_token_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists public_access.newsletter_events(
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public_access.accounts(id) on delete cascade,
 event text not null check (event in ('CONSENT_REQUESTED','SUBSCRIBED','UNSUBSCRIBED','CONSENT_RENEWED')),
 source text not null,
 consent_version text not null,
 recorded_at timestamptz not null default now()
);

create index if not exists public_newsletter_events_user_idx on public_access.newsletter_events(account_id, recorded_at desc);

create table if not exists public_access.resources(
 slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 title text not null check (length(title) between 5 and 160),
 summary text not null check (length(summary) between 10 and 1200),
 file_name text not null check (file_name ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$'),
 mime_type text not null check (mime_type in ('application/pdf','text/plain','text/csv','application/zip')),
 data bytea not null,
 byte_size integer not null check (byte_size between 1 and 2097152),
 checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','RETIRED')),
 created_by text not null,
 reviewed_by text,
 created_at timestamptz not null default now(),
 published_at timestamptz
);

create index if not exists public_resources_status_idx on public_access.resources(status, published_at desc);

create table if not exists public_access.download_events(
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public_access.accounts(id) on delete cascade,
 resource_slug text not null references public_access.resources(slug) on delete restrict,
 requested_at timestamptz not null default now()
);

create index if not exists public_download_events_user_idx on public_access.download_events(account_id,requested_at desc);

create table if not exists public_access.campaigns(
 id uuid primary key default gen_random_uuid(),
 subject text not null check(length(subject) between 5 and 180),
 body_text text not null check(length(body_text) between 20 and 15000),
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','SENDING','SENT','CANCELLED')),
 created_by text not null,
 approved_by text,
 approved_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public_access.campaign_deliveries(
 campaign_id uuid not null references public_access.campaigns(id) on delete restrict,
 account_id uuid not null references public_access.accounts(id) on delete cascade,
 state text not null default 'PENDING' check (state in ('PENDING','SUBMITTED','UNKNOWN','FAILED','SUPPRESSED')),
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 primary key(campaign_id,account_id)
);

revoke all on all tables in schema public_access from public;

create or replace function public_access.reserve_challenge(
 p_id uuid,p_email text,p_name text,p_hash text,p_marketing boolean,p_resource text,p_fingerprint text
) returns boolean language plpgsql security invoker set search_path = public_access,pg_temp as $$
declare v_count integer;
begin
 if p_fingerprint !~ '^[a-f0-9]{64}$' or p_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 insert into public_access.request_windows as rate_window(fingerprint,window_started,request_count)
 values (p_fingerprint,clock_timestamp(),1)
 on conflict (fingerprint) do update set
 window_started=case when rate_window.window_started < now()-interval '15 minutes' then now() else rate_window.window_started end,
 request_count=case when rate_window.window_started < now()-interval '15 minutes' then 1 else rate_window.request_count+1 end
 where rate_window.window_started < now()-interval '15 minutes' or rate_window.request_count < 4
 returning request_count into v_count;
 if not found then return false; end if;
 insert into public_access.email_challenges(id,email,display_name,code_hash,marketing_requested,requested_resource,expires_at)
 values(p_id,p_email,p_name,p_hash,p_marketing,p_resource,now()+interval '10 minutes');
 return true;
end;
$$;

create or replace function public_access.complete_challenge(
 p_id uuid,p_hash text,p_session_hash text,p_confirm_hash text,p_unsub_hash text,p_consent_version text
) returns table(account_id uuid,email text,display_name text,new_account boolean,newsletter_pending boolean)
language plpgsql security invoker set search_path = public_access,pg_temp as $$
declare v_challenge public_access.email_challenges%rowtype;
 v_id uuid; v_created boolean:=false; v_pending boolean:=false; v_state text;
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_session_hash !~ '^[a-f0-9]{64}$' or
 p_confirm_hash !~ '^[a-f0-9]{64}$' or p_unsub_hash !~ '^[a-f0-9]{64}$' then return; end if;
 select * into v_challenge from public_access.email_challenges where id=p_id for update;
 if not found or v_challenge.consumed_at is not null or v_challenge.expires_at < now() or v_challenge.attempt_count >= 5 then return; end if;
 update public_access.email_challenges set attempt_count=attempt_count+1 where id=p_id;
 if v_challenge.code_hash != p_hash then return; end if;
 update public_access.email_challenges set consumed_at=now() where id=p_id;
 insert into public_access.accounts(email,display_name) values(v_challenge.email,v_challenge.display_name)
 on conflict(email) do nothing returning id into v_id;
 if v_id is not null then v_created:=true;
 else select a.id into v_id from public_access.accounts a where a.email=v_challenge.email and a.status='ACTIVE'; end if;
 if v_id is null then return; end if;
 insert into public_access.sessions(token_hash,account_id,expires_at)
 values(p_session_hash,v_id,now()+interval '30 days');
 if v_challenge.marketing_requested then
  insert into public_access.newsletters(account_id,status,consent_version,consent_source,confirm_token_hash,confirm_expires_at,unsubscribe_token_hash)
  values(v_id,'PENDING',p_consent_version,'PUBLIC_ACCOUNT_FORM',p_confirm_hash,now()+interval '48 hours',p_unsub_hash)
  on conflict(account_id) do update set status='PENDING',consent_version=excluded.consent_version,
   consent_source=excluded.consent_source,requested_at=now(),confirm_token_hash=excluded.confirm_token_hash,
   confirm_expires_at=excluded.confirm_expires_at,unsubscribe_token_hash=excluded.unsubscribe_token_hash,
   unsubscribed_at=null where public_access.newsletters.status <> 'ACTIVE';
  select n.status into v_state from public_access.newsletters n where n.account_id=v_id;
  v_pending:=v_state='PENDING';
  if v_pending then insert into public_access.newsletter_events(account_id,event,source,consent_version)
   values(v_id,'CONSENT_REQUESTED','PUBLIC_ACCOUNT_FORM',p_consent_version); end if;
 end if;
 return query select v_id,a.email,a.display_name,v_created,v_pending from public_access.accounts a where a.id=v_id;
end;
$$;

revoke all on all functions in schema public_access from public;
commit;
