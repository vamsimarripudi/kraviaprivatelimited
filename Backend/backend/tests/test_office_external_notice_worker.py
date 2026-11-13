"""Last seven lifecycle routes: no real provider or employee data."""
from uuid import UUID

import pytest

from backend import office_external_notice_worker as worker
from backend import email_delivery


def record(code="EXIT-02", email="former.person@example.net", reference="EXIT_NOTIFICATION:1"):
    return {
        "outbox_id": "11111111-1111-4111-8111-111111111111",
        "claim_token": "22222222-2222-4222-8222-222222222222",
        "event_code": code,
        "recipient_email": email,
        "recipient_name": "Example Employee",
        "source_reference": reference,
    }


def test_external_notice_disabled_by_default_without_database_access(monkeypatch):
    monkeypatch.delenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", raising=False)
    monkeypatch.delenv("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED", raising=False)
    monkeypatch.setattr(worker, "SessionLocal", lambda: pytest.fail("Database touched"))
    monkeypatch.setattr(worker, "send_office_external_lifecycle_notification",
                        lambda **_kwargs: pytest.fail("Provider touched"))
    assert worker.process_external_notice_outbox() == {"status": "DISABLED", "claimed": 0}


@pytest.mark.parametrize("global_flag,external_flag,expected", [
    ("false", "false", False), ("true", "false", False),
    ("false", "true", False), ("true", "true", True),
])
def test_separate_external_notification_opt_in(monkeypatch, global_flag, external_flag, expected):
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", global_flag)
    monkeypatch.setenv("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED", external_flag)
    assert worker.external_notice_enabled() is expected


def test_missing_provider_credentials_prevents_any_claim(monkeypatch):
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    monkeypatch.setattr(worker, "SessionLocal", lambda: pytest.fail("Database touched"))
    assert worker.process_external_notice_outbox()["status"] == "PROVIDER_NOT_CONFIGURED"


def test_only_canonical_event_and_recipient_pair_is_accepted():
    assert worker.validate_external_claim(record()).outbox_id == UUID(
        "11111111-1111-4111-8111-111111111111"
    )
    assert worker.validate_external_claim(record(
        "ONB-04", "employee@kraviaprivatelimited.com", "ONBOARDING_SIGNING:2"
    )).event_code == "ONB-04"
    for invalid in [
        record(code="AUTH-05"),
        record(code="ONB-04"),
        record(email="ex.person@kraviaprivatelimited.com"),
        record(email="bogus"),
        record(reference="office_access_audit:8"),
        record(code="EXIT-08", reference="ONBOARDING_SIGNING:1"),
        record(code="ONB-04", email="signer@example.net", reference="ONBOARDING_SIGNING:1"),
        record(reference="EXIT_NOTIFICATION:0"),
    ]:
        with pytest.raises((RuntimeError, ValueError)):
            worker.validate_external_claim(invalid)


class Result:
    def __init__(self, rows=None, scalar=None):
        self.rows = rows or []
        self.scalar = scalar

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def scalar_one(self):
        return self.scalar


class FakeSession:
    def __init__(self, row, events, permitted=True):
        self.row = row
        self.events = events
        self.permitted = permitted

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, query, params):
        statement = str(query)
        if "office_external_notice_claim" in statement:
            self.events.append(("claim", params["p_limit"]))
            return Result([self.row])
        if "office_external_notice_can_send" in statement:
            self.events.append(("verify", params["p_email"]))
            return Result(scalar=self.permitted)
        if "office_external_notice_finish" in statement:
            self.events.append(("finish", params["p_status"]))
            return Result()
        raise AssertionError("Unexpected query: " + statement)

    def commit(self):
        self.events.append(("commit", None))

    def rollback(self):
        self.events.append(("rollback", None))


def _enable(monkeypatch):
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    monkeypatch.setenv("BREVO_API_KEY", "synthetic-test-only")


def test_claim_commit_then_revalidate_revoked_consent_before_provider(monkeypatch):
    events = []
    _enable(monkeypatch)
    monkeypatch.setattr(worker, "SessionLocal",
                        lambda: FakeSession(record(), events, permitted=False))
    monkeypatch.setattr(worker, "send_office_external_lifecycle_notification",
                        lambda **_kwargs: pytest.fail("Revoked recipient was emailed"))
    result = worker.process_external_notice_outbox()
    assert result["claimed"] == 1 and result["rejected"] == 1
    assert events == [
        ("claim", 10), ("commit", None), ("verify", "former.person@example.net"), ("rollback", None),
        ("finish", "REJECTED"), ("commit", None),
    ]


def test_claim_requires_exact_recipient_address_recheck(monkeypatch):
    events = []
    _enable(monkeypatch)
    monkeypatch.setattr(worker, "SessionLocal", lambda: FakeSession(record(
        "ONB-04", "employee@kraviaprivatelimited.com", "ONBOARDING_SIGNING:2"
    ), events))
    monkeypatch.setattr(worker, "send_office_external_lifecycle_notification",
                        lambda **kwargs: "synthetic-provider-accepted")
    result = worker.process_external_notice_outbox()
    assert result["accepted"] == 1
    assert ("verify", "employee@kraviaprivatelimited.com") in events


def test_provider_timeout_never_triggers_automatic_resubmission(monkeypatch):
    events = []
    calls = []
    _enable(monkeypatch)
    monkeypatch.setattr(worker, "SessionLocal", lambda: FakeSession(record(), events))
    def timeout(**kwargs):
        calls.append(kwargs)
        raise worker.EmailDeliveryUnknown("Provider outcome is unknowable")
    monkeypatch.setattr(worker, "send_office_external_lifecycle_notification", timeout)
    result = worker.process_external_notice_outbox()
    assert result["unknown"] == 1 and len(calls) == 1
    assert events == [
        ("claim", 10), ("commit", None), ("verify", "former.person@example.net"), ("rollback", None),
        ("finish", "UNKNOWN"), ("commit", None),
    ]


def test_template_has_no_dangerous_offboarding_link_or_attachment(monkeypatch):
    submissions = []
    monkeypatch.setattr(email_delivery, "_send_transactional_email",
                        lambda **kw: submissions.append(kw) or "synthetic-accepted")
    assert email_delivery.send_office_external_lifecycle_notification(
        recipient_email="former.person@example.net",
        recipient_name="Former Employee",
        event_code="EXIT-07",
        event_reference="EXIT_DOCUMENT:15",
        delivery_id="11111111-1111-4111-8111-111111111111",
    ) == "synthetic-accepted"
    assert "office/dashboard" not in submissions[0]["template"].html_content
    assert "office/dashboard" not in submissions[0]["template"].text_content
    assert submissions[0]["recipient_email"] == "former.person@example.net"
    for event_code, email in [
        ("EXIT-02", "employee@kraviaprivatelimited.com"),
        ("ONB-04", "person@example.net"),
        ("PAY-08", "former.person@example.net"),
    ]:
        with pytest.raises(worker.EmailDeliveryRejected):
            email_delivery.send_office_external_lifecycle_notification(
                recipient_email=email, recipient_name="Example",
                event_code=event_code,
                event_reference="EXIT_NOTIFICATION:1",
                delivery_id="11111111-1111-4111-8111-111111111111",
            )
