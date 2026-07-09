CREATE TABLE assets (
    id uuid PRIMARY KEY,
    asset_name varchar(255) NOT NULL,
    asset_code varchar(120) NOT NULL UNIQUE,
    category varchar(40) NOT NULL,
    description text,
    purchase_date date,
    purchase_cost numeric(19,2),
    vendor_id uuid REFERENCES procurement_vendors(id),
    assigned_to varchar(255),
    location varchar(255),
    status varchar(40) NOT NULL,
    warranty_start_date date,
    warranty_end_date date,
    renewal_date date,
    related_document_id uuid REFERENCES documents(id),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE asset_assignments (
    id uuid PRIMARY KEY,
    asset_id uuid NOT NULL REFERENCES assets(id),
    assigned_to varchar(255) NOT NULL,
    assigned_by varchar(255) NOT NULL,
    assigned_date date NOT NULL,
    return_date date,
    location varchar(255),
    status varchar(40) NOT NULL,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE asset_maintenance_records (
    id uuid PRIMARY KEY,
    asset_id uuid NOT NULL REFERENCES assets(id),
    maintenance_title varchar(255) NOT NULL,
    maintenance_type varchar(120),
    service_provider varchar(255),
    maintenance_date date NOT NULL,
    next_maintenance_date date,
    cost numeric(19,2),
    status varchar(40) NOT NULL,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE software_licenses (
    id uuid PRIMARY KEY,
    asset_id uuid REFERENCES assets(id),
    license_name varchar(255) NOT NULL,
    provider varchar(255),
    license_key_reference varchar(255),
    seats integer,
    assigned_seats integer,
    renewal_date date,
    status varchar(40) NOT NULL,
    related_document_id uuid REFERENCES documents(id),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE cloud_resources (
    id uuid PRIMARY KEY,
    asset_id uuid REFERENCES assets(id),
    resource_name varchar(255) NOT NULL,
    provider varchar(120),
    resource_type varchar(120),
    region varchar(120),
    environment varchar(120),
    monthly_cost numeric(19,2),
    owner varchar(255),
    status varchar(40) NOT NULL,
    related_document_id uuid REFERENCES documents(id),
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE TABLE asset_documents (
    id uuid PRIMARY KEY,
    asset_id uuid NOT NULL REFERENCES assets(id),
    document_id uuid NOT NULL REFERENCES documents(id),
    document_purpose varchar(255),
    status varchar(40) NOT NULL,
    created_by varchar(255) NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_vendor_id ON assets(vendor_id);
CREATE INDEX idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX idx_assets_warranty_end_date ON assets(warranty_end_date);
CREATE INDEX idx_assets_renewal_date ON assets(renewal_date);
CREATE INDEX idx_asset_assignments_asset_id ON asset_assignments(asset_id);
CREATE INDEX idx_asset_assignments_status ON asset_assignments(status);
CREATE INDEX idx_asset_maintenance_asset_id ON asset_maintenance_records(asset_id);
CREATE INDEX idx_asset_maintenance_status ON asset_maintenance_records(status);
CREATE INDEX idx_software_licenses_asset_id ON software_licenses(asset_id);
CREATE INDEX idx_software_licenses_status ON software_licenses(status);
CREATE INDEX idx_software_licenses_renewal_date ON software_licenses(renewal_date);
CREATE INDEX idx_cloud_resources_asset_id ON cloud_resources(asset_id);
CREATE INDEX idx_cloud_resources_status ON cloud_resources(status);
CREATE INDEX idx_asset_documents_asset_id ON asset_documents(asset_id);
CREATE INDEX idx_asset_documents_document_id ON asset_documents(document_id);