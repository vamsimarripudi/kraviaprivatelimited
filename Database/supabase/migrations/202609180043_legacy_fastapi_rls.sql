-- KRAVIA Office — legacy FastAPI service-table RLS hardening.
-- Runtime and Alembic transactions execute as kravia_office_backend.
-- These tables are backend-owned and browser roles already have zero CRUD.
-- Enable RLS as defense in depth without adding permissive anon/authenticated policies.

do $$
declare
  table_name text;
  protected_tables constant text[] := array[
    'accounting_period_locks',
    'alembic_version',
    'approval_requests',
    'audit_events',
    'authority_grants',
    'bank_accounts',
    'bank_transactions',
    'board_meetings',
    'chart_accounts',
    'commercial_plans',
    'compliance_obligations',
    'contracts',
    'contribution_allocations',
    'contribution_calls',
    'controlled_sequences',
    'credit_notes',
    'customers',
    'document_versions',
    'documents',
    'employees',
    'event_outbox',
    'expense_obligations',
    'finance_provider_events',
    'funding_policies',
    'idempotency_records',
    'inspection_cases',
    'integration_registry',
    'invoice_sequences',
    'invoices',
    'journal_entries',
    'journal_lines',
    'legal_entities',
    'notice_cases',
    'office_assets',
    'operational_alerts',
    'payment_attempts',
    'payment_instructions',
    'payment_mandates',
    'payments',
    'products',
    'receipts',
    'refunds',
    'resolutions',
    'settlements',
    'share_change_requests',
    'share_classes',
    'share_ledger_entries',
    'share_transfer_requests',
    'shareholders',
    'subscriptions',
    'vendors',
    'workflow_runs'
  ];
  current_owner text;
begin
  if not exists (select 1 from pg_roles where rolname='kravia_office_backend') then
    raise exception 'required role kravia_office_backend does not exist';
  end if;

  foreach table_name in array protected_tables loop
    select pg_get_userbyid(c.relowner)
      into current_owner
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public'
       and c.relname=table_name
       and c.relkind='r';

    if current_owner is null then
      raise exception 'required table public.% does not exist', table_name;
    end if;

    if current_owner <> 'kravia_office_backend' then
      raise exception 'public.% must be owned by kravia_office_backend before RLS hardening (owner=%)', table_name, current_owner;
    end if;

    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end
$$;
