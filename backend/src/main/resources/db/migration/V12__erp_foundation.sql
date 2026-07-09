CREATE TABLE platform_modules (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    code varchar(80) NOT NULL UNIQUE,
    name varchar(160) NOT NULL,
    version varchar(40) NOT NULL,
    status varchar(40) NOT NULL,
    navigation_path varchar(240),
    permissions varchar(500) NOT NULL,
    dependencies varchar(500),
    feature_flag_key varchar(120)
);

CREATE TABLE module_feature_flags (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    flag_key varchar(120) NOT NULL UNIQUE,
    enabled boolean NOT NULL,
    description varchar(500)
);

CREATE TABLE platform_configurations (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    config_key varchar(160) NOT NULL UNIQUE,
    config_value varchar(3000),
    category varchar(80) NOT NULL,
    sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE workflow_instances (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    workflow_type varchar(80) NOT NULL,
    title varchar(240) NOT NULL,
    state varchar(60) NOT NULL,
    assignee varchar(320),
    related_module varchar(80),
    related_record_id uuid,
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE workflow_comments (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    workflow_id uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    author varchar(320) NOT NULL,
    comment_text varchar(2000) NOT NULL
);

CREATE TABLE workflow_history (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    workflow_id uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    actor varchar(320) NOT NULL,
    from_state varchar(60),
    to_state varchar(60) NOT NULL,
    note varchar(1000)
);

CREATE TABLE cross_module_links (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    source_module varchar(80) NOT NULL,
    source_record_id uuid NOT NULL,
    target_module varchar(80) NOT NULL,
    target_record_id uuid NOT NULL,
    relationship_type varchar(80) NOT NULL,
    label varchar(240)
);

CREATE INDEX idx_platform_modules_status ON platform_modules (status);
CREATE INDEX idx_platform_modules_feature_flag_key ON platform_modules (feature_flag_key);
CREATE INDEX idx_workflow_instances_state ON workflow_instances (state);
CREATE INDEX idx_workflow_instances_assignee ON workflow_instances (lower(assignee));
CREATE INDEX idx_workflow_instances_related ON workflow_instances (related_module, related_record_id);
CREATE INDEX idx_workflow_comments_workflow_id ON workflow_comments (workflow_id);
CREATE INDEX idx_workflow_history_workflow_id ON workflow_history (workflow_id);
CREATE INDEX idx_cross_module_links_source ON cross_module_links (source_module, source_record_id);
CREATE INDEX idx_cross_module_links_target ON cross_module_links (target_module, target_record_id);
