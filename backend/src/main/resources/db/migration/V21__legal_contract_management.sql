CREATE TABLE legal_contracts (
    id uuid PRIMARY KEY,
    contract_title varchar(240) NOT NULL,
    contract_type varchar(60) NOT NULL,
    parties_involved text,
    effective_date date,
    expiry_date date,
    renewal_date date,
    contract_value numeric(19, 2) DEFAULT 0 NOT NULL,
    status varchar(40) NOT NULL,
    approval_status varchar(40) NOT NULL,
    signature_status varchar(40) NOT NULL,
    related_document_id uuid REFERENCES documents(id),
    responsible_person varchar(320),
    notes text,
    created_by varchar(320) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone
);

CREATE TABLE legal_obligations (
    id uuid PRIMARY KEY,
    contract_id uuid REFERENCES legal_contracts(id),
    obligation_title varchar(240) NOT NULL,
    description text,
    responsible_person varchar(320) NOT NULL,
    due_date date,
    status varchar(40) NOT NULL,
    priority varchar(40) NOT NULL,
    related_document_id uuid REFERENCES documents(id),
    notes text,
    created_by varchar(320) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone
);

CREATE TABLE legal_approvals (
    id uuid PRIMARY KEY,
    contract_id uuid REFERENCES legal_contracts(id),
    approval_title varchar(240) NOT NULL,
    approval_status varchar(40) NOT NULL,
    approver varchar(320),
    approval_notes text,
    approval_date date,
    rejection_reason text,
    related_document_id uuid REFERENCES documents(id),
    notes text,
    created_by varchar(320) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone
);

CREATE TABLE legal_notices (
    id uuid PRIMARY KEY,
    notice_title varchar(240) NOT NULL,
    notice_type varchar(120),
    issued_by varchar(320),
    issued_to varchar(320) NOT NULL,
    notice_date date NOT NULL,
    response_due_date date,
    status varchar(40) NOT NULL,
    related_document_id uuid REFERENCES documents(id),
    responsible_person varchar(320),
    notes text,
    created_by varchar(320) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone
);

CREATE TABLE legal_risk_links (
    id uuid PRIMARY KEY,
    contract_id uuid REFERENCES legal_contracts(id),
    risk_register_entry_id uuid REFERENCES risk_register_entries(id),
    risk_title varchar(240) NOT NULL,
    severity varchar(40) NOT NULL,
    status varchar(40) NOT NULL,
    owner varchar(320),
    mitigation_plan text,
    review_date date,
    notes text,
    created_by varchar(320) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone
);

CREATE INDEX idx_legal_contracts_status ON legal_contracts(status);
CREATE INDEX idx_legal_contracts_type ON legal_contracts(contract_type);
CREATE INDEX idx_legal_contracts_renewal_date ON legal_contracts(renewal_date);
CREATE INDEX idx_legal_contracts_expiry_date ON legal_contracts(expiry_date);
CREATE INDEX idx_legal_contracts_document ON legal_contracts(related_document_id);
CREATE INDEX idx_legal_obligations_status ON legal_obligations(status);
CREATE INDEX idx_legal_obligations_due_date ON legal_obligations(due_date);
CREATE INDEX idx_legal_approvals_status ON legal_approvals(approval_status);
CREATE INDEX idx_legal_notices_status ON legal_notices(status);
CREATE INDEX idx_legal_notices_response_due ON legal_notices(response_due_date);
CREATE INDEX idx_legal_risk_links_status ON legal_risk_links(status);
CREATE INDEX idx_legal_risk_links_severity ON legal_risk_links(severity);
