-- Auditable website privacy preferences. Browser visitors only receive a
-- non-identifying cookie; the pseudonymous preference record is written by a
-- server-controlled route with a keyed fingerprint and is not publicly readable.

create table public.web_privacy_preferences (
  id uuid primary key default gen_random_uuid(),
  preference_version text not null check (preference_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  fingerprint_hash text not null check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  optional_analytics boolean not null default false,
  global_privacy_control boolean not null default false,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (preference_version, fingerprint_hash)
);

create table public.web_privacy_preference_events (
  id uuid primary key default gen_random_uuid(),
  preference_id uuid not null references public.web_privacy_preferences(id) on delete restrict,
  preference_version text not null check (preference_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  decision text not null check (decision in ('OPTIONAL_ACCEPTED','OPTIONAL_REJECTED','PREFERENCE_WITHDRAWN')),
  optional_analytics boolean not null,
  global_privacy_control boolean not null default false,
  recorded_at timestamptz not null default now()
);

create index web_privacy_preference_events_preference_idx
  on public.web_privacy_preference_events(preference_id, recorded_at desc);

alter table public.web_privacy_preferences enable row level security;
alter table public.web_privacy_preference_events enable row level security;
revoke all on public.web_privacy_preferences, public.web_privacy_preference_events from public, anon, authenticated;
grant select, insert, update on public.web_privacy_preferences to service_role;
grant select, insert on public.web_privacy_preference_events to service_role;

create or replace function public.record_web_privacy_preference(
  p_fingerprint_hash text,
  p_preference_version text,
  p_optional_analytics boolean,
  p_global_privacy_control boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preference_id uuid;
  v_prior_optional boolean;
  v_decision text;
begin
  if p_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid privacy preference fingerprint';
  end if;
  if p_preference_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid privacy preference version';
  end if;
  if p_global_privacy_control and p_optional_analytics then
    raise exception 'Global Privacy Control cannot enable optional analytics';
  end if;

  select optional_analytics into v_prior_optional
  from public.web_privacy_preferences
  where preference_version = p_preference_version and fingerprint_hash = p_fingerprint_hash
  for update;

  insert into public.web_privacy_preferences(
    preference_version, fingerprint_hash, optional_analytics, global_privacy_control, selected_at, updated_at
  ) values (
    p_preference_version, p_fingerprint_hash, p_optional_analytics, p_global_privacy_control, now(), now()
  )
  on conflict (preference_version, fingerprint_hash) do update set
    optional_analytics = excluded.optional_analytics,
    global_privacy_control = excluded.global_privacy_control,
    selected_at = now(),
    updated_at = now()
  returning id into v_preference_id;

  v_decision := case
    when p_optional_analytics then 'OPTIONAL_ACCEPTED'
    when coalesce(v_prior_optional, false) then 'PREFERENCE_WITHDRAWN'
    else 'OPTIONAL_REJECTED'
  end;
  insert into public.web_privacy_preference_events(
    preference_id, preference_version, decision, optional_analytics, global_privacy_control
  ) values (
    v_preference_id, p_preference_version, v_decision, p_optional_analytics, p_global_privacy_control
  );
  return v_preference_id;
end;
$$;

revoke all on function public.record_web_privacy_preference(text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.record_web_privacy_preference(text,text,boolean,boolean) to service_role;
