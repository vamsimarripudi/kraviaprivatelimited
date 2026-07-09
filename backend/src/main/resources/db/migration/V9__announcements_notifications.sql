CREATE TABLE announcements (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    audience varchar(40) NOT NULL CHECK (audience IN ('FOUNDER', 'DIRECTOR', 'VIEWER', 'EVERYONE')),
    status varchar(40) NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'PINNED', 'ARCHIVED', 'EXPIRED')),
    expires_at date,
    created_by varchar(255) NOT NULL,
    published_at timestamptz,
    pinned_at timestamptz,
    archived_at timestamptz
);

CREATE TABLE notifications (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    type varchar(60) NOT NULL CHECK (type IN ('COMPLIANCE_DUE', 'TASK_ASSIGNED', 'TASK_OVERDUE', 'MEETING_CREATED', 'DOCUMENT_UPLOADED', 'FINANCIAL_RECORD_ADDED', 'PRODUCT_UPDATED', 'SETTINGS_CHANGED', 'SECURITY_ALERT', 'GENERAL')),
    recipient_email varchar(320) NOT NULL,
    audience varchar(40) NOT NULL CHECK (audience IN ('FOUNDER', 'DIRECTOR', 'VIEWER', 'EVERYONE')),
    source_module varchar(255),
    source_id uuid,
    read_at timestamptz,
    archived_at timestamptz
);

CREATE INDEX idx_announcements_status ON announcements (status);
CREATE INDEX idx_announcements_audience ON announcements (audience);
CREATE INDEX idx_announcements_updated_at ON announcements (updated_at DESC);
CREATE INDEX idx_notifications_recipient_email ON notifications (lower(recipient_email));
CREATE INDEX idx_notifications_read_at ON notifications (read_at);
CREATE INDEX idx_notifications_archived_at ON notifications (archived_at);
CREATE INDEX idx_notifications_type ON notifications (type);