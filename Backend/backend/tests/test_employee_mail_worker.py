"""KRAVIA corporate employee-ID mail is explicit, private and idempotent."""
from __future__ import annotations

import re
from uuid import UUID

import pytest

from backend import office_employee_mail_worker as mail
from backend.email_delivery import EmailDeliveryRejected, EmailDeliveryUnknown
from backend.email_templates import office_employee_id_issued_template


def test_employee_mail_delivery_is_disabled_until_corporate_approval(monkeypatch):
    monkeypatch.delenv("KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    assert mail.process_employee_mail_outbox() == {"status": "DISABLED", "claimed": 0}
    monkeypatch.setenv("KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED", "true")
    assert mail.process_employee_mail_outbox() == {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0}


def test_employment_reference_email_escapes_html_and_rejects_bad_refs():
    rendered = office_employee_id_issued_template(
        recipient_name='<script>alert(1)</script>',
        employee_reference="KRV-E26-0123456789ABCDEF",
    )
    assert "Your permanent KRAVIA employee reference" in rendered.subject
    assert "<script>alert(1)</script>" not in rendered.html_content
    assert "&lt;script&gt;" in rendered.html_content
    assert "KRV-E26-0123456789ABCDEF" in rendered.html_content
    assert "KRV-E26-0123456789ABCDEF" in rendered.text_content
    assert "kravia-header-lockup-v2.png" in rendered.html_content
    assert "bank account" not in rendered.text_content.lower()
    assert "salar" not in rendered.subject.lower()
    assert "<script" not in rendered.html_content.lower()
    assert "javascript:" not in rendered.html_content.lower()
    with pytest.raises(ValueError):
        office_employee_id_issued_template(recipient_name="Colleague",employee_reference="KRV-E26-INVALID")


class _Result:
    def __init__(self, rows):
        self.rows = rows
    def mappings(self):
        return self
    def all(self):
        return list(self.rows)


class _FakeSession:
    def __init__(self, factory):
        self.factory = factory
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc, tb):
        return False
    def execute(self, statement, values):
        query = str(statement)
        self.factory.commands.append((query, dict(values)))
        if "office_employee_mail_claim" in query:
            return _Result(self.factory.claims)
        assert "office_employee_mail_finish" in query
        return _Result([])
    def commit(self):
        self.factory.commits += 1


class _Factory:
    def __init__(self, claims):
        self.claims = claims
        self.commands = []
        self.commits = 0
    def __call__(self):
        return _FakeSession(self)


def _approved():
    return [{
        "outbox_id": UUID("11000000-0000-4000-8000-000000000001"),
        "claim_token": UUID("22000000-0000-4000-8000-000000000002"),
        "recipient_email": "synthetic.employee@kraviaprivatelimited.com",
        "reference_code": "KRV-E26-0123456789ABCDEF",
        "recipient_name": "Synthetic Employee",
    }]


@pytest.mark.parametrize(
    "sender_result,expected_outcome,expected_count",
    [
        ("ci-provider-message", "SENT", "accepted"),
        (EmailDeliveryRejected("definitive refusal"), "REJECTED", "rejected"),
        (EmailDeliveryUnknown("outcome unknown"), "UNKNOWN", "unknown"),
    ],
)
def test_worker_finalizes_only_one_claim_without_duplicate_retries(monkeypatch, sender_result, expected_outcome, expected_count):
    monkeypatch.setenv("KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("BREVO_API_KEY", "ci-fake-value-never-used")
    factory = _Factory(_approved())
    monkeypatch.setattr(mail, "SessionLocal", factory)
    sent = []

    def fake_sender(**kwargs):
        sent.append(kwargs)
        if isinstance(sender_result, Exception):
            raise sender_result
        return sender_result

    monkeypatch.setattr(mail, "send_office_employee_id_issued_email", fake_sender)
    result = mail.process_employee_mail_outbox(limit=7)
    assert result["status"] == "PROCESSED"
    assert result["claimed"] == 1
    assert result[expected_count] == 1
    assert factory.commits == 2
    assert len(sent) == 1
    assert sent[0]["recipient_email"] == "synthetic.employee@kraviaprivatelimited.com"
    assert sent[0]["delivery_id"] == "11000000-0000-4000-8000-000000000001"
    assert len(factory.commands) == 2
    assert factory.commands[1][1]["outcome"] == expected_outcome
    assert re.fullmatch(r"[0-9a-f-]{36}", factory.commands[1][1]["claim_token"])
    assert "recipient_email" not in repr(result)
