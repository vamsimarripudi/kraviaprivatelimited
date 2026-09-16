from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.public_status as public_status
from backend.public_status import register_public_status
from backend.security_controls import BROWSER_ENTRY_PATHS


def test_backend_landing_exposes_safe_architecture_only(monkeypatch):
    monkeypatch.setattr(public_status, "_database_status", lambda: "healthy")
    monkeypatch.setattr(public_status, "_identity_status", lambda: "ready")
    app = FastAPI()
    register_public_status(app)

    response = TestClient(app).get("/")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store, max-age=0"
    robots = {directive.strip() for directive in response.headers["x-robots-tag"].split(",")}
    assert robots == {"noindex", "nofollow", "noarchive"}
    body = response.text
    assert "KRAVIA Office Backend" in body
    assert "FastAPI" in body
    assert "Supabase" in body
    assert "Railway" in body
    assert "Private interfaces stay private" in body
    assert "/api/v1/" not in body
    assert "DATABASE_URL" not in body
    assert "OIDC_JWKS_URL" not in body
    assert "xjtazosozxmudkbxqhjl" not in body


def test_health_is_minimal_and_fail_closed(monkeypatch):
    monkeypatch.setattr(public_status, "_database_status", lambda: "unavailable")
    monkeypatch.setattr(public_status, "_identity_status", lambda: "ready")
    app = FastAPI()
    register_public_status(app)

    response = TestClient(app).get("/health")
    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store, max-age=0"
    payload = response.json()
    assert payload["status"] == "degraded"
    assert payload["checks"] == {"database": "unavailable", "identity": "ready"}
    assert set(payload) == {"status", "service", "version", "environment", "checks", "timestamp"}
    serialized = response.text
    assert "password" not in serialized.lower()
    assert "hostname" not in serialized.lower()
    assert "database_url" not in serialized.lower()


def test_liveness_does_not_depend_on_external_services(monkeypatch):
    def fail_if_called():
        raise AssertionError("liveness must not query the database")

    monkeypatch.setattr(public_status, "_database_status", fail_if_called)
    monkeypatch.setattr(public_status, "_identity_status", fail_if_called)
    app = FastAPI()
    register_public_status(app)

    response = TestClient(app).get("/health/live")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store, max-age=0"
    assert response.json() == {"status": "ok", "service": "kravia-office-backend"}


def test_backend_root_is_public_metadata_not_legacy_login_entry():
    assert "/" not in BROWSER_ENTRY_PATHS
    assert "/index.html" in BROWSER_ENTRY_PATHS
    assert "/finance.html" in BROWSER_ENTRY_PATHS
