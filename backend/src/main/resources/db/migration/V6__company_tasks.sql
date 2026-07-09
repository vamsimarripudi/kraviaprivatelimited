CREATE TABLE company_tasks (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    category varchar(60) NOT NULL CHECK (category IN (
        'FOUNDER_TASK',
        'DIRECTOR_TASK',
        'CA_TASK',
        'LAWYER_TASK',
        'BANK_TASK',
        'PRODUCT_TASK',
        'FINANCE_TASK',
        'COMPLIANCE_TASK',
        'DOCUMENT_TASK',
        'INVESTOR_TASK',
        'CUSTOMER_TASK',
        'OTHER'
    )),
    description text,
    assigned_to varchar(255),
    due_date date,
    priority varchar(40) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status varchar(40) NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'DONE', 'ARCHIVED')),
    related_section varchar(255),
    related_document_id uuid,
    notes text,
    created_by varchar(255) NOT NULL,
    completed_at timestamptz,
    archived_at timestamptz
);

CREATE INDEX idx_company_tasks_due_date ON company_tasks (due_date ASC);
CREATE INDEX idx_company_tasks_category ON company_tasks (category);
CREATE INDEX idx_company_tasks_status ON company_tasks (status);
CREATE INDEX idx_company_tasks_priority ON company_tasks (priority);
CREATE INDEX idx_company_tasks_assigned_to ON company_tasks (lower(assigned_to));
CREATE INDEX idx_company_tasks_title ON company_tasks (lower(title));