# Automation engine

The automation engine receives canonical domain events and executes only safe actions: create a notification, create an assignment/evidence request, or create a data-quality finding. It cannot finalise minutes, approve filings/payments, publish disclosures, sign documents or delete records.

`corporate_events` carries a unique idempotency key, correlation ID, attempts and processing state. `automation_runs`, actions and dead letters provide an inspectable history. The protected runner endpoint requires both `CORPORATE_AUTOMATION_CRON_SECRET` and a server-only Supabase service role; without them it returns a configuration-required response.

Definitions are disabled by default. A Corporate Admin must configure and review every schedule/threshold, recipient and escalation path before enabling it.
