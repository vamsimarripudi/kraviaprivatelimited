CREATE TABLE app_users (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    email varchar(320) NOT NULL UNIQUE,
    display_name varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    role varchar(40) NOT NULL CHECK (role IN ('FOUNDER', 'DIRECTOR', 'VIEWER')),
    enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    actor_email varchar(320) NOT NULL,
    actor_name varchar(255) NOT NULL,
    actor_role varchar(40) NOT NULL,
    module varchar(80) NOT NULL,
    action varchar(120) NOT NULL,
    description text NOT NULL,
    severity varchar(40) NOT NULL
);

CREATE TABLE company_profiles (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    company_name varchar(255),
    cin varchar(80),
    pan varchar(80),
    tan varchar(80),
    registered_office_address text,
    email varchar(320),
    phone varchar(80),
    date_of_incorporation date,
    authorized_capital varchar(120),
    paid_up_capital varchar(120),
    directors text,
    shareholders text,
    company_status varchar(120),
    last_updated_date date
);

CREATE TABLE documents (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    category varchar(120) NOT NULL,
    content_type varchar(255),
    size_bytes bigint NOT NULL,
    storage_key varchar(500) NOT NULL,
    uploaded_by varchar(255),
    status varchar(80),
    version_label varchar(80)
);

CREATE TABLE board_meetings (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE financial_records (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE compliance_items (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE company_tasks (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE products (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE contacts (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE settings (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE announcements (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE notifications (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE reports (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE ai_context_entries (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(80) NOT NULL,
    owner_name varchar(255),
    due_date date,
    category varchar(255),
    reference_code varchar(255),
    amount numeric(19, 2),
    details text,
    notes text,
    archived boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_documents_category ON documents (category);
CREATE INDEX idx_products_status ON products (status);
CREATE INDEX idx_company_tasks_status ON company_tasks (status);
CREATE INDEX idx_compliance_items_due_date ON compliance_items (due_date);

