from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.security_controls import FixedWindowRateLimiter, configure_security


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
