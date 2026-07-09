CREATE TABLE sales_leads (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    lead_name varchar(255) NOT NULL,
    organization_name varchar(255) NOT NULL,
    contact_person varchar(255),
    phone varchar(80),
    email varchar(255),
    product_interest varchar(255) NOT NULL,
    lead_source varchar(255),
    stage varchar(40) NOT NULL CHECK (stage IN ('NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED')),
    priority varchar(40) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    assigned_person varchar(255),
    last_contacted_date date,
    next_follow_up_date date,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE sales_customers (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    customer_name varchar(255) NOT NULL,
    organization_type varchar(255),
    product varchar(255) NOT NULL,
    plan varchar(255),
    subscription_status varchar(255),
    start_date date,
    renewal_date date,
    payment_status varchar(255),
    support_status varchar(255),
    onboarding_status varchar(255),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_sales_leads_name ON sales_leads (lower(lead_name));
CREATE INDEX idx_sales_leads_organization ON sales_leads (lower(organization_name));
CREATE INDEX idx_sales_leads_stage ON sales_leads (stage);
CREATE INDEX idx_sales_leads_priority ON sales_leads (priority);
CREATE INDEX idx_sales_leads_next_follow_up ON sales_leads (next_follow_up_date);
CREATE INDEX idx_sales_customers_name ON sales_customers (lower(customer_name));
CREATE INDEX idx_sales_customers_product ON sales_customers (lower(product));
CREATE INDEX idx_sales_customers_subscription ON sales_customers (lower(subscription_status));
