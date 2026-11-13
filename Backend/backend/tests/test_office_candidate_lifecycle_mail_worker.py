from datetime import datetime, timezone
from uuid import uuid4

import pytest

from backend import office_candidate_lifecycle_mail_worker as worker
from backend import email_delivery


def row(event="HIRE-01", email="candidate@example.com", schedule=None):
    return {
        "outbox_id": str(uuid4()),
        "claim_token": str(uuid4()),
        "event_code": event,
        "recipient_email": email,
        "recipient_name": "Synthetic Candidate",
        "source_reference": "office_recruitment_events:123",
        "scheduled_at": schedule,
    }


def test_external_candidate_mail_default_disabled_and_requires_two_opt_ins(monkeypatch):
    monkeypatch.delenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", raising=False)
    monkeypatch.delenv("KRAVIA_CANDIDATE_LIFECYCLE_MAIL_DISPATCH_ENABLED", raising=False)
    assert worker.process_candidate_lifecycle_mail_outbox() == {"status": "DISABLED", "claimed": 0}
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    assert not worker.enabled()
    monkeypatch.setenv("KRAVIA_CANDIDATE_LIFECYCLE_MAIL_DISPATCH_ENABLED", "true")
    assert worker.enabled()
    monkeypatch.setenv("KRAVIA_CANDIDATE_LIFECYCLE_MAIL_DISPATCH_ENABLED", "neither")
    with pytest.raises(RuntimeError, match="Invalid boolean flag"):
        worker.enabled()


def test_external_candidate_claim_validation_and_timezone():
    c = worker.validate_candidate_claim(row())
    assert c.recipient_email == "candidate@example.com"
    assert c.event_code == "HIRE-01"
    when = datetime(2026, 11, 20, 4, 30, tzinfo=timezone.utc)
    meeting = worker.validate_candidate_claim(row(event="HIRE-02", schedule=when))
    assert worker._schedule_label(meeting.scheduled_at) == "20 November 2026 at 10:00 AM IST"
    with pytest.raises(RuntimeError, match="Verified interview date"):
        worker.validate_candidate_claim(row(event="HIRE-03"))
    for malformed in ["candidate@evil.example\nbcc:attacker@evil.example", "not-an-email", "candidate@localhost"]:
        with pytest.raises(RuntimeError):
            worker.validate_candidate_claim(row(email=malformed))
    with pytest.raises(RuntimeError, match="Unapproved candidate"):
        worker.validate_candidate_claim(row(event="AUTH-05"))
    malicious = row()
    malicious["source_reference"] = "office_admin:1"
    with pytest.raises(RuntimeError, match="invalid"):
        worker.validate_candidate_claim(malicious)


def test_external_candidate_template_has_no_office_private_link_or_unsanitized_html(monkeypatch):
    captured = {}

    def fake_send(*, recipient_email, template, delivery_id, tags, **kwargs):
        captured.update(
            to=recipient_email, template=template, id=delivery_id, tags=tags
        )
        return "provider-accepted"

    monkeypatch.setattr(email_delivery, "_send_transactional_email", fake_send)
    message = email_delivery.send_office_candidate_lifecycle_notification(
        recipient_email="candidate@example.com",
        recipient_name="Test <script>alert(1)</script>",
        event_code="HIRE-03",
        event_reference="office_recruitment_events:123",
        delivery_id=str(uuid4()),
        interview_time="20 November 2026 at 10:00 AM IST",
    )
    assert message == "provider-accepted"
    assert "<script>" not in captured["template"].html_content
    assert "&lt;script&gt;" in captured["template"].html_content
    assert "/office/dashboard" not in captured["template"].html_content
    assert "20 November 2026" in captured["template"].text_content
    assert captured["to"] == "candidate@example.com"
    with pytest.raises(email_delivery.EmailDeliveryRejected):
        email_delivery.send_office_candidate_lifecycle_notification(
            recipient_email="candidate@example.com",
            recipient_name="Test Candidate",
            event_code="AUTH-05",
            event_reference="office_recruitment_events:123",
            delivery_id=str(uuid4()),
        )
