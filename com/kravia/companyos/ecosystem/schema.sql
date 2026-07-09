-- Backend package: com.kravia.companyos.ecosystem
-- PostgreSQL persistence schema for the KRAVIA Ecosystem Product Registry.

CREATE TABLE IF NOT EXISTS kravia_ecosystem_products (
  id text PRIMARY KEY,
  product_name text NOT NULL,
  product_code text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('IDEA', 'DEVELOPMENT', 'TESTING', 'STAGING', 'LAUNCH_READY', 'LIVE', 'PAUSED', 'ARCHIVED')),
  owner_name text,
  description text,
  domain text,
  backend_url text,
  frontend_url text,
  current_version text,
  launch_status text,
  revenue_status text,
  compliance_status text,
  security_status text,
  deployment_status text,
  roadmap_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  launch_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL,
  last_updated timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kravia_ecosystem_products_status ON kravia_ecosystem_products (status);
CREATE INDEX IF NOT EXISTS idx_kravia_ecosystem_products_owner ON kravia_ecosystem_products (owner_name);
CREATE INDEX IF NOT EXISTS idx_kravia_ecosystem_products_updated ON kravia_ecosystem_products (last_updated DESC);
