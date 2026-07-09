CREATE TABLE board_meetings (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    meeting_date timestamp NOT NULL,
    meeting_type varchar(80) NOT NULL CHECK (meeting_type IN (
        'BOARD_MEETING',
        'FOUNDER_MEETING',
        'FINANCE_REVIEW',
        'COMPLIANCE_REVIEW',
        'PRODUCT_REVIEW',
        'BANK_MEETING',
        'INVESTOR_MEETING',
        'OTHER'
    )),
    status varchar(40) NOT NULL CHECK (status IN ('DRAFT', 'SCHEDULED', 'COMPLETED', 'ARCHIVED')),
    discussion_notes text,
    created_by varchar(255) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE meeting_agenda_items (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    meeting_id uuid NOT NULL REFERENCES board_meetings(id) ON DELETE CASCADE,
    sort_order integer NOT NULL,
    item_text text NOT NULL
);

CREATE TABLE meeting_decisions (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    meeting_id uuid NOT NULL REFERENCES board_meetings(id) ON DELETE CASCADE,
    sort_order integer NOT NULL,
    decision_text text NOT NULL
);

CREATE TABLE meeting_resolutions (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    meeting_id uuid NOT NULL REFERENCES board_meetings(id) ON DELETE CASCADE,
    sort_order integer NOT NULL,
    resolution_text text NOT NULL
);

CREATE TABLE meeting_action_items (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    meeting_id uuid NOT NULL REFERENCES board_meetings(id) ON DELETE CASCADE,
    sort_order integer NOT NULL,
    action_text text NOT NULL,
    owner varchar(255) NOT NULL,
    due_date date,
    status varchar(40) NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'WAITING', 'DONE', 'BLOCKED'))
);

CREATE INDEX idx_board_meetings_meeting_date ON board_meetings (meeting_date DESC);
CREATE INDEX idx_board_meetings_type ON board_meetings (meeting_type);
CREATE INDEX idx_board_meetings_status ON board_meetings (status);
CREATE INDEX idx_board_meetings_title ON board_meetings (lower(title));
CREATE INDEX idx_meeting_agenda_items_meeting_id ON meeting_agenda_items (meeting_id);
CREATE INDEX idx_meeting_decisions_meeting_id ON meeting_decisions (meeting_id);
CREATE INDEX idx_meeting_resolutions_meeting_id ON meeting_resolutions (meeting_id);
CREATE INDEX idx_meeting_action_items_meeting_id ON meeting_action_items (meeting_id);
CREATE INDEX idx_meeting_action_items_status ON meeting_action_items (status);
