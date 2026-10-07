-- Public legal documents remain readable without an account.  Printing is
-- different: a server-issued reference needs an audit trail without storing a
-- person's name, email address, or printer information.
create sequence if not exists public.legal_print_reference_sequence as bigint;

create table public.legal_print_jobs (
  id uuid primary key default gen_random_uuid(),
  document_path text not null check (document_path ~ '^/legal/[a-z0-9-]+$'),
  document_title text not null check (char_length(document_title) between 1 and 240),
  document_version integer not null check (document_version > 0),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  visitor_fingerprint_hash text not null check (visitor_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  reservation_token_hash text not null check (reservation_token_hash ~ '^[0-9a-f]{64}$'),
  reference_no text not null unique check (reference_no ~ '^KRV-LGL-[0-9]{8}-[0-9]{6}$'),
  issued_on date not null,
  status text not null default 'RESERVED' check (status in ('RESERVED', 'PRINTED')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'PRINTED' and printed_at is not null) or (status = 'RESERVED' and printed_at is null))
);

create unique index legal_print_jobs_reusable_reservation_idx
  on public.legal_print_jobs(document_path, document_version, content_sha256, visitor_fingerprint_hash)
  where status = 'RESERVED';
create index legal_print_jobs_reference_idx on public.legal_print_jobs(reference_no);

create table public.legal_print_attempts (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.legal_print_jobs(id) on delete restrict,
  event text not null check (event in ('RESERVED', 'RESERVATION_REUSED', 'RETRY_REQUESTED', 'PRINTED_CONFIRMED')),
  created_at timestamptz not null default now()
);
create index legal_print_attempts_job_idx on public.legal_print_attempts(job_id, created_at);

-- Small, pseudonymous request ledger for abuse control.  It does not identify
-- a visitor and expires automatically when the function handles a later call.
create table public.legal_print_request_attempts (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);
create index legal_print_request_attempts_window_idx
  on public.legal_print_request_attempts(fingerprint_hash, attempted_at desc);

alter table public.legal_print_jobs enable row level security;
alter table public.legal_print_attempts enable row level security;
alter table public.legal_print_request_attempts enable row level security;

create or replace function public.guard_legal_print_job_transition()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id <> old.id
    or new.document_path <> old.document_path
    or new.document_title <> old.document_title
    or new.document_version <> old.document_version
    or new.content_sha256 <> old.content_sha256
    or new.visitor_fingerprint_hash <> old.visitor_fingerprint_hash
    or new.reference_no <> old.reference_no
    or new.issued_on <> old.issued_on
    or new.created_at <> old.created_at then
    raise exception 'Legal print identity fields are immutable';
  end if;
  if old.status = 'PRINTED' then
    raise exception 'Printed legal references are immutable';
  end if;
  if new.status not in ('RESERVED', 'PRINTED') then
    raise exception 'Invalid legal print status';
  end if;
  return new;
end;
$$;
create trigger legal_print_jobs_guard before update on public.legal_print_jobs
  for each row execute function public.guard_legal_print_job_transition();

create or replace function public.prevent_legal_print_attempt_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'Legal print attempts are append-only';
end;
$$;
create trigger legal_print_attempts_append_only
  before update or delete on public.legal_print_attempts
  for each row execute function public.prevent_legal_print_attempt_mutation();

create or replace function public.reserve_legal_print_job(
  p_document_path text,
  p_document_title text,
  p_document_version integer,
  p_content_sha256 text,
  p_visitor_fingerprint_hash text,
  p_reservation_token_hash text
) returns table(job_id uuid, reference_no text, issued_on date, attempt_count integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing public.legal_print_jobs%rowtype;
  v_new_job_id uuid;
  v_sequence bigint;
  v_reference text;
  v_issued_on date;
  v_rate_count integer;
begin
  if p_document_path !~ '^/legal/[a-z0-9-]+$'
    or char_length(p_document_title) not between 1 and 240
    or p_document_version <= 0
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_visitor_fingerprint_hash !~ '^[0-9a-f]{64}$'
    or p_reservation_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid legal print request';
  end if;

  delete from public.legal_print_request_attempts where attempted_at < now() - interval '24 hours';
  select count(*) into v_rate_count
    from public.legal_print_request_attempts
    where fingerprint_hash = p_visitor_fingerprint_hash and attempted_at > now() - interval '15 minutes';
  if v_rate_count >= 12 then
    raise exception 'LEGAL_PRINT_RATE_LIMIT';
  end if;
  insert into public.legal_print_request_attempts(fingerprint_hash) values (p_visitor_fingerprint_hash);

  select * into v_existing from public.legal_print_jobs
    where document_path = p_document_path
      and document_version = p_document_version
      and content_sha256 = p_content_sha256
      and visitor_fingerprint_hash = p_visitor_fingerprint_hash
      and status = 'RESERVED'
    for update;

  if found then
    update public.legal_print_jobs
      set reservation_token_hash = p_reservation_token_hash,
          attempt_count = v_existing.attempt_count + 1,
          updated_at = now()
      where id = v_existing.id
      returning * into v_existing;
    insert into public.legal_print_attempts(job_id, event) values (v_existing.id, 'RESERVATION_REUSED');
    return query select v_existing.id, v_existing.reference_no, v_existing.issued_on, v_existing.attempt_count;
    return;
  end if;

  v_sequence := nextval('public.legal_print_reference_sequence');
  v_issued_on := timezone('Asia/Kolkata', clock_timestamp())::date;
  v_reference := format('KRV-LGL-%s-%s', to_char(v_issued_on, 'YYYYMMDD'), lpad(v_sequence::text, 6, '0'));
  insert into public.legal_print_jobs(
    document_path, document_title, document_version, content_sha256,
    visitor_fingerprint_hash, reservation_token_hash, reference_no, issued_on
  ) values (
    p_document_path, p_document_title, p_document_version, p_content_sha256,
    p_visitor_fingerprint_hash, p_reservation_token_hash, v_reference, v_issued_on
  ) returning id into v_new_job_id;
  insert into public.legal_print_attempts(job_id, event) values (v_new_job_id, 'RESERVED');
  return query select v_new_job_id, v_reference, v_issued_on, 1;
end;
$$;

create or replace function public.confirm_legal_print_job(
  p_job_id uuid,
  p_reservation_token_hash text,
  p_printed boolean
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.legal_print_jobs%rowtype;
begin
  if p_reservation_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid legal print confirmation'; end if;
  select * into v_job from public.legal_print_jobs
    where id = p_job_id and reservation_token_hash = p_reservation_token_hash
    for update;
  if not found then return false; end if;
  if v_job.status = 'PRINTED' then return p_printed; end if;
  if p_printed then
    update public.legal_print_jobs set status = 'PRINTED', printed_at = now(), updated_at = now() where id = v_job.id;
    insert into public.legal_print_attempts(job_id, event) values (v_job.id, 'PRINTED_CONFIRMED');
  else
    insert into public.legal_print_attempts(job_id, event) values (v_job.id, 'RETRY_REQUESTED');
  end if;
  return true;
end;
$$;

revoke all on table public.legal_print_jobs, public.legal_print_attempts, public.legal_print_request_attempts from anon, authenticated;
revoke all on function public.reserve_legal_print_job(text,text,integer,text,text,text) from public;
revoke all on function public.confirm_legal_print_job(uuid,text,boolean) from public;
grant execute on function public.reserve_legal_print_job(text,text,integer,text,text,text) to service_role;
grant execute on function public.confirm_legal_print_job(uuid,text,boolean) to service_role;
