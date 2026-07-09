CREATE TABLE products (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    name varchar(255) NOT NULL,
    category varchar(40) NOT NULL CHECK (category IN ('VIDYALUMA', 'VAANMEET', 'VFORMIX', 'FUTURE_PRODUCT', 'OTHER')),
    description text,
    status varchar(40) NOT NULL CHECK (status IN ('IDEA', 'PLANNING', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'LAUNCH_READY', 'LIVE', 'PAUSED', 'ARCHIVED')),
    development_stage varchar(255) NOT NULL,
    launch_readiness_percentage integer NOT NULL CHECK (launch_readiness_percentage >= 0 AND launch_readiness_percentage <= 100),
    target_users text,
    pricing_notes text,
    revenue_notes text,
    key_features text,
    pending_work text,
    risks text,
    next_milestone varchar(255),
    responsible_person varchar(255),
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_products_name ON products (lower(name));
CREATE INDEX idx_products_status ON products (status);
CREATE INDEX idx_products_development_stage ON products (lower(development_stage));
CREATE INDEX idx_products_category ON products (category);