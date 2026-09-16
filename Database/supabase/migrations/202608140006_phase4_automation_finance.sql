-- Phase 4: reusable automations, operational finance evidence and launch governance.
-- No synthetic finance, filing, Board or disclosure data is seeded here.
create table public.corporate_events (
  id uuid primary key default gen_random_uuid(), event_type text not null, entity_type text not null, entity_id uuid,
  actor_id uuid references public.profiles(id) on delete set null, correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text not null unique, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(),
  processing_status text not null default 'PENDING' check (processing_status in ('PENDING','PROCESSING','COMPLETED','FAILED','DEAD_LETTER')),
  attempts integer not null default 0, locked_at timestamptz, locked_by text, last_error text
);
create index corporate_events_pending_idx on public.corporate_events(processing_status, occurred_at) where processing_status in ('PENDING','FAILED');

create table public.automation_definitions (
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null, description text not null,
  trigger_type text not null check (trigger_type in ('SCHEDULE','DOMAIN_EVENT','STATE_CHANGE','DATE_THRESHOLD','MANUAL')),
  trigger_config jsonb not null default '{}'::jsonb, conditions jsonb not null default '[]'::jsonb, actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default false, severity text check (severity in ('INFO','ACTION','URGENT')),
  requires_human_approval boolean not null default true, owner_id uuid references public.profiles(id) on delete set null,
  paused_at timestamptz, paused_by uuid references public.profiles(id) on delete set null, pause_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(), automation_id uuid not null references public.automation_definitions(id) on delete restrict,
  event_id uuid references public.corporate_events(id) on delete set null, trigger_type text not null, status text not null default 'STARTED' check (status in ('STARTED','COMPLETED','PARTIAL','FAILED','RETRYING','DEAD_LETTER')),
  idempotency_key text not null unique, started_at timestamptz not null default now(), finished_at timestamptz, retry_count integer not null default 0,
  error_reference text, outcome jsonb not null default '{}'::jsonb
);
create table public.automation_run_actions (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.automation_runs(id) on delete restrict,
  ordinal integer not null, action_type text not null, status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED','SKIPPED')),
  detail jsonb not null default '{}'::jsonb, error_reference text, created_at timestamptz not null default now(), unique(run_id, ordinal)
);
create table public.automation_dead_letters (
  id uuid primary key default gen_random_uuid(), event_id uuid references public.corporate_events(id) on delete set null,
  run_id uuid references public.automation_runs(id) on delete set null, reason text not null, resolved_at timestamptz, resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text, created_at timestamptz not null default now()
);
create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null, schedule_type text not null check (schedule_type in ('HOURLY','DAILY','WEEKLY','MONTHLY','ABSOLUTE','RELATIVE')),
  schedule_config jsonb not null default '{}'::jsonb, timezone text not null default 'Asia/Kolkata', enabled boolean not null default false,
  last_run_at timestamptz, next_run_at timestamptz, owner_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete restrict, preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete restrict,
  channel text not null check (channel in ('IN_APP','EMAIL','PUSH')), recipient_id uuid references public.profiles(id) on delete set null,
  deduplication_key text not null, status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','SUPPRESSED')),
  provider_message_id text, sent_at timestamptz, error_reference text, created_at timestamptz not null default now(), unique(deduplication_key)
);
create table public.integration_registry (
  id uuid primary key default gen_random_uuid(), provider text not null, purpose text not null, environment text not null check (environment in ('DEVELOPMENT','PREVIEW','PRODUCTION')),
  status text not null default 'CONFIGURATION_REQUIRED' check (status in ('OPERATIONAL','DEGRADED','DISCONNECTED','CONFIGURATION_REQUIRED')),
  owner_id uuid references public.profiles(id) on delete set null, credential_reference text, data_categories text[] not null default '{}', last_health_check_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider, environment)
);
create table public.webhook_inbox (
  id uuid primary key default gen_random_uuid(), provider text not null, provider_event_id text not null, event_type text not null,
  received_at timestamptz not null default now(), verified_at timestamptz, processed_at timestamptz, processing_status text not null default 'RECEIVED',
  retry_count integer not null default 0, outcome text, payload_digest text, unique(provider, provider_event_id)
);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(), bank_name text not null, nickname text not null, account_number_masked text not null,
  account_type text, branch text, ifsc_masked text, status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','CLOSED')),
  is_primary boolean not null default false, opened_date date, evidence_document_id uuid references public.corporate_documents(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.financial_imports (
  id uuid primary key default gen_random_uuid(), reference text not null unique, bank_account_id uuid references public.bank_accounts(id) on delete restrict,
  source_type text not null check (source_type in ('CSV','XLSX','PDF')), source_document_id uuid references public.corporate_documents(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict, uploaded_at timestamptz not null default now(), row_count integer not null default 0,
  validation_status text not null default 'STAGED' check (validation_status in ('STAGED','VALIDATED','REVIEW_REQUIRED','CONFIRMED','REJECTED','ROLLED_BACK')),
  duplicate_count integer not null default 0, reviewed_by uuid references public.profiles(id) on delete set null, confirmed_at timestamptz, rollback_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.financial_import_rows (
  id uuid primary key default gen_random_uuid(), import_id uuid not null references public.financial_imports(id) on delete restrict,
  row_number integer not null, original_data jsonb not null, parsed_data jsonb not null default '{}'::jsonb, validation_status text not null default 'STAGED',
  possible_duplicate boolean not null default false, problem text, confirmed_transaction_id uuid, created_at timestamptz not null default now(), unique(import_id, row_number)
);
create table public.vendors (
  id uuid primary key default gen_random_uuid(), name text not null, legal_name text, service_description text, contact_data jsonb not null default '{}'::jsonb,
  gstin_masked text, risk_classification text not null default 'STANDARD', agreement_document_id uuid references public.corporate_documents(id) on delete set null,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(), bank_account_id uuid references public.bank_accounts(id) on delete restrict,
  import_row_id uuid unique references public.financial_import_rows(id) on delete restrict, transaction_date date not null, bank_reference text,
  original_description text not null, debit numeric(16,2) not null default 0 check (debit >= 0), credit numeric(16,2) not null default 0 check (credit >= 0),
  balance numeric(16,2), counterparty text, category text, tax_relevance text, reconciliation_status text not null default 'UNRECONCILED' check (reconciliation_status in ('UNRECONCILED','SUGGESTED','RECONCILED','IGNORED','TRANSFER')),
  description_fingerprint text not null, created_at timestamptz not null default now(), check (debit > 0 or credit > 0)
);
create index financial_transactions_reconcile_idx on public.financial_transactions(reconciliation_status, transaction_date desc);
create index financial_transactions_fingerprint_idx on public.financial_transactions(bank_account_id, description_fingerprint);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), reference text not null unique, expense_date date, vendor_id uuid references public.vendors(id) on delete set null,
  category text, purpose text, amount numeric(16,2) not null check (amount >= 0), gst_component numeric(16,2) not null default 0 check (gst_component >= 0),
  payment_method text, bank_account_id uuid references public.bank_accounts(id) on delete set null, invoice_document_id uuid references public.corporate_documents(id) on delete set null,
  receipt_document_id uuid references public.corporate_documents(id) on delete set null, requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null, status text not null default 'DRAFT' check (status in ('DRAFT','EVIDENCE_REQUIRED','REVIEW','APPROVED','PAID','RECONCILED','CLOSED')),
  created_at timestamptz not null default now()
);
create table public.company_invoices (
  id uuid primary key default gen_random_uuid(), invoice_number text not null unique, customer_name text not null, invoice_date date not null,
  taxable_value numeric(16,2) not null check (taxable_value >= 0), gst_amount numeric(16,2) not null default 0 check (gst_amount >= 0), total_amount numeric(16,2) not null check (total_amount >= 0),
  payment_status text not null default 'UNPAID', payment_reference text, document_id uuid references public.corporate_documents(id) on delete set null, created_at timestamptz not null default now()
);
create table public.tax_payments (
  id uuid primary key default gen_random_uuid(), tax_type text not null check (tax_type in ('GST','TDS','INCOME_TAX','OTHER')), period text, amount numeric(16,2) not null check (amount >= 0),
  challan_reference text, payment_date date, evidence_document_id uuid references public.corporate_documents(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null, compliance_obligation_id uuid references public.compliance_obligations(id) on delete set null, created_at timestamptz not null default now()
);
create table public.reconciliation_suggestions (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  target_type text not null check (target_type in ('INVOICE','EXPENSE','TAX_PAYMENT','REIMBURSEMENT','TRANSFER')), target_id uuid not null,
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 100), status text not null default 'SUGGESTED' check (status in ('SUGGESTED','CONFIRMED','DISMISSED')),
  reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.corporate_assets (
  id uuid primary key default gen_random_uuid(), reference text not null unique, asset_type text not null, description text not null, purchase_date date, cost numeric(16,2),
  vendor_id uuid references public.vendors(id) on delete set null, invoice_document_id uuid references public.corporate_documents(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null, location text, status text not null default 'ACTIVE', warranty_expiry date, disposal_status text,
  created_at timestamptz not null default now()
);
create table public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(), provider text not null, service text not null, plan text, billing_cycle text, cost numeric(16,2),
  renewal_date date, owner_id uuid references public.profiles(id) on delete set null, payment_reference_masked text, contract_id uuid, status text not null default 'ACTIVE',
  created_at timestamptz not null default now(), unique(provider, service)
);
create table public.data_quality_findings (
  id uuid primary key default gen_random_uuid(), category text not null, title text not null, severity text not null check (severity in ('INFO','ACTION','URGENT')),
  entity_type text, entity_id uuid, status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','RESOLVED','DISMISSED')),
  detail text, detected_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references public.profiles(id) on delete set null
);
create table public.production_readiness_checks (
  id uuid primary key default gen_random_uuid(), category text not null, key text not null unique, title text not null,
  status text not null default 'ACTION_REQUIRED' check (status in ('READY','ACTION_REQUIRED','BLOCKED','NOT_APPLICABLE')),
  evidence text, owner_id uuid references public.profiles(id) on delete set null, verified_at timestamptz, verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.corporate_events enable row level security; alter table public.automation_definitions enable row level security; alter table public.automation_runs enable row level security; alter table public.automation_run_actions enable row level security; alter table public.automation_dead_letters enable row level security; alter table public.scheduled_jobs enable row level security; alter table public.notification_preferences enable row level security; alter table public.notification_deliveries enable row level security; alter table public.integration_registry enable row level security; alter table public.webhook_inbox enable row level security; alter table public.bank_accounts enable row level security; alter table public.financial_imports enable row level security; alter table public.financial_import_rows enable row level security; alter table public.vendors enable row level security; alter table public.financial_transactions enable row level security; alter table public.expenses enable row level security; alter table public.company_invoices enable row level security; alter table public.tax_payments enable row level security; alter table public.reconciliation_suggestions enable row level security; alter table public.corporate_assets enable row level security; alter table public.saas_subscriptions enable row level security; alter table public.data_quality_findings enable row level security; alter table public.production_readiness_checks enable row level security;

create or replace function public.can_access_finance() returns boolean language sql stable security definer set search_path = public as $$ select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','CA_AUDITOR','CA','AUDITOR','FINANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]) $$;
create or replace function public.can_manage_finance() returns boolean language sql stable security definer set search_path = public as $$ select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','CA_AUDITOR','CA','FINANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]) $$;
revoke all on function public.can_access_finance() from public; grant execute on function public.can_access_finance() to authenticated;
revoke all on function public.can_manage_finance() from public; grant execute on function public.can_manage_finance() to authenticated;

