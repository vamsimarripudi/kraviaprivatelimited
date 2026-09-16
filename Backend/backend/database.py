import os
import re
from urllib.parse import quote, unquote

from sqlalchemy import create_engine
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


def _route_supabase_pooler(normalized_url: str) -> str:
    """Route a Supabase direct URL through an explicitly configured IPv4 pooler.

    Supabase direct Postgres endpoints are IPv6 by default. Deployments running on
    IPv4-only networks can set ``SUPABASE_POOLER_HOST`` to the project's Shared
    Pooler host. The database password is reused in-memory; it is never duplicated
    into another deployment variable.
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
    username = parsed.username or "postgres"
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

    return _route_supabase_pooler(normalized)


DATABASE_URL = normalize_database_url(
    os.getenv("DATABASE_URL", "sqlite:///./kravia_office.db")
)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    connect_args=connect_args,
)
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
