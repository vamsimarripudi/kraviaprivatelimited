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
    """Keep tests explicit about the development-only bootstrap boundary."""

    original_init = TestClient.__init__

    def init_with_bootstrap_credential(self, app, *args, **kwargs):
        explicit_headers = dict(kwargs.pop("headers", {}) or {})
        headers = {"X-Kravia-Office-Key": TEST_BOOTSTRAP_KEY, **explicit_headers}
        return original_init(self, app, *args, headers=headers, **kwargs)

    monkeypatch.setattr(TestClient, "__init__", init_with_bootstrap_credential)
