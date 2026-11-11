"""Password + email verification for privately invited KRAVIA MEMBER accounts.

This does not change the Founder or privileged Authenticator requirement.
All tests use isolated local SQLite and mock email provider delivery.
"""
from backend import identity_auth
from backend.tests.test_identity_auth import make_client, aal2_founder, invite_and_register


def setup_member(tmp_path, monkeypatch, *, email="invited-member@example.test"):
    client, engine = make_client(tmp_path, monkeypatch)
    founder = aal2_founder(client)
    invite, registered = invite_and_register(
        client, founder["access_token"], email=email,
        display_name="Invited Member", roles=["MEMBER"], password="Member-Strong1!",
    )
    return client, engine, founder, invite, registered


def test_invited_member_receives_one_time_email_code_and_enters_office(tmp_path, monkeypatch):
    client, engine, founder, invite, registered = setup_member(tmp_path, monkeypatch)
    deliveries = []
    monkeypatch.setattr(identity_auth, "send_office_email_verification_code",
                        lambda **kwargs: deliveries.append(kwargs) or "brevo-confirmed")
    try:
        assert registered["email_otp_available"] is True
        assert registered["aal"] == "aal1"
        assert registered["mfa"]["enrolled"] is False
        headers = {"Authorization": "Bearer " + registered["access_token"]}
        first = client.post("/api/v1/auth/office-invite-email-otp/request", headers=headers, json={})
        assert first.status_code == 201, first.text
        value = first.json()
        assert value["email"] == "invited-member@example.test"
        assert len(deliveries) == 1
        assert deliveries[0]["recipient_email"] == "invited-member@example.test"
        assert deliveries[0]["code"] == "482915"
        assert "code" not in value
        assert "password" not in value

        still_first_factor = client.get("/api/v1/auth/session", headers=headers)
        assert still_first_factor.status_code == 200
        assert still_first_factor.json()["aal"] == "aal1"

        wrong = client.post("/api/v1/auth/office-invite-email-otp/verify",
                            headers=headers, json={
                                "challenge_id": value["challenge_id"],
                                "challenge_token": value["challenge_token"], "code": "111111",
                            })
        assert wrong.status_code == 400
        verified = client.post("/api/v1/auth/office-invite-email-otp/verify",
                               headers=headers, json={
                                   "challenge_id": value["challenge_id"],
                                   "challenge_token": value["challenge_token"], "code": "482915",
                               })
        assert verified.status_code == 200, verified.text
        assert verified.json()["verified"] is True
        upgraded = client.get("/api/v1/auth/session", headers={
            "Authorization": "Bearer " + verified.json()["access_token"]
        })
        assert upgraded.status_code == 200
        assert upgraded.json()["aal"] == "aal2"
        assert upgraded.json()["roles"] == ["MEMBER"]
        replay = client.post("/api/v1/auth/office-invite-email-otp/verify",
                             headers=headers, json={
                                 "challenge_id": value["challenge_id"],
                                 "challenge_token": value["challenge_token"], "code": "482915",
                             })
        assert replay.status_code in (403, 409)
    finally:
        engine.dispose()


def test_invited_member_email_otp_is_bounded_to_original_password_session(tmp_path, monkeypatch):
    client, engine, _, _, registered = setup_member(tmp_path, monkeypatch)
    try:
        headers = {"Authorization": "Bearer " + registered["access_token"]}
        started = client.post("/api/v1/auth/office-invite-email-otp/request", headers=headers, json={})
        assert started.status_code == 201
        value = started.json()
        another = client.post("/api/v1/auth/sign-in", json={
            "email": "invited-member@example.test", "password": "Member-Strong1!",
        })
        assert another.status_code == 200
        other_headers = {"Authorization": "Bearer " + another.json()["access_token"]}
        stolen = client.post("/api/v1/auth/office-invite-email-otp/verify",
                             headers=other_headers, json={
                                 "challenge_id": value["challenge_id"],
                                 "challenge_token": value["challenge_token"], "code": "482915",
                             })
        assert stolen.status_code == 404
        rate_limited = client.post("/api/v1/auth/office-invite-email-otp/request", headers=headers, json={})
        assert rate_limited.status_code == 429
    finally:
        engine.dispose()


def test_privileged_or_founder_account_cannot_use_invited_member_email_mfa(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder = aal2_founder(client)
        signed = client.post("/api/v1/auth/sign-in", json={
            "email": "founder@example.test", "password": "Strong-Founder1!",
        })
        assert signed.status_code == 200
        assert signed.json()["email_otp_available"] is False
        denied = client.post("/api/v1/auth/office-invite-email-otp/request",
                             headers={"Authorization": "Bearer " + signed.json()["access_token"]}, json={})
        assert denied.status_code == 403
    finally:
        engine.dispose()


def test_invited_code_delivery_failure_does_not_upgrade_login(tmp_path, monkeypatch):
    client, engine, _, _, registered = setup_member(tmp_path, monkeypatch)
    def fail(**kwargs):
        raise identity_auth.EmailDeliveryRejected("test provider rejection")
    monkeypatch.setattr(identity_auth, "send_office_email_verification_code", fail)
    try:
        headers = {"Authorization": "Bearer " + registered["access_token"]}
        response = client.post("/api/v1/auth/office-invite-email-otp/request", headers=headers, json={})
        assert response.status_code == 503
        current = client.get("/api/v1/auth/session", headers=headers)
        assert current.status_code == 200
        assert current.json()["aal"] == "aal1"
    finally:
        engine.dispose()
