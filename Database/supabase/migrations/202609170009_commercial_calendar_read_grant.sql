-- Company calendar projects subscription period-end dates through the server-only
-- Office service client. Grant read-only access; billing mutations remain owned
-- by the commercial/backend execution path.

grant select on public.subscriptions to service_role;
