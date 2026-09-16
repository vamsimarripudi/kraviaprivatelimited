from sqlalchemy import create_engine

from backend.database import normalize_database_url


def test_provider_postgresql_url_uses_installed_psycopg_driver():
    normalized = normalize_database_url("postgresql://kravia:secret@localhost:5432/office")
    assert normalized == "postgresql+psycopg://kravia:secret@localhost:5432/office"

    engine = create_engine(normalized)
    try:
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
    finally:
        engine.dispose()


def test_legacy_postgres_scheme_is_normalized():
    assert normalize_database_url("postgres://user:pass@localhost/db") == (
        "postgresql+psycopg://user:pass@localhost/db"
    )


def test_explicit_driver_and_sqlite_urls_are_preserved():
    explicit = "postgresql+psycopg://user:pass@localhost/db"
    sqlite = "sqlite:///./kravia_office.db"
    assert normalize_database_url(explicit) == explicit
    assert normalize_database_url(sqlite) == sqlite
