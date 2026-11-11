"""Invited staff mailbox OTP must never affect the KRAVIA Authenticator flow."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend import identity_auth
from backend.auth_models import OfficeAuthRole, OfficeEmailOtpChallenge
from backend.email_delivery import EmailDeliveryUnknown
from backend.tests.test_identity_auth import (
    FOUNDER, aal2_founder, founder, invite_and_register, make_client,
)

EMPLOYEE = {
    "email": "invited-staff@example.test",
    "display_name": "Invited Staff",
    "password": "Strong-Employee1!",
}


def _employee(client, roles=None):
    owner = aal2_founder(client)
    _, registered = invite_and_register(
        client, owner["access_token"], email=EMPLOYEE["email"],
        display_name=EMPLOYEE["display_name"], roles=roles or ["MEMBER"],
        password=EMPLOYEE["password"],
    )
    return owner, registered


def _request(client, access):
    return client.post("/api/v1/auth/invited-web-otp/request",
        headers={"Authorization": "Bearer " + access}, json={})


def _verify(client, access, challenge, code="482915"):
    return client.post("/api/v1/auth/invited-web-otp/verify",
        headers={"Authorization": "Bearer " + access},
        json={"challenge_id": challenge["challenge_id"],
              "challenge_token": challenge["challenge_token"], "code": code})


def test_registration_email_code_issues_scoped_office_session_not_authenticator(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        _, registration = _employee(client)
        assert registration["aal"] == "aal1"
        assert registration["mfa"]["enrolled"] is False
        sent = []
        monkeypatch.setattr(identity_auth, "send_office_email_verification_code",
                            lambda **kw: sent.append(kw) or "email-provider-accepted")
        challenge = _request(client, registration["access_token"])
        assert challenge.status_code == 201, challenge.text
        item = challenge.json()
        assert item["email"] == EMPLOYEE["email"]
        assert "code" not in item
        assert sent[0]["recipient_email"] == EMPLOYEE["email"]
        assert sent[0]["code"] == "482915"
        wrong = _verify(client, registration["access_token"], item, "000000")
        assert wrong.status_code == 400, wrong.text
        verified = _verify(client, registration["access_token"], item)
        assert verified.status_code == 200, verified.text
        body = verified.json()
        assert body["verified"] is True
        assert body["aal"] == "aal2"
        assert "refresh_token" not in body
        check = client.get("/api/v1/auth/session",
            headers={"Authorization": "Bearer " + body["access_token"]})
        assert check.status_code == 200, check.text
        assert check.json()["aal"] == "aal2"
        assert check.json()["mfa"]["enrolled"] is False
        replay = _verify(client, registration["access_token"], item)
        assert replay.status_code in (403, 409)
        assert _request(client, body["access_token"]).status_code == 403
    finally:
        engine.dispose()


def test_code_is_bound_to_one_browser_and_rate_limited(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        _, registered = _employee(client)
        access = registered["access_token"]
        first = _request(client, access)
        assert first.status_code == 201, first.text
        challenge = first.json()
        immediate = _request(client, access)
        assert immediate.status_code == 429, immediate.text

        other_browser = client.post("/api/v1/auth/sign-in",
            json={"email": EMPLOYEE["email"], "password": EMPLOYEE["password"]})
        assert other_browser.status_code == 200
        blocked = _verify(client, other_browser.json()["access_token"], challenge)
        assert blocked.status_code == 404, blocked.text
        assert _verify(client, access, challenge).status_code == 200
    finally:
        engine.dispose()


def test_email_code_locks_after_five_bad_attempts_and_expires(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        _, registration = _employee(client)
        access = registration["access_token"]
        challenge = _request(client, access).json()
        for i in range(5):
            result = _verify(client, access, challenge, "000000")
            assert result.status_code == (429 if i == 4 else 400), result.text
        assert _verify(client, access, challenge).status_code == 409

        with Session(engine) as db:
            row = db.get(OfficeEmailOtpChallenge, challenge["challenge_id"])
            assert row and row.status == "CANCELLED"
            # The old challenge is terminal; allow a fresh code to test expiry.
        again = _request(client, access)
        assert again.status_code == 201, again.text
        another = again.json()
        with Session(engine) as db:
            row = db.get(OfficeEmailOtpChallenge, another["challenge_id"])
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            db.commit()
        expired = _verify(client, access, another)
        assert expired.status_code == 410, expired.text
    finally:
        engine.dispose()


def test_founder_and_privileged_invites_cannot_use_email_as_authenticator(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        owner = founder(client)
        assert _request(client, owner["access_token"]).status_code == 403
    finally:
        engine.dispose()
    client2, engine2 = make_client(tmp_path / "priv", monkeypatch)
    try:
        _, registered = _employee(client2, roles=["MEMBER", "ADMIN"])
        assert _request(client2, registered["access_token"]).status_code == 403
    finally:
        engine2.dispose()


def test_elevation_invalidates_previously_email_verified_session(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        _, registration = _employee(client)
        challenge = _request(client, registration["access_token"]).json()
        verified = _verify(client, registration["access_token"], challenge).json()
        with Session(engine) as db:
            identity = db.query(identity_auth.OfficeAuthUser).filter_by(email=EMPLOYEE["email"]).one()
            db.add(OfficeAuthRole(user_id=identity.id, role="FINANCE",
                                  grant_reason="Sensitive role escalation test"))
            db.commit()
        attempt = client.get("/api/v1/auth/session",
            headers={"Authorization": "Bearer " + verified["access_token"]})
        assert attempt.status_code == 403, attempt.text
    finally:
        engine.dispose()


def test_uncertain_delivery_fails_closed_and_cannot_issue_office_session(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        _, registration = _employee(client)
        monkeypatch.setattr(identity_auth, "send_office_email_verification_code",
            lambda **_kwargs: (_ for _ in ()).throw(EmailDeliveryUnknown("provider timed out")))
        response = _request(client, registration["access_token"])
        assert response.status_code == 503
        retry = _request(client, registration["access_token"])
        assert retry.status_code == 503
    finally:
        engine.dispose()
