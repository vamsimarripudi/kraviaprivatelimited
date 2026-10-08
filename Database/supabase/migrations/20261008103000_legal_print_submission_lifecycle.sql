-- A browser can prove that its native print dialog closed; it cannot prove that
-- physical paper was produced. Preserve that distinction in the audit model.
begin;

alter table public.legal_print_jobs
  add column if not exists submitted_at timestamptz;

alter table public.legal_print_jobs
  drop constraint if exists legal_print_jobs_status_check,
  drop constraint if exists legal_print_jobs_check,
  add constraint legal_print_jobs_status_valid
    check (status in ('RESERVED', 'PRINTED', 'PRINT_SUBMITTED')),
  add constraint legal_print_jobs_submission_shape
    check (
      (status = 'RESERVED' and printed_at is null and submitted_at is null)
      or (status = 'PRINTED' and printed_at is not null)
      or (status = 'PRINT_SUBMITTED' and printed_at is null and submitted_at is not null)
    );

alter table public.legal_print_attempts
  drop constraint if exists legal_print_attempts_event_check,
  add constraint legal_print_attempts_event_valid
    check (event in (
      'RESERVED',
      'RESERVATION_REUSED',
      'RETRY_REQUESTED',
      'PRINTED_CONFIRMED',
      'DIALOG_OPENED',
      'PRINT_SUBMITTED'
    ));

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
  if old.status in ('PRINTED', 'PRINT_SUBMITTED') then
    raise exception 'Completed legal print references are immutable';
  end if;
  if new.status not in ('RESERVED', 'PRINTED', 'PRINT_SUBMITTED') then
    raise exception 'Invalid legal print status';
  end if;
  return new;
end;
$$;

create or replace function public.record_legal_print_event(
  p_job_id uuid,
  p_reservation_token_hash text,
  p_event text
) returns table(status text, reference_no text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_job public.legal_print_jobs%rowtype;
begin
  if p_reservation_token_hash !~ '^[0-9a-f]{64}$'
    or p_event not in ('DIALOG_OPENED', 'DIALOG_CLOSED') then
    raise exception 'Invalid legal print event';
  end if;

  select * into v_job from public.legal_print_jobs
    where id = p_job_id and reservation_token_hash = p_reservation_token_hash
    for update;
  if not found then return; end if;

  if p_event = 'DIALOG_OPENED' and v_job.status = 'RESERVED' then
    insert into public.legal_print_attempts(job_id, event) values (v_job.id, 'DIALOG_OPENED');
  elsif p_event = 'DIALOG_CLOSED' and v_job.status = 'RESERVED' then
    update public.legal_print_jobs
      set status = 'PRINT_SUBMITTED', submitted_at = now(), updated_at = now()
      where id = v_job.id
      returning * into v_job;
    insert into public.legal_print_attempts(job_id, event) values (v_job.id, 'PRINT_SUBMITTED');
  end if;

  return query select v_job.status, v_job.reference_no;
end;
$$;

revoke all on function public.record_legal_print_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_legal_print_event(uuid, text, text) to service_role;

-- Retain the historical function for audit reconstruction, but remove the
-- server role's ability to create a user-asserted physical-print outcome.
revoke all on function public.confirm_legal_print_job(uuid, text, boolean) from service_role;

commit;