create policy "automations authorised read" on public.automation_definitions for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "automations authorised manage" on public.automation_definitions for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "automation run audit read" on public.automation_runs for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "automation action audit read" on public.automation_run_actions for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "automation failure admin read" on public.automation_dead_letters for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "scheduled jobs admin" on public.scheduled_jobs for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "notification preferences self" on public.notification_preferences for all to authenticated using (profile_id = auth.uid() and public.is_active_corporate_member()) with check (profile_id = auth.uid());
create policy "notification deliveries self" on public.notification_deliveries for select to authenticated using (recipient_id = auth.uid() and public.is_active_corporate_member());
create policy "integrations authorised read" on public.integration_registry for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "integrations authorised manage" on public.integration_registry for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "bank accounts finance read" on public.bank_accounts for select to authenticated using (public.can_access_finance());
create policy "bank accounts finance write" on public.bank_accounts for all to authenticated using (public.can_manage_finance()) with check (public.can_manage_finance());
create policy "finance imports scoped" on public.financial_imports for select to authenticated using (public.can_access_finance() or uploaded_by = auth.uid());
create policy "finance imports manage" on public.financial_imports for all to authenticated using (public.can_manage_finance()) with check (public.can_manage_finance());
create policy "finance import rows scoped" on public.financial_import_rows for select to authenticated using (public.can_access_finance());
create policy "finance import rows manage" on public.financial_import_rows for all to authenticated using (public.can_manage_finance()) with check (public.can_manage_finance());
create policy "vendors finance" on public.vendors for all to authenticated using (public.can_access_finance()) with check (public.can_manage_finance());
create policy "transactions finance" on public.financial_transactions for all to authenticated using (public.can_access_finance()) with check (public.can_manage_finance());
create policy "expenses finance" on public.expenses for all to authenticated using (public.can_access_finance()) with check (public.can_manage_finance());
create policy "invoices finance" on public.company_invoices for all to authenticated using (public.can_access_finance()) with check (public.can_manage_finance());
create policy "tax payments finance" on public.tax_payments for all to authenticated using (public.can_access_finance()) with check (public.can_manage_finance());
create policy "reconciliation finance" on public.reconciliation_suggestions for all to authenticated using (public.can_access_finance()) with check (public.can_manage_finance());
create policy "assets authorised" on public.corporate_assets for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','FINANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','FINANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "subscriptions authorised" on public.saas_subscriptions for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','FINANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','FINANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "quality authorised" on public.data_quality_findings for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "readiness authorised" on public.production_readiness_checks for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));

create or replace function public.emit_corporate_event(p_event_type text, p_entity_type text, p_entity_id uuid, p_idempotency_key text, p_payload jsonb default '{}'::jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; begin if not public.is_active_corporate_member() then raise exception 'Active corporate identity required'; end if; insert into public.corporate_events(event_type, entity_type, entity_id, actor_id, idempotency_key, payload) values (p_event_type, p_entity_type, p_entity_id, auth.uid(), p_idempotency_key, coalesce(p_payload, '{}'::jsonb)) on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key returning id into v_id; return v_id; end $$;
revoke all on function public.emit_corporate_event(text, text, uuid, text, jsonb) from public; grant execute on function public.emit_corporate_event(text, text, uuid, text, jsonb) to authenticated;
