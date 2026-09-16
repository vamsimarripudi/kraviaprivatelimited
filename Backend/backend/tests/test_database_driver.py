from sqlalchemy import create_engine

from backend.database import normalize_database_url


def _clear_pooler_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_POOLER_HOST", raising=False)
    monkeypatch.delenv("SUPABASE_POOLER_PORT", raising=False)
    monkeypatch.delenv("SUPABASE_POOLER_USER", raising=False)


def test_provider_postgresql_url_uses_installed_psycopg_driver(monkeypatch):
    _clear_pooler_env(monkeypatch)
    normalized = normalize_database_url("postgresql://kravia:secret@localhost:5432/office")
    assert normalized == "postgresql+psycopg://kravia:secret@localhost:5432/office"

    engine = create_engine(normalized)
    try:
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
    finally:
        engine.dispose()


def test_legacy_postgres_scheme_is_normalized(monkeypatch):
    _clear_pooler_env(monkeypatch)
    assert normalize_database_url("postgres://user:pass@localhost/db") == (
        "postgresql+psycopg://user:pass@localhost/db"
    )


def test_unescaped_reserved_password_characters_are_canonicalized(monkeypatch):
    _clear_pooler_env(monkeypatch)
    raw = (
        "postgresql://postgres:pa@ss:word/with?reserved#chars@"
        "db.example.supabase.co:5432/postgres"
    )
    normalized = normalize_database_url(raw)
    assert normalized == (
        "postgresql+psycopg://postgres:"
        "pa%40ss%3Aword%2Fwith%3Freserved%23chars@"
        "db.example.supabase.co:5432/postgres"
    )

    engine = create_engine(normalized)
    try:
        assert engine.url.host == "db.example.supabase.co"
        assert engine.url.username == "postgres"
        assert engine.url.password == "pa@ss:word/with?reserved#chars"
    finally:
        engine.dispose()


def test_existing_percent_encoding_is_not_double_encoded(monkeypatch):
    _clear_pooler_env(monkeypatch)
    normalized = normalize_database_url(
        "postgresql://user:p%40ss%2Fword@localhost:5432/db"
    )
    assert normalized == (
        "postgresql+psycopg://user:p%40ss%2Fword@localhost:5432/db"
    )


def test_supabase_direct_url_can_route_to_ipv4_session_pooler(monkeypatch):
    monkeypatch.setenv(
        "SUPABASE_POOLER_HOST",
        "aws-0-ap-south-1.pooler.supabase.com",
    )
    monkeypatch.setenv("SUPABASE_POOLER_PORT", "5432")
    monkeypatch.delenv("SUPABASE_POOLER_USER", raising=False)

    normalized = normalize_database_url(
        "postgresql://postgres:p%40ss@db.abcdefghijklmnopqrst.supabase.co:5432/postgres"
    )
    engine = create_engine(normalized)
    try:
        assert engine.url.host == "aws-0-ap-south-1.pooler.supabase.com"
        assert engine.url.port == 5432
        assert engine.url.username == "postgres.abcdefghijklmnopqrst"
        assert engine.url.password == "p@ss"
        assert engine.dialect.driver == "psycopg"
    finally:
        engine.dispose()


def test_supabase_pooler_can_select_dedicated_service_role(monkeypatch):
    monkeypatch.setenv(
        "SUPABASE_POOLER_HOST",
        "aws-0-ap-south-1.pooler.supabase.com",
    )
    monkeypatch.setenv("SUPABASE_POOLER_PORT", "5432")
    monkeypatch.setenv("SUPABASE_POOLER_USER", "kravia_office_backend")

    normalized = normalize_database_url(
        "postgresql://postgres:p%40ss@db.abcdefghijklmnopqrst.supabase.co:5432/postgres"
    )
    engine = create_engine(normalized)
    try:
        assert engine.url.host == "aws-0-ap-south-1.pooler.supabase.com"
        assert engine.url.port == 5432
        assert engine.url.username == "kravia_office_backend.abcdefghijklmnopqrst"
        assert engine.url.password == "p@ss"
    finally:
        engine.dispose()


def test_pooler_override_does_not_rewrite_non_supabase_database(monkeypatch):
    monkeypatch.setenv(
        "SUPABASE_POOLER_HOST",
        "aws-0-ap-south-1.pooler.supabase.com",
    )
    monkeypatch.setenv("SUPABASE_POOLER_USER", "kravia_office_backend")
    normalized = normalize_database_url(
        "postgresql://user:pass@postgres.internal:5432/app"
    )
    assert normalized == "postgresql+psycopg://user:pass@postgres.internal:5432/app"


def test_explicit_driver_and_sqlite_urls_are_preserved(monkeypatch):
    _clear_pooler_env(monkeypatch)
    explicit = "postgresql+psycopg://user:pass@localhost/db"
    sqlite = "sqlite:///./kravia_office.db"
    assert normalize_database_url(explicit) == explicit
    assert normalize_database_url(sqlite) == sqlite
