ALTER TABLE users ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until timestamptz;
ALTER TABLE users ADD COLUMN last_login_at timestamptz;

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(128) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_by_ip varchar(80)
);

CREATE TABLE backup_runs (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    backup_name varchar(255) NOT NULL,
    storage_location varchar(600),
    status varchar(40) NOT NULL,
    started_at timestamptz NOT NULL,
    completed_at timestamptz,
    notes text
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens (revoked_at);
CREATE INDEX idx_users_locked_until ON users (locked_until);
CREATE INDEX idx_backup_runs_status ON backup_runs (status);
CREATE INDEX idx_backup_runs_started_at ON backup_runs (started_at DESC);
