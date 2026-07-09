CREATE TABLE data_privacy_records (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    module_name varchar(80) NOT NULL,
    record_id uuid,
    classification varchar(40) NOT NULL,
    sensitive_document boolean NOT NULL DEFAULT false,
    access_visibility varchar(1000),
    retention_rule varchar(1000),
    export_requested_at timestamptz,
    deletion_requested_at timestamptz,
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE approval_requests (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(240) NOT NULL,
    description varchar(3000),
    status varchar(40) NOT NULL,
    approver varchar(320),
    approval_notes varchar(2000),
    approval_date timestamptz,
    rejection_reason varchar(2000),
    linked_module varchar(80),
    linked_record_id uuid,
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE risk_register_entries (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(240) NOT NULL,
    category varchar(40) NOT NULL,
    description varchar(3000),
    severity varchar(40) NOT NULL,
    likelihood varchar(40) NOT NULL,
    owner varchar(320),
    mitigation_plan varchar(3000),
    status varchar(40) NOT NULL,
    review_date date,
    related_records varchar(2000),
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE evidence_packs (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    pack_type varchar(80) NOT NULL,
    title varchar(240) NOT NULL,
    status varchar(40) NOT NULL,
    source_summary varchar(4000),
    generated_by varchar(320) NOT NULL,
    generated_at timestamptz NOT NULL,
    pdf_export_available boolean NOT NULL DEFAULT false,
    zip_export_available boolean NOT NULL DEFAULT false,
    excel_export_available boolean NOT NULL DEFAULT false,
    archived_at timestamptz
);

CREATE TABLE access_review_records (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_status varchar(40) NOT NULL,
    reviewed_by varchar(320),
    reviewed_at timestamptz,
    notes varchar(2000),
    quarter_label varchar(40) NOT NULL,
    UNIQUE (user_id, quarter_label)
);

CREATE INDEX idx_data_privacy_module_record ON data_privacy_records (module_name, record_id);
CREATE INDEX idx_data_privacy_classification ON data_privacy_records (classification);
CREATE INDEX idx_data_privacy_archived_at ON data_privacy_records (archived_at);
CREATE INDEX idx_approval_requests_status ON approval_requests (status);
CREATE INDEX idx_approval_requests_linked ON approval_requests (linked_module, linked_record_id);
CREATE INDEX idx_approval_requests_archived_at ON approval_requests (archived_at);
CREATE INDEX idx_risk_register_category ON risk_register_entries (category);
CREATE INDEX idx_risk_register_status ON risk_register_entries (status);
CREATE INDEX idx_risk_register_severity ON risk_register_entries (severity);
CREATE INDEX idx_risk_register_review_date ON risk_register_entries (review_date);
CREATE INDEX idx_evidence_packs_type ON evidence_packs (pack_type);
CREATE INDEX idx_evidence_packs_generated_at ON evidence_packs (generated_at DESC);
CREATE INDEX idx_access_review_user_id ON access_review_records (user_id);
CREATE INDEX idx_access_review_quarter ON access_review_records (quarter_label);
