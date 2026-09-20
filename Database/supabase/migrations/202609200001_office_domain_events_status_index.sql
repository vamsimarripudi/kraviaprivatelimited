-- KRAVIA Office outbox fast-path index.
-- Supports status-filtered worker/API reads while the existing created_at index
-- continues to serve unfiltered reverse-chronological reads.

create index if not exists ix_office_domain_events_status_created_at_desc
  on public.office_domain_events (status, created_at desc);
