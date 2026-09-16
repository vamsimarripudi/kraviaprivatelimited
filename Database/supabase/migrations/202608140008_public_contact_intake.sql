-- Public enquiries are inserted only by the server-controlled route. No browser read policy exists.
create table public.contact_enquiries (
  id uuid primary key default gen_random_uuid(), reference text not null unique, category text not null,
  name text not null, email text not null, organisation text, message text not null,
  privacy_acknowledged_at timestamptz not null, purpose text not null default 'RESPOND_TO_ENQUIRY',
  retention_review_at date, status text not null default 'RECEIVED', assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index contact_enquiries_status_idx on public.contact_enquiries(status, created_at desc);
alter table public.contact_enquiries enable row level security;
-- Deliberately deny by default: public visitors submit through a validated server route, never direct table access.
