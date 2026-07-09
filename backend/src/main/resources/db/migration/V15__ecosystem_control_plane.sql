CREATE TABLE ecosystem_products (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    product_name varchar(255) NOT NULL,
    product_code varchar(40) NOT NULL UNIQUE,
    status varchar(40) NOT NULL CHECK (status IN ('IDEA', 'DEVELOPMENT', 'TESTING', 'STAGING', 'LAUNCH_READY', 'LIVE', 'PAUSED', 'ARCHIVED')),
    owner varchar(255) NOT NULL,
    description text,
    domain varchar(255),
    backend_url varchar(500),
    frontend_url varchar(500),
    current_version varchar(80),
    launch_status varchar(255),
    revenue_status varchar(255),
    compliance_status varchar(255),
    security_status varchar(255),
    deployment_status varchar(255),
    health_notes text,
    revenue_notes text,
    roadmap_notes text,
    launch_checklist text,
    risk_register text,
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_ecosystem_products_name ON ecosystem_products (lower(product_name));
CREATE INDEX idx_ecosystem_products_code ON ecosystem_products (lower(product_code));
CREATE INDEX idx_ecosystem_products_status ON ecosystem_products (status);
CREATE INDEX idx_ecosystem_products_owner ON ecosystem_products (lower(owner));
CREATE INDEX idx_ecosystem_products_updated ON ecosystem_products (updated_at DESC);
