-- Website privacy-preference persistence for the isolated Neon project.
-- No browser, Data API, or Office credential can access this schema. The
-- website route holds the pooled application credential; migrations use a
-- direct connection and are versioned here rather than in the Office database.

begin;

create extension if not exists pgcrypto;
create schema if not exists website_privacy;
revoke all on schema website_privacy from public;

create table website_privacy.preferences (
  id uuid primary key default gen_random_uuid(),
  preference_version text not null check (preference_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  fingerprint_hash text not null check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  optional_analytics boolean not null default false,
  global_privacy_control boolean not null default false,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preference_version, fingerprint_hash),
  check (not (global_privacy_control and optional_analytics))
);

create table website_privacy.preference_events (
  id uuid primary key default gen_random_uuid(),
  preference_id uuid not null references website_privacy.preferences(id) on delete restrict,
  preference_version text not null check (preference_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  decision text not null check (decision in ('OPTIONAL_ACCEPTED', 'OPTIONAL_REJECTED', 'PREFERENCE_WITHDRAWN')),
  optional_analytics boolean not null,
  global_privacy_control boolean not null default false,
  recorded_at timestamptz not null default now(),
  check (not (global_privacy_control and optional_analytics))
);

create index preference_events_preference_idx
  on website_privacy.preference_events(preference_id, recorded_at desc);

-- A bounded, per-pseudonymous-visitor mutation quota. Upsert is intentionally
-- atomic so concurrent requests cannot bypass the configured cap.
create table website_privacy.rate_windows (
  scope text not null check (scope = 'WEBSITE_PRIVACY_PREFERENCE'),
  fingerprint_hash text not null check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  window_started timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, fingerprint_hash)
);

revoke all on all tables in schema website_privacy from public;

create or replace function website_privacy.record_preference(
  p_fingerprint_hash text,
  p_preference_version text,
  p_optional_analytics boolean,
  p_global_privacy_control boolean,
  p_rate_fingerprint_hash text,
  p_rate_limit integer,
  p_rate_window_seconds integer
) returns uuid
language plpgsql
security invoker
set search_path = website_privacy, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_cutoff timestamptz;
  v_rate_count integer;
  v_preference_id uuid;
  v_prior_optional boolean;
  v_decision text;
begin
  if p_fingerprint_hash !~ '^[a-f0-9]{64}$' or p_rate_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid privacy preference fingerprint';
  end if;
  if p_preference_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid privacy preference version';
  end if;
  if p_global_privacy_control and p_optional_analytics then
    raise exception 'Global Privacy Control cannot enable optional analytics';
  end if;
  if p_rate_limit < 1 or p_rate_limit > 100 or p_rate_window_seconds < 60 or p_rate_window_seconds > 86400 then
    raise exception 'Invalid privacy preference rate limit';
  end if;

  v_window_cutoff := v_now - make_interval(secs => p_rate_window_seconds);
  insert into website_privacy.rate_windows as rate_window (scope, fingerprint_hash, window_started, request_count)
  values ('WEBSITE_PRIVACY_PREFERENCE', p_rate_fingerprint_hash, v_now, 1)
  on conflict (scope, fingerprint_hash) do update set
    window_started = case when rate_window.window_started <= v_window_cutoff then v_now else rate_window.window_started end,
    request_count = case when rate_window.window_started <= v_window_cutoff then 1 else rate_window.request_count + 1 end
  where rate_window.window_started <= v_window_cutoff or rate_window.request_count < p_rate_limit
  returning request_count into v_rate_count;

  if not found then
    return null;
  end if;

  -- Looping handles a concurrent first write without losing the prior decision
  -- needed for a truthful immutable event label.
  loop
    select optional_analytics into v_prior_optional
    from website_privacy.preferences
    where preference_version = p_preference_version and fingerprint_hash = p_fingerprint_hash
    for update;

    if found then
      update website_privacy.preferences
      set optional_analytics = p_optional_analytics,
          global_privacy_control = p_global_privacy_control,
          selected_at = v_now,
          updated_at = v_now
      where preference_version = p_preference_version and fingerprint_hash = p_fingerprint_hash
      returning id into v_preference_id;
      exit;
    end if;

    insert into website_privacy.preferences (
      preference_version, fingerprint_hash, optional_analytics, global_privacy_control, selected_at, updated_at
    ) values (
      p_preference_version, p_fingerprint_hash, p_optional_analytics, p_global_privacy_control, v_now, v_now
    ) on conflict (preference_version, fingerprint_hash) do nothing
    returning id into v_preference_id;

    if found then
      v_prior_optional := null;
      exit;
    end if;
  end loop;

  v_decision := case
    when p_optional_analytics then 'OPTIONAL_ACCEPTED'
    when coalesce(v_prior_optional, false) then 'PREFERENCE_WITHDRAWN'
    else 'OPTIONAL_REJECTED'
  end;

  insert into website_privacy.preference_events (
    preference_id, preference_version, decision, optional_analytics, global_privacy_control
  ) values (
    v_preference_id, p_preference_version, v_decision, p_optional_analytics, p_global_privacy_control
  );

  return v_preference_id;
end;
$$;

revoke all on function website_privacy.record_preference(text, text, boolean, boolean, text, integer, integer) from public;

commit;
