import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def normalize_database_url(raw_url: str) -> str:
    """Use the installed psycopg v3 driver for provider-style PostgreSQL URLs."""
    if raw_url.startswith("postgres://"):
        return f"postgresql+psycopg://{raw_url[len('postgres://') :]}"
    if raw_url.startswith("postgresql://"):
        return f"postgresql+psycopg://{raw_url[len('postgresql://') :]}"
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
