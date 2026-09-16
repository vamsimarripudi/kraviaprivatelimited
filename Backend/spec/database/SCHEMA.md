# KRAVIA Office production data model

## Storage principles
1. Monetary values use integer minor units (paise/cents), never binary floating point.
2. Issued financial documents are immutable snapshots.
3. Legal entity, product, customer, tax and price master data is effective-dated.
4. Audit events are append-only and stored separately from mutable operational rows.
5. External provider IDs are unique per provider and event type.
6. Idempotency is a database concern, not only an HTTP concern.
7. Every material posting carries a `source_event_id`, `correlation_id`, and `source_document_id` where applicable.
8. Accounting and tax close periods are explicit control records; postings cannot bypass active locks.

## Core domains
- Identity/Access: users, memberships, roles, grants, sessions, MFA factors, access reviews.
- Company: legal_entities, registrations, addresses, directors, members, bank_accounts, authorities.
- Products: products, country_packs, plans, prices, tax_mappings, entitlements, usage_metrics.
- Customers: customers, billing_profiles, contacts, product_accounts.
- Commercial: orders, subscriptions, subscription_items, usage_records, discounts.
- Billing: invoice_sequences, invoices, invoice_lines, credit_notes, debit_notes, receipts.
- Payments: payment_attempts, payments, refunds, settlements, bank_transactions, reconciliations.
- Accounting: chart_of_accounts, journals, journal_lines, accounting_period_locks, allocations, assets.
- Tax: tax_rules, tax_calculations, gst_periods, gst_reconciliation_items, tax_filings; `TAX`/`BOTH` period locks prevent statutory-document posting into closed periods.
- Governance: board_meetings, agenda_items, minutes_versions, resolutions, ctc_issues, authorities.
- Compliance: obligations, cases, notices, filings, evidence_links.
- Contracts: contracts, versions, obligations, renewals, counterparties.
- Vendors: vendors, vendor_invoices, purchase_orders, receipts, payment_approvals.
- Documents: documents, versions, hashes, signatures, retention_rules, legal_holds.
- Workflow: event_outbox, event_inbox, workflow_definitions, workflow_runs, workflow_steps, dead_letters.
- Audit: audit_events, disclosure_events, inspection_rooms, inspection_pack_items.

## Period-close control

`accounting_period_locks` stores the legal entity, inclusive date range, control scope (`ACCOUNTING`, `TAX`, or `BOTH`), status, reason, maker identity and reopen approval reference. New accounting postings are rejected when an active accounting lock covers the posting date; invoices/credit notes are also rejected when a tax lock covers that date. Reopening requires an approved `ACCOUNTING_PERIOD_UNLOCK` maker-checker request and produces audit/domain events.

## Hard constraints
- `invoices.invoice_no` unique per legal entity and financial year sequence.
- no UPDATE/DELETE application route for issued invoices; financial correction uses credit/debit/reversal.
- `payments(provider, provider_payment_id)` unique when provider IDs exist.
- `event_inbox(producer,event_id)` unique.
- `idempotency_records(scope,key)` unique.
- signed document versions are immutable and content-hashed.
- `authorities` must reference the source resolution/policy/delegation.
- active accounting/tax period locks block affected financial postings.
- reopening a closed period requires independent approval; the requester cannot approve the request.
