"""Candidate-notification tests: no outgoing mail without independent opt-in."""
from datetime import datetime, timezone
from uuid import UUID

import pytest

from backend import office_candidate_mail_worker as worker
from backend.office_candidate_lifecycle_templates import render_office_candidate_notice


def _record(code="HIRE-01", email="candidate@example.test", when=None):
    return {
        "outbox_id": "11111111-1111-4111-8111-111111111111",
        "claim_token": "22222222-2222-4222-8222-222222222222",
        "event_code": code,
        "recipient_email": email,
        "recipient_name": "Candidate Example",
        "source_reference": "KR-CAN-0000001:8",
        "interview_time": when,
    }


def test_disabled_by_default_never_queries_database_or_calls_provider(monkeypatch):
    monkeypatch.delenv("KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED", raising=False)
    monkeypatch.delenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", raising=False)
    monkeypatch.setattr(worker, "SessionLocal", lambda: pytest.fail("Database touched"))
    monkeypatch.setattr(worker, "send_office_candidate_lifecycle_notification", lambda **_kw: pytest.fail("Provider touched"))
    assert worker.process_candidate_mail_outbox() == {"status": "DISABLED", "claimed": 0}


@pytest.mark.parametrize("global_flag,candidate_flag,expected", [
    ("true", "false", False),
    ("false", "true", False),
    ("false", "false", False),
    ("true", "true", True),
])
def test_separate_candidate_opt_in_is_mandatory(monkeypatch, global_flag, candidate_flag, expected):
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", global_flag)
    monkeypatch.setenv("KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED", candidate_flag)
    assert worker.candidate_mail_enabled() is expected


def test_without_provider_credentials_cannot_claim(monkeypatch):
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    monkeypatch.setattr(worker, "SessionLocal", lambda: pytest.fail("Database touched"))
    assert worker.process_candidate_mail_outbox()["status"] == "PROVIDER_NOT_CONFIGURED"


def test_claim_requires_canonical_candidate_reference_and_timed_interviews():
    assert worker.validate_claim(_record()).outbox_id == UUID("11111111-1111-4111-8111-111111111111")
    now = datetime(2026, 11, 16, 15, 30, tzinfo=timezone.utc)
    assert worker.validate_claim(_record(code="HIRE-02", when=now)).interview_time == now
    assert worker._interview_time_label(now).endswith("IST")
    for invalid in [
        _record("HIRE-07"),
        _record(email="bad address"),
        {**_record(), "source_reference": "office_access_audit:8"},
        _record(code="HIRE-02"),
        _record(code="HIRE-03", when=datetime(2026, 11, 16)),
        _record(code="HIRE-10", when=now),
    ]:
        with pytest.raises((RuntimeError, ValueError)):
            worker.validate_claim(invalid)


def test_candidate_notice_escapes_names_and_has_no_employee_or_document_link():
    rendered = render_office_candidate_notice(
        event_code="HIRE-02",
        recipient_name="<script>alert(7)</script>",
        interview_time="16 November 2026 at 09:00 AM IST",
    )
    assert "&lt;script&gt;" in rendered.html_content
    assert "<script>" not in rendered.html_content
    assert "office/dashboard" not in rendered.html_content
    assert "http" not in rendered.text_content.lower()
    assert "09:00 AM IST" in rendered.text_content
    with pytest.raises(ValueError):
        render_office_candidate_notice(event_code="HIRE-07", recipient_name="Candidate Example")


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return self

    def all(self):
        return self._rows


class _Db:
    def __init__(self, record, events):
        self.record = record
        self.events = events

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, sql, params):
        expression = str(sql)
        if "office_candidate_mail_claim" in expression:
            self.events.append(("claim", params["p_limit"]))
            return _Result([self.record])
        if "office_candidate_mail_finish" in expression:
            self.events.append(("finish", params["outcome"]))
            return _Result([])
        raise AssertionError("Unknown database statement")

    def commit(self):
        self.events.append(("commit", None))


def test_claim_is_committed_before_network_and_never_automatically_retried(monkeypatch):
    row = _record()
    events = []
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("BREVO_API_KEY", "synthetic-test-only")
    monkeypatch.setattr(worker, "SessionLocal", lambda: _Db(row, events))
    def _provider(**options):
        assert events[:2] == [("claim", 10), ("commit", None)]
        assert options["recipient_email"] == "candidate@example.test"
        events.append(("send", None))
        raise worker.EmailDeliveryUnknown("Synthetic provider timeout")
    monkeypatch.setattr(worker, "send_office_candidate_lifecycle_notification", _provider)
    result = worker.process_candidate_mail_outbox()
    assert result["claimed"] == 1
    assert result["unknown"] == 1
    assert events == [
        ("claim", 10), ("commit", None), ("send", None),
        ("finish", "UNKNOWN"), ("commit", None)
    ]
