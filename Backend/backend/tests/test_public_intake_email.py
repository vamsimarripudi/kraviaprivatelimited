import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend import identity_auth, public_intake_email
from backend.email_delivery import EmailDeliveryUnknown
from backend.tests.test_identity_auth import make_client


PUBLIC_SECRET = "test-public-intake-webhook-secret-at-least-32-characters"
PAYLOAD = {
    "event_id": "public-contact:KRV-ABCDEF0123456789ABCDEF01",
    "form_kind": "CONTACT",
    "reference": "KRV-ABCDEF0123456789ABCDEF01",
    "recipient_email": "recipient@example.test",
    "recipient_name": "Synthetic Recipient",
    "request_subject": "Synthetic public request",
    "organisation": "Synthetic Organisation",
}
FOLLOW_UP_PAYLOAD = {
    **PAYLOAD,
    "event_id": "public-followup:KRV-ABCDEF0123456789ABCDEF01:00000000-0000-0000-0000-000000000001",
    "message": "Synthetic reviewed reply. No sensitive data is included.",
}


def public_client(tmp_path, monkeypatch):
    _, engine = make_client(tmp_path, monkeypatch)
    monkeypatch.setenv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", PUBLIC_SECRET)
    # Reuse the fixture's database by creating a focused ASGI app with the same
    # session factory exposed through its identity router dependency override.
    from sqlalchemy.orm import sessionmaker

    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    def test_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(public_intake_email.build_public_intake_email_router(identity_auth.get_db))
    app.dependency_overrides[identity_auth.get_db] = test_db
    return TestClient(app), engine


def signed_request(payload=PAYLOAD, *, signature=True):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    timestamp = "1700000000"
    headers = {
        "content-type": "application/json",
        "x-kravia-intake-timestamp": timestamp,
        "x-kravia-intake-signature": "v1=" + public_intake_email._signature(PUBLIC_SECRET, timestamp, body),
    }
    if not signature:
        headers["x-kravia-intake-signature"] = "v1=invalid"
    return body, headers


def post_receipt(client, monkeypatch, payload=PAYLOAD, *, signature=True):
    body, headers = signed_request(payload, signature=signature)
    monkeypatch.setattr(public_intake_email.time, "time", lambda: 1_700_000_000)
    return client.post("/api/v1/public-intake/email-acknowledgements", content=body, headers=headers)


def post_follow_up(client, monkeypatch, payload=FOLLOW_UP_PAYLOAD, *, signature=True):
    body, headers = signed_request(payload, signature=signature)
    monkeypatch.setattr(public_intake_email.time, "time", lambda: 1_700_000_000)
    return client.post("/api/v1/public-intake/email-follow-ups", content=body, headers=headers)


