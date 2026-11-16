"""The isolated Brevo worker cannot send without independent approval gates."""
import json

import pytest

from backend import mail_worker


@pytest.fixture(autouse=True)
def reset_worker(monkeypatch):
    monkeypatch.delenv("KRAVIA_MAIL_WORKER_ENABLED", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)


def test_defaults_to_disabled_without_touching_database_or_email(monkeypatch):
    monkeypatch.setattr(mail_worker, "DISPATCHERS", (("not_called", lambda _: pytest.fail("worker must remain disabled")),))
    assert mail_worker.process_mail_once() == {"status": "DISABLED", "claimed": 0, "provider": "BREVO"}


def test_requires_provider_configuration(monkeypatch):
    monkeypatch.setenv("KRAVIA_MAIL_WORKER_ENABLED", "true")
    monkeypatch.setattr(mail_worker, "DISPATCHERS", (("not_called", lambda _: pytest.fail("no provider")),))
    assert mail_worker.process_mail_once()["status"] == "PROVIDER_NOT_CONFIGURED"


def test_dispatchers_report_sanitized_aggregate_counts(monkeypatch):
    monkeypatch.setenv("KRAVIA_MAIL_WORKER_ENABLED", "true")
    monkeypatch.setenv("BREVO_API_KEY", "synthetic-test-only-secret")
    called = []
    def worker(batch):
        called.append(batch)
        return {"status": "PROCESSED", "claimed": 1, "accepted": 1, "recipient_email": "private@example.com"}

    monkeypatch.setattr(mail_worker, "DISPATCHERS", (("approved_source", worker),))
    result = mail_worker.process_mail_once(500)
    assert called == [25]
    assert result["status"] == "COMPLETED"
    assert result["claimed"] == 1
    assert result["channels"]["approved_source"]["accepted"] == 1
    assert "private@example.com" not in json.dumps(result)
    assert "synthetic-test-only-secret" not in json.dumps(result)


def test_unknown_delivery_is_never_retried_by_mail_wrapper(monkeypatch):
    monkeypatch.setenv("KRAVIA_MAIL_WORKER_ENABLED", "true")
    monkeypatch.setenv("BREVO_API_KEY", "synthetic-test-only-secret")
    calls = []
    def ambiguous(_batch):
        calls.append(1)
        raise RuntimeError("Message could already have been accepted by provider private@example.com")

    monkeypatch.setattr(mail_worker, "DISPATCHERS", (("broken", ambiguous),))
    result = mail_worker.process_mail_once()
    assert result["status"] == "NEEDS_RECONCILIATION"
    assert result["channels"]["broken"]["error_type"] == "RuntimeError"
    assert len(calls) == 1
    assert "private@example.com" not in json.dumps(result)


def test_invalid_global_flag_fails_closed(monkeypatch):
    monkeypatch.setenv("KRAVIA_MAIL_WORKER_ENABLED", "maybe")
    with pytest.raises(RuntimeError, match="Invalid mail-worker flag"):
        mail_worker.process_mail_once()
