CREATE TABLE financial_records (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    reporting_month varchar(7) NOT NULL CHECK (reporting_month ~ '^[0-9]{4}-[0-9]{2}$'),
    revenue numeric(19, 2) NOT NULL CHECK (revenue >= 0),
    expenses numeric(19, 2) NOT NULL CHECK (expenses >= 0),
    profit_or_loss numeric(19, 2) NOT NULL,
    cash_balance numeric(19, 2) NOT NULL CHECK (cash_balance >= 0),
    receivables numeric(19, 2) NOT NULL CHECK (receivables >= 0),
    payables numeric(19, 2) NOT NULL CHECK (payables >= 0),
    gst_collected numeric(19, 2) NOT NULL CHECK (gst_collected >= 0),
    gst_paid numeric(19, 2) NOT NULL CHECK (gst_paid >= 0),
    net_gst_position numeric(19, 2) NOT NULL,
    cloud_subscriptions numeric(19, 2) NOT NULL CHECK (cloud_subscriptions >= 0),
    vendor_payments numeric(19, 2) NOT NULL CHECK (vendor_payments >= 0),
    director_remuneration numeric(19, 2) NOT NULL CHECK (director_remuneration >= 0),
    founder_notes text,
    status varchar(40) NOT NULL CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_financial_records_reporting_month ON financial_records (reporting_month DESC);
CREATE INDEX idx_financial_records_status ON financial_records (status);
CREATE INDEX idx_financial_records_created_by ON financial_records (lower(created_by));