def test_signed_public_form_receipt_sends_once_and_persists_no_email(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    receipts = []
    notifications = []
    monkeypatch.setattr(public_intake_email, "deliver_public_form_receipt", lambda **kwargs: receipts.append(kwargs) or "brevo-public-1")
    monkeypatch.setattr(public_intake_email, "deliver_public_intake_internal_notification", lambda **kwargs: notifications.append(kwargs) or "brevo-internal-1")
    try:
        response = post_receipt(client, monkeypatch)
        assert response.status_code == 201, response.text
        assert response.json() == {"delivery": "sent", "internal_notification": "sent"}
        assert receipts == [{
            "recipient_email": "recipient@example.test",
            "recipient_name": "Synthetic Recipient",
            "form_kind": "CONTACT",
            "reference": "KRV-ABCDEF0123456789ABCDEF01",
            "delivery_id": "public-contact:KRV-ABCDEF0123456789ABCDEF01",
        }]
        assert notifications == [{
            "form_kind": "CONTACT",
            "sender_name": "Synthetic Recipient",
            "sender_email": "recipient@example.test",
            "reference": "KRV-ABCDEF0123456789ABCDEF01",
            "request_subject": "Synthetic public request",
            "organisation": "Synthetic Organisation",
            "delivery_id": "public-internal:contact:KRV-ABCDEF0123456789ABCDEF01",
        }]

        duplicate = post_receipt(client, monkeypatch)
        assert duplicate.status_code == 201
        assert duplicate.json() == {"delivery": "already_sent", "internal_notification": "already_sent"}
        assert len(receipts) == 1
        assert len(notifications) == 1

        with engine.connect() as connection:
            rows = connection.execute(text("select delivery_kind, recipient_fingerprint, content_fingerprint, status, provider_message_id from office_public_email_deliveries")).mappings().all()
        by_kind = {row["delivery_kind"]: row for row in rows}
        assert by_kind["ACKNOWLEDGEMENT"]["status"] == "SENT"
        assert by_kind["ACKNOWLEDGEMENT"]["recipient_fingerprint"] != PAYLOAD["recipient_email"]
        assert by_kind["ACKNOWLEDGEMENT"]["provider_message_id"] == "brevo-public-1"
        assert by_kind["INTERNAL_NOTIFICATION"]["status"] == "SENT"
        assert by_kind["INTERNAL_NOTIFICATION"]["content_fingerprint"] not in {None, PAYLOAD["recipient_email"], PAYLOAD["request_subject"]}
        assert by_kind["INTERNAL_NOTIFICATION"]["provider_message_id"] == "brevo-internal-1"
    finally:
        engine.dispose()


def test_public_form_receipt_rejects_bad_or_stale_signatures(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    try:
        assert post_receipt(client, monkeypatch, signature=False).status_code == 401
        body, headers = signed_request()
        monkeypatch.setattr(public_intake_email.time, "time", lambda: 1_700_000_301)
        assert client.post("/api/v1/public-intake/email-acknowledgements", content=body, headers=headers).status_code == 401
    finally:
        engine.dispose()


def test_receipt_transition_keeps_legacy_signed_events_replyable(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    legacy = {key: value for key, value in PAYLOAD.items() if key not in {"request_subject", "organisation"}}
    notifications = []
    monkeypatch.setattr(public_intake_email, "deliver_public_intake_internal_notification", lambda **kwargs: notifications.append(kwargs) or "brevo-internal-legacy")
    monkeypatch.setattr(public_intake_email, "deliver_public_form_receipt", lambda **_kwargs: "brevo-public-legacy")
    try:
        response = post_receipt(client, monkeypatch, legacy)
        assert response.status_code == 201, response.text
        assert notifications[0]["request_subject"] == "KRAVIA Contact enquiry"
    finally:
        engine.dispose()


def test_internal_notification_unknown_outcome_does_not_block_the_customer_receipt(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    receipts = []
    monkeypatch.setattr(public_intake_email, "deliver_public_intake_internal_notification", lambda **_kwargs: (_ for _ in ()).throw(EmailDeliveryUnknown("test timeout")))
    monkeypatch.setattr(public_intake_email, "deliver_public_form_receipt", lambda **kwargs: receipts.append(kwargs) or "brevo-public-1")
    try:
        response = post_receipt(client, monkeypatch)
        assert response.status_code == 201, response.text
        assert response.json() == {"delivery": "sent", "internal_notification": "unknown"}
        assert len(receipts) == 1
        with engine.connect() as connection:
            state = connection.execute(text("select status from office_public_email_deliveries where delivery_kind = 'INTERNAL_NOTIFICATION'")).scalar_one()
        assert state == "DELIVERY_UNKNOWN"
    finally:
        engine.dispose()


def test_public_form_receipt_rejects_brevo_key_reused_as_webhook_secret(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    monkeypatch.setenv("BREVO_API_KEY", PUBLIC_SECRET)
    try:
        response = post_receipt(client, monkeypatch)
        assert response.status_code == 503
        assert response.json()["detail"] == "Public email acknowledgement requires a dedicated signing secret"
    finally:
        engine.dispose()


def test_public_form_receipt_does_not_retry_unknown_provider_outcome(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    monkeypatch.setattr(public_intake_email, "deliver_public_form_receipt", lambda **_kwargs: (_ for _ in ()).throw(EmailDeliveryUnknown("test timeout")))
    try:
        response = post_receipt(client, monkeypatch)
        assert response.status_code == 503
        replay = post_receipt(client, monkeypatch)
        assert replay.status_code == 503
        with engine.connect() as connection:
            state = connection.execute(text("select status from office_public_email_deliveries where event_id = :event_id"), {"event_id": PAYLOAD["event_id"]}).scalar_one()
        assert state == "DELIVERY_UNKNOWN"
    finally:
        engine.dispose()


def test_signed_follow_up_is_idempotent_and_fingerprints_message_not_recipient(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    delivered = []
    monkeypatch.setattr(public_intake_email, "deliver_public_form_follow_up", lambda **kwargs: delivered.append(kwargs) or "brevo-follow-up-1")
    try:
        response = post_follow_up(client, monkeypatch)
        assert response.status_code == 201, response.text
        assert response.json() == {"delivery": "sent"}
        assert delivered[0]["message"] == FOLLOW_UP_PAYLOAD["message"]
        assert delivered[0]["delivery_id"] == FOLLOW_UP_PAYLOAD["event_id"]

        duplicate = post_follow_up(client, monkeypatch)
        assert duplicate.status_code == 201
        assert duplicate.json() == {"delivery": "already_sent"}
        assert len(delivered) == 1
        with engine.connect() as connection:
            row = connection.execute(text("select delivery_kind, content_fingerprint, recipient_fingerprint from office_public_email_deliveries")).mappings().one()
        assert row["delivery_kind"] == "FOLLOW_UP"
        assert row["content_fingerprint"] not in {None, FOLLOW_UP_PAYLOAD["message"]}
        assert row["recipient_fingerprint"] != PAYLOAD["recipient_email"]
    finally:
        engine.dispose()


def test_follow_up_unknown_delivery_is_terminal_and_marked_unknown(tmp_path, monkeypatch):
    client, engine = public_client(tmp_path, monkeypatch)
    monkeypatch.setattr(public_intake_email, "deliver_public_form_follow_up", lambda **_kwargs: (_ for _ in ()).throw(EmailDeliveryUnknown("test timeout")))
    try:
        response = post_follow_up(client, monkeypatch)
        assert response.status_code == 503
        assert response.headers["x-kravia-delivery-status"] == "UNKNOWN"
        replay = post_follow_up(client, monkeypatch)
        assert replay.status_code == 503
        with engine.connect() as connection:
            state = connection.execute(text("select status from office_public_email_deliveries")).scalar_one()
        assert state == "DELIVERY_UNKNOWN"
    finally:
        engine.dispose()
