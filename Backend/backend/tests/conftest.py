"""Shared test-only credential wiring for the canonical Office API."""

import os

import pytest
from fastapi.testclient import TestClient


TEST_BOOTSTRAP_KEY = "test-office-bootstrap-key-for-fastapi-suite-0001"
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("AUTH_MODE", "bootstrap")
os.environ.setdefault("OFFICE_BOOTSTRAP_KEY", TEST_BOOTSTRAP_KEY)


@pytest.fixture(autouse=True)
def canonical_api_test_client_uses_bootstrap_credential(monkeypatch):
    """Isolate bootstrap clients and their process-local mutation limiter."""

    # Test modules share the canonical ASGI instance. Its development-only
    # fixed-window limiter must retain its real behaviour within each test, but
    # a previous test must not consume another test's request budget.
    from backend.app import app

    limiter = getattr(app.state, "office_local_rate_limiter", None)
    if limiter is not None:
        limiter.clear()

    original_init = TestClient.__init__

    def init_with_bootstrap_credential(self, app, *args, **kwargs):
        explicit_headers = dict(kwargs.pop("headers", {}) or {})
        headers = {"X-Kravia-Office-Key": TEST_BOOTSTRAP_KEY, **explicit_headers}
        return original_init(self, app, *args, headers=headers, **kwargs)

    monkeypatch.setattr(TestClient, "__init__", init_with_bootstrap_credential)
    yield
    if limiter is not None:
        limiter.clear()
