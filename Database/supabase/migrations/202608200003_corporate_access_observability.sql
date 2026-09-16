-- Corporate Office activity ledger. It records authenticated internal use only;
-- it is not public-website visitor surveillance.
create table public.corporate_access_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('SIGNED_IN','PAGE_VIEWED')),
  path text,
  created_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  check ((event_type = 'SIGNED_IN' and path is null) or (event_type = 'PAGE_VIEWED' and path like '/corporate/%'))
);
create index corporate_access_events_actor_created_idx on public.corporate_access_events(actor_id, created_at desc);
create index corporate_access_events_created_idx on public.corporate_access_events(created_at desc);

alter table public.corporate_access_events enable row level security;
create policy "corporate activity actor insert" on public.corporate_access_events for insert to authenticated
  with check (actor_id = auth.uid() and public.is_active_corporate_member());
create policy "corporate activity administrators read" on public.corporate_access_events for select to authenticated
  using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
grant select, insert on public.corporate_access_events to authenticated;
