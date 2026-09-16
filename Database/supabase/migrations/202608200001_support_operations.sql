-- Enterprise support operations. Public users interact only through server-controlled APIs.
create type public.support_case_status as enum ('NEW','ACKNOWLEDGED','IN_PROGRESS','WAITING_FOR_CUSTOMER','RESOLVED','CLOSED');
create type public.support_case_priority as enum ('LOW','NORMAL','HIGH','URGENT');
create type public.support_update_author as enum ('REQUESTER','KRAVIA');

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^KRV-SUP-[A-Z0-9]{8}$'),
  tracking_secret_hash text not null check (char_length(tracking_secret_hash) = 64),
  requester_name text not null check (char_length(requester_name) between 2 and 120),
  requester_email text not null check (char_length(requester_email) <= 254),
  organisation text,
  category text not null check (char_length(category) between 2 and 80),
  subject text not null check (char_length(subject) between 4 and 180),
  description text not null check (char_length(description) between 10 and 8000),
  status public.support_case_status not null default 'NEW',
  priority public.support_case_priority not null default 'NORMAL',
  assigned_to uuid references public.profiles(id) on delete set null,
  owner_role public.corporate_role,
  privacy_acknowledged_at timestamptz not null,
  purpose text not null default 'RESPOND_TO_SUPPORT_REQUEST',
  last_customer_visible_update_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table public.support_case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete restrict,
  author_kind public.support_update_author not null,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index support_cases_queue_idx on public.support_cases(status, priority desc, updated_at desc);
create index support_cases_assignee_idx on public.support_cases(assigned_to, status, updated_at desc);
create index support_updates_case_idx on public.support_case_updates(case_id, created_at asc);

alter table public.support_cases enable row level security;
alter table public.support_case_updates enable row level security;

create or replace function public.can_access_support() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[])
$$;
revoke all on function public.can_access_support() from public;
grant execute on function public.can_access_support() to authenticated;

create policy "support cases: authorised staff read" on public.support_cases for select to authenticated using (public.can_access_support());
create policy "support updates: authorised staff read" on public.support_case_updates for select to authenticated using (public.can_access_support());

create or replace function public.create_support_case(
  p_reference text, p_tracking_secret_hash text, p_requester_name text, p_requester_email text,
  p_organisation text, p_category text, p_subject text, p_description text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_case_id uuid;
begin
  insert into public.support_cases(reference, tracking_secret_hash, requester_name, requester_email, organisation, category, subject, description, privacy_acknowledged_at)
  values (p_reference, p_tracking_secret_hash, p_requester_name, p_requester_email, nullif(p_organisation, ''), p_category, p_subject, p_description, now())
  returning id into v_case_id;
  insert into public.support_case_updates(case_id, author_kind, body, customer_visible)
  values (v_case_id, 'KRAVIA', 'Your request has been received and is in the intake queue.', true);
  insert into public.audit_events(action, entity_type, entity_id, context)
  values ('SUPPORT_CASE_CREATED', 'support_case', v_case_id, jsonb_build_object('reference', p_reference, 'category', p_category));
  return v_case_id;
end;
$$;
revoke all on function public.create_support_case(text,text,text,text,text,text,text,text) from public;
grant execute on function public.create_support_case(text,text,text,text,text,text,text,text) to service_role;

create or replace function public.transition_support_case(p_case_id uuid, p_status public.support_case_status, p_priority public.support_case_priority, p_assigned_to uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare v_current public.support_case_status;
begin
  if not public.can_access_support() then raise exception 'Authorised support role required'; end if;
  select status into v_current from public.support_cases where id = p_case_id for update;
  if v_current is null then raise exception 'Support case not found'; end if;
  if v_current = 'CLOSED' and p_status <> 'CLOSED' then raise exception 'Closed cases require a controlled reopen workflow'; end if;
  if v_current = 'RESOLVED' and p_status not in ('RESOLVED','CLOSED') then raise exception 'Resolved cases may only be closed through this workflow'; end if;
  update public.support_cases set status = p_status, priority = p_priority, assigned_to = coalesce(p_assigned_to, assigned_to),
    resolved_at = case when p_status = 'RESOLVED' then now() else resolved_at end,
    closed_at = case when p_status = 'CLOSED' then now() else null end,
    updated_at = now(), version = version + 1
  where id = p_case_id;
  insert into public.audit_events(actor_id, action, entity_type, entity_id, context)
  values (auth.uid(), 'SUPPORT_CASE_TRANSITIONED', 'support_case', p_case_id, jsonb_build_object('from', v_current, 'to', p_status, 'priority', p_priority));
end;
$$;
revoke all on function public.transition_support_case(uuid,public.support_case_status,public.support_case_priority,uuid) from public;
grant execute on function public.transition_support_case(uuid,public.support_case_status,public.support_case_priority,uuid) to authenticated;

create or replace function public.add_support_case_update(p_case_id uuid, p_body text, p_customer_visible boolean) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_access_support() then raise exception 'Authorised support role required'; end if;
  insert into public.support_case_updates(case_id, author_kind, author_id, body, customer_visible)
  values (p_case_id, 'KRAVIA', auth.uid(), p_body, p_customer_visible) returning id into v_id;
  update public.support_cases set last_customer_visible_update_at = case when p_customer_visible then now() else last_customer_visible_update_at end, updated_at = now(), version = version + 1 where id = p_case_id;
  insert into public.audit_events(actor_id, action, entity_type, entity_id, context)
  values (auth.uid(), 'SUPPORT_CASE_UPDATED', 'support_case', p_case_id, jsonb_build_object('customer_visible', p_customer_visible));
  return v_id;
end;
$$;
revoke all on function public.add_support_case_update(uuid,text,boolean) from public;
grant execute on function public.add_support_case_update(uuid,text,boolean) to authenticated;
-- Minimal retained, pseudonymous throttling metadata for public support endpoints.
create table public.support_request_attempts (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('CREATE','TRACK')),
  fingerprint_hash text not null check (char_length(fingerprint_hash) = 64),
  attempted_at timestamptz not null default now()
);
create index support_request_attempts_window_idx on public.support_request_attempts(scope, fingerprint_hash, attempted_at desc);
alter table public.support_request_attempts enable row level security;

create or replace function public.consume_support_request_quota(p_scope text, p_fingerprint_hash text, p_limit integer default 12) returns boolean language plpgsql security definer set search_path = public as $$
declare v_attempt_count integer;
begin
  if p_scope not in ('CREATE','TRACK') or char_length(p_fingerprint_hash) <> 64 then raise exception 'Invalid support rate-limit request'; end if;
  delete from public.support_request_attempts where attempted_at < now() - interval '24 hours';
  select count(*) into v_attempt_count from public.support_request_attempts where scope = p_scope and fingerprint_hash = p_fingerprint_hash and attempted_at > now() - interval '15 minutes';
  if v_attempt_count >= greatest(1, least(p_limit, 100)) then return false; end if;
  insert into public.support_request_attempts(scope, fingerprint_hash) values (p_scope, p_fingerprint_hash);
  return true;
end;
$$;
revoke all on function public.consume_support_request_quota(text,text,integer) from public;
grant execute on function public.consume_support_request_quota(text,text,integer) to service_role;
