-- KRAVIA Office performance indexes for the canonical API read paths.
-- These indexes match current ORDER BY / WHERE clauses and keep bounded REST
-- collections fast as company data grows.

create index if not exists ix_customers_created_at_desc
  on public.customers (created_at desc);

create index if not exists ix_invoices_issued_at_desc
  on public.invoices (issued_at desc);

create index if not exists ix_invoices_status_issued_at_desc
  on public.invoices (status, issued_at desc);

create index if not exists ix_compliance_obligations_created_at_desc
  on public.compliance_obligations (created_at desc);

create index if not exists ix_board_meetings_meeting_date_desc
  on public.board_meetings (meeting_date desc);

create index if not exists ix_resolutions_created_at_desc
  on public.resolutions (created_at desc);

create index if not exists ix_vendors_created_at_desc
  on public.vendors (created_at desc);

create index if not exists ix_contracts_created_at_desc
  on public.contracts (created_at desc);

create index if not exists ix_employees_created_at_desc
  on public.employees (created_at desc);

create index if not exists ix_office_assets_created_at_desc
  on public.office_assets (created_at desc);

create index if not exists ix_documents_created_at_desc
  on public.documents (created_at desc);

create index if not exists ix_commercial_plans_created_at_desc
  on public.commercial_plans (created_at desc);

create index if not exists ix_subscriptions_created_at_desc
  on public.subscriptions (created_at desc);

create index if not exists ix_credit_notes_issued_at_desc
  on public.credit_notes (issued_at desc);

create index if not exists ix_refunds_created_at_desc
  on public.refunds (created_at desc);

create index if not exists ix_bank_accounts_created_at_desc
  on public.bank_accounts (created_at desc);

create index if not exists ix_bank_transactions_created_at_desc
  on public.bank_transactions (created_at desc);

create index if not exists ix_bank_transactions_match_created_at_desc
  on public.bank_transactions (match_status, created_at desc);

create index if not exists ix_approval_requests_status_created_at_desc
  on public.approval_requests (status, created_at desc);

create index if not exists ix_notice_cases_status_created_at_desc
  on public.notice_cases (status, created_at desc);

create index if not exists ix_inspection_cases_created_at_desc
  on public.inspection_cases (created_at desc);

create index if not exists ix_office_domain_events_status_created_at_desc
  on public.office_domain_events (status, created_at desc);
