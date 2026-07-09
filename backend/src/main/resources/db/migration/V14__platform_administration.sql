CREATE TABLE platform_environments (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    name varchar(120) NOT NULL,
    environment_type varchar(40) NOT NULL,
    url varchar(500),
    version varchar(80),
    build_number varchar(120),
    deployment_date timestamptz,
    status varchar(40) NOT NULL,
    health varchar(40) NOT NULL,
    region varchar(120)
);

CREATE TABLE platform_service_registry (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    service_name varchar(160) NOT NULL,
    version varchar(80),
    status varchar(40) NOT NULL,
    health varchar(40) NOT NULL,
    api_base_url varchar(500),
    owner varchar(320),
    last_deployment timestamptz,
    dependencies varchar(1000)
);

CREATE TABLE platform_releases (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    version varchar(80) NOT NULL,
    release_name varchar(200) NOT NULL,
    release_date date,
    modules_included varchar(2000),
    breaking_changes varchar(3000),
    database_migration_version varchar(120),
    rollback_status varchar(60) NOT NULL
);

CREATE TABLE platform_backups (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    backup_type varchar(40) NOT NULL,
    last_backup_at timestamptz,
    next_scheduled_backup_at timestamptz,
    backup_status varchar(60) NOT NULL,
    backup_size_bytes bigint,
    restore_test_status varchar(60) NOT NULL,
    notes varchar(2000)
);

CREATE TABLE platform_jobs (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    job_name varchar(160) NOT NULL,
    job_type varchar(80) NOT NULL,
    status varchar(60) NOT NULL,
    last_run_at timestamptz,
    next_run_at timestamptz,
    owner varchar(320),
    notes varchar(2000)
);

CREATE TABLE platform_api_registry (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    api_name varchar(160) NOT NULL,
    base_path varchar(300) NOT NULL,
    endpoint_count integer NOT NULL DEFAULT 0,
    version varchar(80),
    authentication_required boolean NOT NULL DEFAULT true,
    status varchar(60) NOT NULL,
    average_response_time_ms integer
);

CREATE INDEX idx_platform_environments_type ON platform_environments (environment_type);
CREATE INDEX idx_platform_environments_status ON platform_environments (status);
CREATE INDEX idx_platform_services_status ON platform_service_registry (status);
CREATE INDEX idx_platform_services_health ON platform_service_registry (health);
CREATE INDEX idx_platform_releases_version ON platform_releases (version);
CREATE INDEX idx_platform_releases_release_date ON platform_releases (release_date DESC);
CREATE INDEX idx_platform_backups_type ON platform_backups (backup_type);
CREATE INDEX idx_platform_backups_status ON platform_backups (backup_status);
CREATE INDEX idx_platform_jobs_status ON platform_jobs (status);
CREATE INDEX idx_platform_jobs_next_run ON platform_jobs (next_run_at);
CREATE INDEX idx_platform_api_registry_status ON platform_api_registry (status);
