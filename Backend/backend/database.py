import os
import re
from urllib.parse import quote, unquote

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker


def _normalize_postgresql_credentials(connection: str) -> str:
    """Percent-encode PostgreSQL userinfo without exposing or rotating credentials.

    Provider connection strings are sometimes pasted with reserved URL characters
    (notably ``@``) left unescaped in the password. SQLAlchemy then treats part of
    the password as the hostname. Splitting on the final ``@`` identifies the
    network authority delimiter while preserving any earlier ``@`` characters in
    the credential, after which userinfo is canonicalized safely.
    """
    if "@" not in connection:
        return connection

    userinfo, host_and_path = connection.rsplit("@", 1)
    if ":" not in userinfo:
        return f"{quote(unquote(userinfo), safe='')}@{host_and_path}"

    username, password = userinfo.split(":", 1)
    encoded_username = quote(unquote(username), safe="")
    encoded_password = quote(unquote(password), safe="")
    return f"{encoded_username}:{encoded_password}@{host_and_path}"


def _normalize_postgresql_query_options(normalized_url: str) -> str:
    """Canonicalize common PostgreSQL URI option typos before driver parsing."""
    return re.sub(r"([?&])sshmode=", r"\1sslmode=", normalized_url)


def _route_supabase_pooler(normalized_url: str) -> str:
    """Route a Supabase direct URL through an explicitly configured IPv4 pooler.

    Supabase direct Postgres endpoints are IPv6 by default. Deployments running on
    IPv4-only networks can set ``SUPABASE_POOLER_HOST`` to the project's Shared
    Pooler host. ``SUPABASE_POOLER_USER`` can select a dedicated database role
    without copying the database password into another deployment variable. The
    existing password is reused in-memory only.
    """
    pooler_host = os.getenv("SUPABASE_POOLER_HOST", "").strip()
    if not pooler_host or not normalized_url.startswith("postgresql+psycopg://"):
        return normalized_url

    parsed = make_url(normalized_url)
    host = parsed.host or ""
    match = re.fullmatch(r"db\.([a-z0-9]+)\.supabase\.co", host)
    if not match:
        return normalized_url

    project_ref = match.group(1)
    username = os.getenv("SUPABASE_POOLER_USER", "").strip() or parsed.username or "postgres"
    tenant_suffix = f".{project_ref}"
    if not username.endswith(tenant_suffix):
        username = f"{username}{tenant_suffix}"

    pooler_port = int(os.getenv("SUPABASE_POOLER_PORT", "5432"))
    routed = parsed.set(
        username=username,
        host=pooler_host,
        port=pooler_port,
    )
    return routed.render_as_string(hide_password=False)


DATABASE_ROLE_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]{0,62}$")


def database_execution_role() -> str | None:
    """Return the validated least-privilege role used inside DB transactions."""
    role = os.getenv("DATABASE_EXECUTION_ROLE", "").strip()
    if not role:
        return None
    if not DATABASE_ROLE_PATTERN.fullmatch(role):
        raise RuntimeError("DATABASE_EXECUTION_ROLE contains an invalid PostgreSQL role name")
    return role


def configure_database_execution_role(target_engine):
    """Apply SET LOCAL ROLE at every PostgreSQL transaction boundary.

    Railway/Supavisor may authenticate with a provider-managed login while the
    application must execute under a narrower role. SET LOCAL ROLE is scoped to
    the current transaction and is therefore safe with pooled connections.
    """
    role = database_execution_role()
    if not role or target_engine.dialect.name != "postgresql":
        return target_engine

    statement = f'SET LOCAL ROLE "{role}"'

    def _set_local_role(connection):
        connection.exec_driver_sql(statement)

    event.listen(target_engine, "begin", _set_local_role)
    return target_engine


def normalize_database_url(raw_url: str) -> str:
    """Canonicalize provider PostgreSQL URLs for the installed psycopg v3 driver."""
    if raw_url.startswith("postgres://"):
        connection = raw_url[len("postgres://") :]
        normalized = f"postgresql+psycopg://{_normalize_postgresql_credentials(connection)}"
    elif raw_url.startswith("postgresql://"):
        connection = raw_url[len("postgresql://") :]
        normalized = f"postgresql+psycopg://{_normalize_postgresql_credentials(connection)}"
    else:
        normalized = raw_url

    normalized = _normalize_postgresql_query_options(normalized)
    return _route_supabase_pooler(normalized)


DATABASE_URL = normalize_database_url(
    os.getenv("DATABASE_URL", "sqlite:///./kravia_office.db")
)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

app_env = os.getenv("APP_ENV", "development").strip().lower()
engine_options = {
    "future": True,
    "connect_args": connect_args,
    # Supavisor already protects the network boundary. In production, avoid an
    # extra SELECT 1 on every pool checkout; recycle connections instead.
    "pool_pre_ping": os.getenv(
        "DATABASE_POOL_PRE_PING",
        "false" if app_env == "production" else "true",
    ).strip().lower() == "true",
}
if DATABASE_URL.startswith("postgresql+psycopg://"):
    engine_options.update(
        pool_size=max(1, int(os.getenv("DATABASE_POOL_SIZE", "5"))),
        max_overflow=max(0, int(os.getenv("DATABASE_MAX_OVERFLOW", "5"))),
        pool_timeout=max(1.0, float(os.getenv("DATABASE_POOL_TIMEOUT_SECONDS", "5"))),
        pool_recycle=max(30, int(os.getenv("DATABASE_POOL_RECYCLE_SECONDS", "240"))),
        pool_use_lifo=True,
    )

engine = configure_database_execution_role(create_engine(DATABASE_URL, **engine_options))
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
