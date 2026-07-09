CREATE TABLE documents (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    category varchar(80) NOT NULL CHECK (category IN (
        'INCORPORATION_CERTIFICATE',
        'MOA',
        'AOA',
        'COMPANY_PAN',
        'TAN',
        'GST',
        'BOARD_RESOLUTION',
        'RENTAL_AGREEMENT',
        'BANK_DOCUMENT',
        'TRADEMARK_DOCUMENT',
        'STARTUP_INDIA_DOCUMENT',
        'AGREEMENT',
        'OTHER'
    )),
    description text,
    status varchar(40) NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED', 'EXPIRED', 'PENDING_REVIEW')),
    file_name varchar(255) NOT NULL,
    file_type varchar(255) NOT NULL,
    file_size bigint NOT NULL,
    storage_path varchar(600) NOT NULL,
    version integer NOT NULL,
    uploaded_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE document_versions (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version integer NOT NULL,
    file_name varchar(255) NOT NULL,
    file_type varchar(255) NOT NULL,
    file_size bigint NOT NULL,
    storage_path varchar(600) NOT NULL,
    uploaded_by varchar(255) NOT NULL,
    UNIQUE (document_id, version)
);

CREATE INDEX idx_documents_category ON documents (category);
CREATE INDEX idx_documents_status ON documents (status);
CREATE INDEX idx_documents_title ON documents (lower(title));
CREATE INDEX idx_document_versions_document_id ON document_versions (document_id);
