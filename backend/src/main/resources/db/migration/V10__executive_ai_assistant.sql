CREATE TABLE ai_queries (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    query varchar(2000) NOT NULL,
    module_context varchar(80) NOT NULL CHECK (module_context IN ('ALL', 'COMPANY_PROFILE', 'DOCUMENTS', 'BOARD_MEETINGS', 'FINANCE', 'COMPLIANCE', 'TASKS', 'PRODUCTS', 'CONTACTS', 'ANNOUNCEMENTS')),
    output_type varchar(80) NOT NULL CHECK (output_type IN ('SUMMARY', 'EMAIL_DRAFT', 'BOARD_RESOLUTION', 'RISK_ANALYSIS', 'ACTION_ITEMS', 'GENERAL_ANSWER')),
    date_from date,
    date_to date,
    created_by varchar(255) NOT NULL,
    actor_email varchar(320) NOT NULL,
    response text NOT NULL,
    archived_at timestamptz
);

CREATE TABLE ai_context_snapshots (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    ai_query_id uuid NOT NULL REFERENCES ai_queries(id) ON DELETE CASCADE,
    module_context varchar(80) NOT NULL,
    snapshot_text text NOT NULL
);

CREATE INDEX idx_ai_queries_actor_email ON ai_queries (lower(actor_email));
CREATE INDEX idx_ai_queries_module_context ON ai_queries (module_context);
CREATE INDEX idx_ai_queries_output_type ON ai_queries (output_type);
CREATE INDEX idx_ai_queries_created_at ON ai_queries (created_at DESC);
CREATE INDEX idx_ai_queries_archived_at ON ai_queries (archived_at);
CREATE INDEX idx_ai_context_snapshots_query ON ai_context_snapshots (ai_query_id);
