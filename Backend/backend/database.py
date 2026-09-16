import os
from urllib.parse import quote, unquote

from sqlalchemy import create_engine
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


def normalize_database_url(raw_url: str) -> str:
    """Canonicalize provider PostgreSQL URLs for the installed psycopg v3 driver."""
    if raw_url.startswith("postgres://"):
        connection = raw_url[len("postgres://") :]
        return f"postgresql+psycopg://{_normalize_postgresql_credentials(connection)}"
    if raw_url.startswith("postgresql://"):
        connection = raw_url[len("postgresql://") :]
        return f"postgresql+psycopg://{_normalize_postgresql_credentials(connection)}"
    return raw_url


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
