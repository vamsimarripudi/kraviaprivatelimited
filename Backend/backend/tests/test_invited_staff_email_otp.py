"""Password + optional corporate email OTP for the two expressly approved Office identities.

All tests use isolated SQLite, no real email is delivered and other accounts keep TOTP.
"""
from backend import identity_auth
from backend.tests.test_identity_auth import make_client, aal2_founder, invite_and_register


def setup_member(tmp_path, monkeypatch, *, email="jaya@example.test"):
    client, engine = make_client(tmp_path, monkeypatch)
    monkeypatch.setattr(identity_auth, "OFFICE_WEB_EMAIL_OTP_STAFF", email)
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
        assert value["email"] == "jaya@example.test"
        assert len(deliveries) == 1
        assert deliveries[0]["recipient_email"] == "jaya@example.test"
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
            "email": "jaya@example.test", "password": "Member-Strong1!",
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


def test_explicit_jaya_account_keeps_email_choice_when_privileged_roles_change(tmp_path, monkeypatch):
    """The explicitly approved Jaya identity can add roles without losing email OTP.
    The other, non-approved accounts remain Authenticator-only."""
    client, engine = make_client(tmp_path, monkeypatch)
    monkeypatch.setattr(identity_auth, "OFFICE_WEB_EMAIL_OTP_STAFF", "staff-admin@example.test")
    try:
        owner = aal2_founder(client)
        _, created = invite_and_register(
            client, owner["access_token"], email="staff-admin@example.test",
            display_name="Staff Admin", roles=["ADMIN", "CS", "LEGAL", "OPERATIONS"],
            password="Member-Admin1!",
        )
        assert created["email_otp_available"] is True
        headers = {"Authorization": "Bearer " + created["access_token"]}
        issued = client.post("/api/v1/auth/office-invite-email-otp/request",
                             headers=headers, json={})
        assert issued.status_code == 201, issued.text
        challenge = issued.json()
        verified = client.post("/api/v1/auth/office-invite-email-otp/verify",
                               headers=headers, json={
                                   "challenge_id": challenge["challenge_id"],
                                   "challenge_token": challenge["challenge_token"],
                                   "code": "482915",
                               })
        assert verified.status_code == 200, verified.text
        assert verified.json()["aal"] == "aal2"

        # Later non-OWNER delegated roles do not silently revoke Jaya\'s
        # expressly approved email-OTP alternative.
        from sqlalchemy.orm import Session
        from backend.auth_models import OfficeAuthRole
        with Session(engine) as db:
            user = db.query(identity_auth.OfficeAuthUser).filter_by(
                email="staff-admin@example.test"
            ).one()
            db.add(OfficeAuthRole(user_id=user.id, role="FINANCE", granted_by=owner["user_id"],
                                  grant_reason="Later unrelated role for regression test"))
            db.commit()
        later = client.post("/api/v1/auth/sign-in", json={
            "email": "staff-admin@example.test", "password": "Member-Admin1!",
        })
        assert later.status_code == 200
        assert later.json()["email_otp_available"] is True
    finally:
        engine.dispose()


def test_approved_founder_can_choose_email_otp_even_after_authenticator_enrollment(tmp_path, monkeypatch):
    """The real founder slot, password and exact configured address are required."""
    client, engine = make_client(tmp_path, monkeypatch)
    monkeypatch.setattr(identity_auth, "OFFICE_WEB_EMAIL_OTP_FOUNDER", "founder@example.test")
    deliveries = []
    monkeypatch.setattr(identity_auth, "send_office_email_verification_code",
                        lambda **kwargs: deliveries.append(kwargs) or "brevo-confirmed")
    try:
        owner = aal2_founder(client)
        signed = client.post("/api/v1/auth/sign-in", json={
            "email": "founder@example.test", "password": "Strong-Founder1!",
        })
        assert signed.status_code == 200, signed.text
        assert signed.json()["mfa"]["enrolled"] is True
        assert signed.json()["email_otp_available"] is True
        assert signed.json()["aal"] == "aal1"
        headers = {"Authorization": "Bearer " + signed.json()["access_token"]}
        sent = client.post("/api/v1/auth/office-invite-email-otp/request", headers=headers, json={})
        assert sent.status_code == 201, sent.text
        assert len(deliveries) == 1
        assert deliveries[0]["recipient_email"] == "founder@example.test"
        challenge = sent.json()
        bad = client.post("/api/v1/auth/office-invite-email-otp/verify", headers=headers, json={
            "challenge_id": challenge["challenge_id"], "challenge_token": challenge["challenge_token"],
            "code": "111111",
        })
        assert bad.status_code == 400
        allowed = client.post("/api/v1/auth/office-invite-email-otp/verify", headers=headers, json={
            "challenge_id": challenge["challenge_id"], "challenge_token": challenge["challenge_token"],
            "code": "482915",
        })
        assert allowed.status_code == 200, allowed.text
        checked = client.get("/api/v1/auth/session", headers={
            "Authorization": "Bearer " + allowed.json()["access_token"]
        })
        assert checked.status_code == 200
        assert checked.json()["aal"] == "aal2"
        assert "OWNER" in checked.json()["roles"]
        # Existing Authenticator enrollment has NOT been changed or reset.
        again = client.post("/api/v1/auth/sign-in", json={
            "email": "founder@example.test", "password": "Strong-Founder1!",
        })
        assert again.json()["mfa"]["enrolled"] is True
        assert again.json()["email_otp_available"] is True
    finally:
        engine.dispose()


def test_satish_and_other_accounts_remain_authenticator_only(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    monkeypatch.setattr(identity_auth, "OFFICE_WEB_EMAIL_OTP_STAFF", "jaya@example.test")
    try:
        owner = aal2_founder(client)
        _, created = invite_and_register(
            client, owner["access_token"], email="satish@example.test",
            display_name="Satish", roles=["MEMBER"], password="Member-Strong1!",
        )
        assert created["email_otp_available"] is False
        response = client.post("/api/v1/auth/office-invite-email-otp/request", json={},
            headers={"Authorization": "Bearer " + created["access_token"]})
        assert response.status_code == 403
        # A corporate account with an accepted invite is not enough to gain
        # access to the specific two-person email second-factor exception.
        signed = client.post("/api/v1/auth/sign-in", json={
            "email": "satish@example.test", "password": "Member-Strong1!",
        })
        assert signed.status_code == 200
        assert signed.json()["email_otp_available"] is False
    finally:
        engine.dispose()


def test_jaya_can_still_use_email_after_totp_enrollment(tmp_path, monkeypatch):
    """An already-enrolled second factor does not disable Jaya's email choice."""
    client, engine, owner, invite, registered = setup_member(tmp_path, monkeypatch)
    from sqlalchemy.orm import Session
    try:
        with Session(engine) as db:
            user = db.query(identity_auth.OfficeAuthUser).filter_by(email="jaya@example.test").one()
            user.mfa_secret_ciphertext = identity_auth._encrypt_mfa_secret("JBSWY3DPEHPK3PXP")
            user.mfa_verified_at = identity_auth._now()
            db.commit()
        login = client.post("/api/v1/auth/sign-in", json={
            "email": "jaya@example.test", "password": "Member-Strong1!",
        })
        assert login.status_code == 200
        assert login.json()["mfa"]["enrolled"] is True
        assert login.json()["email_otp_available"] is True
        sent = client.post("/api/v1/auth/office-invite-email-otp/request", headers={
            "Authorization": "Bearer " + login.json()["access_token"]
        }, json={})
        assert sent.status_code == 201, sent.text
    finally:
        engine.dispose()
