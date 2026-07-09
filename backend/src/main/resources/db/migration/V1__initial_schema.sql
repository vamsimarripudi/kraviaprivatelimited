CREATE TABLE roles (
    name varchar(40) PRIMARY KEY
);

INSERT INTO roles (name) VALUES ('FOUNDER'), ('DIRECTOR'), ('VIEWER');

CREATE TABLE users (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    email varchar(320) NOT NULL UNIQUE,
    display_name varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name varchar(40) NOT NULL REFERENCES roles(name),
    PRIMARY KEY (user_id, role_name)
);

CREATE TABLE company_profile (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    company_name varchar(255),
    cin varchar(80),
    pan varchar(80),
    tan varchar(80),
    registered_office_address text,
    email varchar(320),
    phone varchar(80),
    date_of_incorporation date,
    authorized_capital varchar(120),
    paid_up_capital varchar(120),
    directors text,
    shareholders text,
    company_status varchar(120),
    last_updated_date date
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    actor_email varchar(320) NOT NULL,
    actor_name varchar(255) NOT NULL,
    actor_roles varchar(255) NOT NULL,
    module varchar(80) NOT NULL,
    action varchar(120) NOT NULL,
    description text NOT NULL,
    severity varchar(40) NOT NULL
);

CREATE INDEX idx_users_email ON users (lower(email));
CREATE INDEX idx_user_roles_role_name ON user_roles (role_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_module ON audit_logs (module);
