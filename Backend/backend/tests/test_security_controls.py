from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from backend.database import Base
from backend.security_controls import DatabaseFixedWindowRateLimiter, FixedWindowRateLimiter, configure_security


def test_fixed_window_rate_limiter_is_deterministic():
    limiter = FixedWindowRateLimiter(requests=2, window_seconds=60)
    assert limiter.allow("actor", now=100.0) == (True, 1, 0)
    assert limiter.allow("actor", now=101.0) == (True, 0, 0)
    allowed, remaining, retry_after = limiter.allow("actor", now=102.0)
    assert allowed is False
    assert remaining == 0
    assert retry_after > 0
    assert limiter.allow("actor", now=161.0)[0] is True


def test_security_headers_and_cross_origin_mutation_guard(monkeypatch):
    monkeypatch.setenv("OFFICE_ALLOWED_ORIGINS", "https://office.example.test")
    monkeypatch.setenv("OFFICE_MUTATION_RATE_LIMIT", "2")
    monkeypatch.setenv("OFFICE_RATE_LIMIT_WINDOW_SECONDS", "60")
    local = FastAPI()

    @local.get("/health")
    def health():
        return {"ok": True}

    @local.post("/api/mutate")
    def mutate():
        return {"ok": True}

    configure_security(local)
    with TestClient(local) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert "default-src 'self'" in response.headers["content-security-policy"]
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"

        blocked = client.post(
            "/api/mutate",
            headers={"Origin": "https://evil.example.test", "X-Office-Actor": "Security Tester"},
        )
        assert blocked.status_code == 403

        first = client.post(
            "/api/mutate",
            headers={"Origin": "https://office.example.test", "X-Office-Actor": "Security Tester"},
        )
        second = client.post(
            "/api/mutate",
            headers={"Origin": "https://office.example.test", "X-Office-Actor": "Security Tester"},
        )
        third = client.post(
            "/api/mutate",
            headers={"Origin": "https://office.example.test", "X-Office-Actor": "Security Tester"},
        )
        assert first.status_code == 200
        assert second.status_code == 200
        assert third.status_code == 429
        assert int(third.headers["retry-after"]) > 0


def test_database_rate_limiter_is_shared_across_instances(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'shared-rate-limit.db'}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    try:
        first = DatabaseFixedWindowRateLimiter(requests=2, window_seconds=60, db_engine=engine)
        second = DatabaseFixedWindowRateLimiter(requests=2, window_seconds=60, db_engine=engine)
        assert first.allow("same-actor", now=120.0) == (True, 1, 0)
        assert second.allow("same-actor", now=121.0) == (True, 0, 0)
        allowed, remaining, retry_after = first.allow("same-actor", now=122.0)
        assert allowed is False
        assert remaining == 0
        assert retry_after > 0
        assert second.allow("same-actor", now=181.0)[0] is True
    finally:
        engine.dispose()


def test_production_can_require_shared_database_rate_limit(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("OFFICE_RATE_LIMIT_MODE", "local")
    monkeypatch.setenv("OFFICE_REQUIRE_SHARED_RATE_LIMIT", "true")
    local = FastAPI()
    try:
        configure_security(local)
        assert False, "production must reject local-only rate limiting when shared mode is required"
    except RuntimeError as exc:
        assert "shared rate limiting is required" in str(exc)


def test_local_mode_emits_rate_limit_source_header(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("OFFICE_RATE_LIMIT_MODE", "local")
    monkeypatch.setenv("OFFICE_REQUIRE_SHARED_RATE_LIMIT", "false")
    monkeypatch.setenv("OFFICE_MUTATION_RATE_LIMIT", "2")
    local = FastAPI()

    @local.post("/api/mutate")
    def mutate():
        return {"ok": True}

    configure_security(local)
    with TestClient(local) as client:
        response = client.post("/api/mutate", headers={"X-Office-Actor": "Header Tester"})
        assert response.status_code == 200
        assert response.headers["x-ratelimit-source"] == "local"
