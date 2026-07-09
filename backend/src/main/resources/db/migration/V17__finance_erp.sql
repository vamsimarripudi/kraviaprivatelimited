CREATE TABLE accounts (
    id uuid PRIMARY KEY,
    account_code varchar(64) NOT NULL UNIQUE,
    account_name varchar(255) NOT NULL,
    account_type varchar(40) NOT NULL,
    parent_account_id uuid REFERENCES accounts(id),
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE journal_entries (
    id uuid PRIMARY KEY,
    voucher_number varchar(120) NOT NULL UNIQUE,
    posting_date date NOT NULL,
    narration text NOT NULL,
    approval_status varchar(40) NOT NULL,
    linked_document_id uuid,
    created_by varchar(255) NOT NULL,
    posted_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE journal_entry_lines (
    id uuid PRIMARY KEY,
    journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES accounts(id),
    debit numeric(19, 2) NOT NULL DEFAULT 0,
    credit numeric(19, 2) NOT NULL DEFAULT 0,
    narration varchar(1000),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT chk_journal_line_debit_credit CHECK (debit >= 0 AND credit >= 0 AND debit <> credit)
);

CREATE TABLE bank_accounts (
    id uuid PRIMARY KEY,
    bank_name varchar(255) NOT NULL,
    account_name varchar(255) NOT NULL,
    account_number_masked varchar(80) NOT NULL,
    ifsc_code varchar(32),
    branch varchar(255),
    current_balance numeric(19, 2) NOT NULL DEFAULT 0,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE bank_transactions (
    id uuid PRIMARY KEY,
    bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
    transaction_date date NOT NULL,
    description varchar(1000) NOT NULL,
    amount numeric(19, 2) NOT NULL,
    transaction_type varchar(40) NOT NULL,
    reconciliation_status varchar(40) NOT NULL,
    linked_journal_entry_id uuid REFERENCES journal_entries(id),
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE invoices (
    id uuid PRIMARY KEY,
    invoice_number varchar(120) NOT NULL UNIQUE,
    customer_name varchar(255) NOT NULL,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    total_amount numeric(19, 2) NOT NULL,
    outstanding_amount numeric(19, 2) NOT NULL,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE customer_receivables (
    id uuid PRIMARY KEY,
    customer_name varchar(255) NOT NULL,
    invoice_id uuid REFERENCES invoices(id),
    due_date date NOT NULL,
    outstanding_amount numeric(19, 2) NOT NULL,
    status varchar(40) NOT NULL,
    reminder_status varchar(120),
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE vendor_payables (
    id uuid PRIMARY KEY,
    vendor_name varchar(255) NOT NULL,
    bill_number varchar(120) NOT NULL,
    due_date date NOT NULL,
    amount numeric(19, 2) NOT NULL,
    payment_status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE gst_records (
    id uuid PRIMARY KEY,
    filing_period varchar(7) NOT NULL,
    gst_collected numeric(19, 2) NOT NULL DEFAULT 0,
    gst_paid numeric(19, 2) NOT NULL DEFAULT 0,
    input_tax_credit numeric(19, 2) NOT NULL DEFAULT 0,
    output_tax numeric(19, 2) NOT NULL DEFAULT 0,
    net_gst_position numeric(19, 2) NOT NULL DEFAULT 0,
    filing_status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE budgets (
    id uuid PRIMARY KEY,
    budget_name varchar(255) NOT NULL,
    budget_type varchar(40) NOT NULL,
    financial_year varchar(9) NOT NULL,
    department varchar(255),
    product varchar(255),
    annual_budget numeric(19, 2) NOT NULL DEFAULT 0,
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE budget_lines (
    id uuid PRIMARY KEY,
    budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    account_id uuid REFERENCES accounts(id),
    line_name varchar(255) NOT NULL,
    planned_amount numeric(19, 2) NOT NULL DEFAULT 0,
    actual_amount numeric(19, 2) NOT NULL DEFAULT 0,
    variance_amount numeric(19, 2) NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE financial_approvals (
    id uuid PRIMARY KEY,
    approval_type varchar(40) NOT NULL,
    title varchar(255) NOT NULL,
    amount numeric(19, 2) NOT NULL DEFAULT 0,
    status varchar(40) NOT NULL,
    requested_by varchar(255) NOT NULL,
    approver varchar(255),
    approval_notes text,
    approval_date date,
    linked_record_type varchar(120),
    linked_record_id uuid,
    rejection_reason text,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_accounts_type ON accounts (account_type);
CREATE INDEX idx_accounts_status ON accounts (status);
CREATE INDEX idx_journal_entries_posting_date ON journal_entries (posting_date);
CREATE INDEX idx_journal_entries_approval_status ON journal_entries (approval_status);
CREATE INDEX idx_bank_transactions_account_date ON bank_transactions (bank_account_id, transaction_date);
CREATE INDEX idx_invoices_due_date ON invoices (due_date);
CREATE INDEX idx_receivables_due_date ON customer_receivables (due_date);
CREATE INDEX idx_payables_due_date ON vendor_payables (due_date);
CREATE INDEX idx_gst_records_period ON gst_records (filing_period);
CREATE INDEX idx_budgets_financial_year ON budgets (financial_year);
CREATE INDEX idx_financial_approvals_status ON financial_approvals (status);
