CREATE TABLE workflow_templates (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    template_name varchar(200) NOT NULL,
    workflow_type varchar(80) NOT NULL,
    description varchar(3000),
    status varchar(40) NOT NULL,
    trigger_type varchar(60) NOT NULL,
    trigger_module varchar(80),
    conditions_summary varchar(3000),
    completion_rules varchar(3000),
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE workflow_steps (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    template_id uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    step_order integer NOT NULL,
    step_name varchar(200) NOT NULL,
    step_type varchar(60) NOT NULL,
    approval_mode varchar(60),
    approver_role varchar(80),
    approver_user varchar(320),
    action_type varchar(80),
    notification_audience varchar(80),
    escalation_after_hours integer,
    conditions_summary varchar(3000),
    completion_rule varchar(3000),
    required_step boolean NOT NULL DEFAULT true,
    archived_at timestamptz
);

CREATE TABLE workflow_instance_steps (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    workflow_instance_id uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    template_step_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
    step_order integer NOT NULL,
    step_name varchar(200) NOT NULL,
    step_type varchar(60) NOT NULL,
    approval_mode varchar(60),
    approver varchar(320),
    status varchar(60) NOT NULL,
    started_at timestamptz,
    completed_at timestamptz,
    note varchar(2000)
);

CREATE TABLE workflow_actions (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL,
    workflow_instance_id uuid REFERENCES workflow_instances(id) ON DELETE SET NULL,
    instance_step_id uuid REFERENCES workflow_instance_steps(id) ON DELETE SET NULL,
    action_type varchar(80) NOT NULL,
    action_name varchar(200) NOT NULL,
    payload varchar(5000),
    status varchar(60) NOT NULL,
    executed_at timestamptz,
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE TABLE workflow_conditions (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    template_id uuid REFERENCES workflow_templates(id) ON DELETE CASCADE,
    rule_id uuid,
    field_name varchar(160) NOT NULL,
    operator varchar(80) NOT NULL,
    expected_value varchar(1000),
    description varchar(2000),
    archived_at timestamptz
);

CREATE TABLE workflow_rules (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    rule_name varchar(200) NOT NULL,
    trigger_module varchar(80) NOT NULL,
    trigger_event varchar(120) NOT NULL,
    condition_summary varchar(3000),
    action_summary varchar(3000),
    status varchar(40) NOT NULL,
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

ALTER TABLE workflow_conditions
    ADD CONSTRAINT fk_workflow_conditions_rule
    FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE;

CREATE TABLE workflow_notifications (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    workflow_instance_id uuid REFERENCES workflow_instances(id) ON DELETE CASCADE,
    title varchar(240) NOT NULL,
    message varchar(2000) NOT NULL,
    recipient varchar(320),
    status varchar(60) NOT NULL,
    sent_at timestamptz,
    archived_at timestamptz
);

CREATE TABLE scheduled_jobs (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    job_name varchar(200) NOT NULL,
    job_key varchar(160) NOT NULL UNIQUE,
    frequency varchar(60) NOT NULL,
    cron_expression varchar(120),
    next_run_at timestamptz,
    last_run_at timestamptz,
    status varchar(60) NOT NULL,
    action_summary varchar(3000),
    created_by varchar(320) NOT NULL,
    archived_at timestamptz
);

CREATE INDEX idx_workflow_templates_status ON workflow_templates (status);
CREATE INDEX idx_workflow_templates_type ON workflow_templates (workflow_type);
CREATE INDEX idx_workflow_steps_template ON workflow_steps (template_id, step_order);
CREATE INDEX idx_workflow_instance_steps_instance ON workflow_instance_steps (workflow_instance_id, step_order);
CREATE INDEX idx_workflow_actions_instance ON workflow_actions (workflow_instance_id);
CREATE INDEX idx_workflow_actions_type ON workflow_actions (action_type);
CREATE INDEX idx_workflow_conditions_template ON workflow_conditions (template_id);
CREATE INDEX idx_workflow_conditions_rule ON workflow_conditions (rule_id);
CREATE INDEX idx_workflow_rules_status ON workflow_rules (status);
CREATE INDEX idx_workflow_rules_trigger ON workflow_rules (trigger_module, trigger_event);
CREATE INDEX idx_workflow_notifications_instance ON workflow_notifications (workflow_instance_id);
CREATE INDEX idx_scheduled_jobs_status ON scheduled_jobs (status);
