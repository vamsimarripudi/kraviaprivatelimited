CREATE TABLE contacts (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    name varchar(255) NOT NULL,
    organization varchar(255),
    role varchar(255),
    category varchar(60) NOT NULL CHECK (category IN ('CA', 'LAWYER', 'BANK_MANAGER', 'VENDOR', 'INVESTOR', 'GOVERNMENT_CONTACT', 'CUSTOMER', 'ADVISOR', 'CONSULTANT', 'OTHER')),
    phone varchar(60),
    email varchar(255),
    notes text,
    related_document_id uuid,
    related_task_id uuid,
    last_contacted_date date,
    next_follow_up_date date,
    status varchar(40) NOT NULL CHECK (status IN ('ACTIVE', 'WAITING', 'FOLLOW_UP_NEEDED', 'CLOSED', 'ARCHIVED')),
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_contacts_name ON contacts (lower(name));
CREATE INDEX idx_contacts_category ON contacts (category);
CREATE INDEX idx_contacts_status ON contacts (status);
CREATE INDEX idx_contacts_next_follow_up_date ON contacts (next_follow_up_date ASC);
CREATE INDEX idx_contacts_email ON contacts (lower(email));