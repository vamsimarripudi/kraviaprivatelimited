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


def test_email_otp_is_sent_only_after_credentials_and_issues_a_scoped_30_day_activation_session(tmp_path, monkeypatch):
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
        assert session["session_purpose"] == identity_auth.AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE
        assert len(session["refresh_token"]) >= 32
        expires_at = datetime.fromisoformat(session["refresh_expires_at"])
        assert timedelta(days=29, hours=23) <= expires_at - datetime.now(timezone.utc) <= timedelta(days=30, minutes=1)

        password_only_activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert password_only_activation.status_code == 401

        # The mobile email factor is only a capability to activate the local
        # Authenticator. It cannot be replayed as a general Office session.
        office_session = client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )
        assert office_session.status_code == 403

        # Rotation preserves the non-Office capability boundary for the full
        # 30-day mobile verification period. A short-lived access token alone
        # must not make a pending activation unusable after 30 minutes.
        refreshed = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": session["refresh_token"]},
        )
        assert refreshed.status_code == 200, refreshed.text
        refreshed_session = refreshed.json()
        assert refreshed_session["session_purpose"] == identity_auth.AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE
        assert refreshed_session["refresh_token"] != session["refresh_token"]
        assert client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {refreshed_session['access_token']}"},
        ).status_code == 403

        activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            headers={"Authorization": f"Bearer {refreshed_session['access_token']}"},
        )
        assert activation.status_code == 200, activation.text
        assert activation.json()["status"] == "APPROVED"
        assert "secret" not in activation.json()

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


def test_email_otp_resend_works_after_the_server_cooldown_and_replaces_the_old_code(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder(client)
        delivered = []
        codes = iter([482915, 593741])

        def send(**kwargs):
            delivered.append(kwargs)
            return f"brevo-test-message-{len(delivered)}"

        monkeypatch.setattr(identity_auth, "send_office_email_verification_code", send)
        monkeypatch.setattr(identity_auth.secrets, "randbelow", lambda _limit: next(codes))
        initial = client.post(
            "/api/v1/auth/email-otp/challenges",
            json={
                "email": FOUNDER["email"],
                "password": FOUNDER["password"],
                "channel": "authenticator_mobile",
            },
        )
        assert initial.status_code == 201, initial.text
        challenge = initial.json()

        # The client must honour this server-derived interval. Once it has
        # elapsed, an explicit resend is allowed and rotates the code.
        with engine.begin() as connection:
            connection.execute(text("update office_email_otp_challenges set resend_available_at = datetime('now', '-1 second')"))

        resent = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/resend",
            json={"challenge_token": challenge["challenge_token"]},
        )
        assert resent.status_code == 200, resent.text
        assert resent.json()["challenge_id"] == challenge["challenge_id"]
        assert resent.json()["challenge_token"] == challenge["challenge_token"]
        assert [message["code"] for message in delivered] == ["482915", "593741"]

        old_code = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "482915"},
        )
        assert old_code.status_code == 400
        new_code = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "593741"},
        )
        assert new_code.status_code == 200, new_code.text
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
