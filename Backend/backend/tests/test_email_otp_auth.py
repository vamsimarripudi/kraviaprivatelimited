from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from backend import identity_auth
from backend.email_delivery import EmailDeliveryUnknown
from backend.tests.test_identity_auth import FOUNDER, founder, make_client


def request_code(client, monkeypatch, code="482915"):
    delivered = []

    def send(**kwargs):
        delivered.append(kwargs)
        return "brevo-test-message-id"

    monkeypatch.setattr(identity_auth, "send_office_email_verification_code", send)
    monkeypatch.setattr(identity_auth.secrets, "randbelow", lambda _limit: int(code))
    response = client.post(
        "/api/v1/auth/email-otp/challenges",
        json={
            "email": FOUNDER["email"],
            "password": FOUNDER["password"],
            "channel": "authenticator_mobile",
        },
    )
    assert response.status_code == 201, response.text
    return response.json(), delivered


def test_email_otp_is_sent_only_after_credentials_and_issues_30_day_aal2_session(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder(client)
        challenge, delivered = request_code(client, monkeypatch)

        assert delivered == [{
            "recipient_email": FOUNDER["email"],
            "code": "482915",
            "expiry_minutes": 10,
            "delivery_id": f"email-otp:{challenge['challenge_id']}:1",
        }]
        assert challenge["email"] == FOUNDER["email"]
        assert challenge["challenge_token"]
        assert "code" not in challenge

        verified = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "482915"},
        )
        assert verified.status_code == 200, verified.text
        session = verified.json()
        assert session["authenticated"] is True
        assert session["aal"] == "aal2"
        assert len(session["refresh_token"]) >= 32
        expires_at = datetime.fromisoformat(session["refresh_expires_at"])
        assert timedelta(days=29, hours=23) <= expires_at - datetime.now(timezone.utc) <= timedelta(days=30, minutes=1)

        replay = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "482915"},
        )
        assert replay.status_code == 409

        with engine.connect() as connection:
            row = connection.execute(
                text("select code_hash, challenge_token_hash, status from office_email_otp_challenges")
            ).mappings().one()
        assert row["status"] == "VERIFIED"
        assert row["code_hash"] != "482915"
        assert row["challenge_token_hash"] != challenge["challenge_token"]
    finally:
        engine.dispose()


def test_email_otp_rejects_wrong_codes_then_locks_the_challenge(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder(client)
        challenge, _ = request_code(client, monkeypatch)
        for _ in range(4):
            wrong = client.post(
                f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
                json={"challenge_token": challenge["challenge_token"], "code": "000000"},
            )
            assert wrong.status_code == 400
        exhausted = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "000000"},
        )
        assert exhausted.status_code == 429
        assert "Request a new" in exhausted.json()["detail"]
    finally:
        engine.dispose()


def test_email_otp_does_not_claim_success_when_delivery_outcome_is_unknown(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder(client)

        def unknown_delivery(**_kwargs):
            raise EmailDeliveryUnknown("test timeout")

        monkeypatch.setattr(identity_auth, "send_office_email_verification_code", unknown_delivery)
        response = client.post(
            "/api/v1/auth/email-otp/challenges",
            json={
                "email": FOUNDER["email"],
                "password": FOUNDER["password"],
                "channel": "authenticator_mobile",
            },
        )
        assert response.status_code == 503
        assert "could not be confirmed" in response.json()["detail"]
        with engine.connect() as connection:
            state = connection.execute(text("select status from office_email_otp_challenges")).scalar_one()
        assert state == "DELIVERY_UNKNOWN"

        retry = client.post(
            "/api/v1/auth/email-otp/challenges",
            json={
                "email": FOUNDER["email"],
                "password": FOUNDER["password"],
                "channel": "authenticator_mobile",
            },
        )
        assert retry.status_code == 503
        assert "could not be confirmed" in retry.json()["detail"]
    finally:
        engine.dispose()
