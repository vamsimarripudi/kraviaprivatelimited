# Finance ERP Database Schema

Migration: `backend/src/main/resources/db/migration/V17__finance_erp.sql`

## Tables

- `accounts`
- `journal_entries`
- `journal_entry_lines`
- `bank_accounts`
- `bank_transactions`
- `invoices`
- `customer_receivables`
- `vendor_payables`
- `gst_records`
- `budgets`
- `budget_lines`
- `financial_approvals`

## Key Relationships

- `accounts.parent_account_id` references `accounts.id`
- `journal_entry_lines.journal_entry_id` references `journal_entries.id`
- `journal_entry_lines.account_id` references `accounts.id`
- `bank_transactions.bank_account_id` references `bank_accounts.id`
- `bank_transactions.linked_journal_entry_id` references `journal_entries.id`
- `customer_receivables.invoice_id` references `invoices.id`
- `budget_lines.budget_id` references `budgets.id`
- `budget_lines.account_id` references `accounts.id`

## Controls

- Unique account codes.
- Unique voucher numbers.
- Unique invoice numbers.
- Debit and credit values cannot be negative.
- Journal line debit and credit cannot be equal.
- Archive uses status/timestamp fields instead of destructive deletion.

