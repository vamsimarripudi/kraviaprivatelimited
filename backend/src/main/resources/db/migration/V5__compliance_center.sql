CREATE TABLE compliance_items (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    category varchar(80) NOT NULL CHECK (category IN (
        'MCA',
        'ROC',
        'INC_22',
        'AUDITOR_APPOINTMENT',
        'GST_REGISTRATION',
        'GST_FILING',
        'STARTUP_INDIA',
        'TRADEMARK',
        'MSME_UDYAM',
        'EPFO',
        'ESIC',
        'BANK_KYC',
        'ANNUAL_COMPLIANCE',
        'BOARD_RESOLUTION',
        'LEGAL_AGREEMENT',
        'OTHER'
    )),
    description text,
    due_date date,
    status varchar(60) NOT NULL CHECK (status IN (
        'NOT_STARTED',
        'IN_PROGRESS',
        'WAITING_FOR_CA',
        'WAITING_FOR_DIRECTOR',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'COMPLETED',
        'NOT_APPLICABLE',
        'ARCHIVED'
    )),
    priority varchar(40) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    responsible_person varchar(255),
    related_document_id uuid,
    notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_compliance_items_due_date ON compliance_items (due_date ASC);
CREATE INDEX idx_compliance_items_category ON compliance_items (category);
CREATE INDEX idx_compliance_items_status ON compliance_items (status);
CREATE INDEX idx_compliance_items_priority ON compliance_items (priority);
CREATE INDEX idx_compliance_items_title ON compliance_items (lower(title));
