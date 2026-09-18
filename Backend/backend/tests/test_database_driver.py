from sqlalchemy import create_engine

from backend import database
from backend.database import configure_database_execution_role, database_execution_role, normalize_database_url


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


def test_misspelled_sshmode_is_normalized_for_psycopg(monkeypatch):
    _clear_pooler_env(monkeypatch)
    normalized = normalize_database_url(
        "postgresql://user:pass@localhost:5432/db?sshmode=require"
    )
    engine = create_engine(normalized)
    try:
        assert engine.url.query["sslmode"] == "require"
        assert "sshmode" not in engine.url.query
    finally:
        engine.dispose()


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



def test_database_execution_role_is_optional_and_validated(monkeypatch):
    monkeypatch.delenv("DATABASE_EXECUTION_ROLE", raising=False)
    assert database_execution_role() is None

    monkeypatch.setenv("DATABASE_EXECUTION_ROLE", "kravia_office_backend")
    assert database_execution_role() == "kravia_office_backend"

    monkeypatch.setenv("DATABASE_EXECUTION_ROLE", "backend;drop role postgres")
    try:
        database_execution_role()
    except RuntimeError as exc:
        assert "invalid PostgreSQL role name" in str(exc)
    else:
        raise AssertionError("invalid execution role must fail closed")


def test_execution_role_listener_uses_transaction_scoped_set_local_role(monkeypatch):
    monkeypatch.setenv("DATABASE_EXECUTION_ROLE", "kravia_office_backend")
    captured = {}

    class FakeDialect:
        name = "postgresql"

    class FakeEngine:
        dialect = FakeDialect()

    def fake_listen(target, event_name, callback):
        captured["target"] = target
        captured["event_name"] = event_name
        captured["callback"] = callback

    monkeypatch.setattr(database.event, "listen", fake_listen)
    engine = FakeEngine()
    assert configure_database_execution_role(engine) is engine
    assert captured["target"] is engine
    assert captured["event_name"] == "begin"

    statements = []

    class FakeConnection:
        def exec_driver_sql(self, statement):
            statements.append(statement)

    captured["callback"](FakeConnection())
    assert statements == ['SET LOCAL ROLE "kravia_office_backend"']


def test_execution_role_listener_is_not_installed_for_sqlite(monkeypatch):
    monkeypatch.setenv("DATABASE_EXECUTION_ROLE", "kravia_office_backend")

    class FakeDialect:
        name = "sqlite"

    class FakeEngine:
        dialect = FakeDialect()

    def unexpected_listen(*_args, **_kwargs):
        raise AssertionError("SQLite must not install a PostgreSQL role listener")

    monkeypatch.setattr(database.event, "listen", unexpected_listen)
    engine = FakeEngine()
    assert configure_database_execution_role(engine) is engine


def test_alembic_uses_same_execution_role_boundary():
    from pathlib import Path

    env_source = (
        Path(__file__).resolve().parents[1] / "migrations" / "env.py"
    ).read_text(encoding="utf-8")
    assert "configure_database_execution_role" in env_source
    assert "connectable = configure_database_execution_role(" in env_source
