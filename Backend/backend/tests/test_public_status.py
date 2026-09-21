from backend import public_status


def test_production_first_party_identity_health_is_ready(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_MODE", "first_party")
    monkeypatch.setenv("OFFICE_AUTH_SIGNING_SECRET", "production-test-signing-secret-at-least-32-characters")
    monkeypatch.setenv("OFFICE_AUTH_BOOTSTRAP_SECRET", "production-test-bootstrap-secret-at-least-32-chars")
    monkeypatch.setattr(public_status, "_database_status", lambda: "healthy")

    assert public_status._identity_status() == "ready"
    snapshot = public_status._health_snapshot()
    assert snapshot["status"] == "healthy"
    assert snapshot["checks"] == {"database": "healthy", "identity": "ready"}

    html = public_status._landing_html(snapshot)
    assert "KRAVIA First-Party Auth" in html
    assert "Signed first-party session verification" in html
    assert "Supabase Auth · OIDC" not in html


def test_production_first_party_identity_health_fails_closed_without_signing_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_MODE", "first_party")
    monkeypatch.delenv("OFFICE_AUTH_SIGNING_SECRET", raising=False)
    monkeypatch.setattr(public_status, "_database_status", lambda: "healthy")

    assert public_status._identity_status() == "misconfigured"
    snapshot = public_status._health_snapshot()
    assert snapshot["status"] == "degraded"


def test_production_oidc_health_still_requires_oidc_configuration(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example")
    monkeypatch.setenv("OIDC_AUDIENCE", "kravia-office-api")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example/.well-known/jwks.json")
    monkeypatch.setattr(public_status, "_database_status", lambda: "healthy")

    assert public_status._identity_status() == "ready"
    assert public_status._health_snapshot()["status"] == "healthy"
