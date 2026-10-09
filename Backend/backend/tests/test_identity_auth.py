import os
from urllib.parse import parse_qs, urlsplit

import pyotp
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from backend import identity_auth
from backend.database import Base


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("OFFICE_AUTH_SIGNING_SECRET", "test-first-party-signing-secret-at-least-32-chars")
    monkeypatch.setenv("OFFICE_AUTH_BOOTSTRAP_SECRET", "test-bootstrap-secret-at-least-32-characters")
    monkeypatch.setenv("OFFICE_AUTH_BREAK_GLASS_SECRET", "test-break-glass-secret-at-least-48-characters-long-123456")
    monkeypatch.setenv("OFFICE_AUTH_EMAIL_DOMAIN", "example.test")
    # Email OTP is part of the phone-activation ceremony. Keep the test delivery
    # entirely local and deterministic; no provider or real mailbox is used.
    monkeypatch.setattr(identity_auth, "send_office_email_verification_code", lambda **_kwargs: "test-email-otp-message")
    # Tests can exercise the factor workflow with deterministic mailbox
    # verification; production enables the same-mailbox device-review gate.
    monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", False)
    monkeypatch.setattr(identity_auth.secrets, "randbelow", lambda _limit: 482915)
    device_approval_notices = []

    def capture_device_approval(**kwargs):
        """Keep account-owner device decisions local to this test client."""
        device_approval_notices.append(kwargs)
        return "test-device-approval-message"

    monkeypatch.setattr(identity_auth, "send_office_device_approval", capture_device_approval)
    engine = create_engine(
        f"sqlite:///{tmp_path / 'first-party-auth.db'}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            create table if not exists office_device_registry (
                id text primary key,
                user_id text not null,
                trust_state text not null,
                company_managed boolean not null default 0,
                revoked_at datetime null
            )
            """
        )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    def test_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(identity_auth.build_identity_router())
    app.dependency_overrides[identity_auth.get_db] = test_db
    client = TestClient(app)
    # The legacy Office-MFA assertions still exercise the existing TOTP
    # boundary. They complete the required same-mailbox device decision below
    # rather than bypassing the production trusted-device ceremony.
    client.device_approval_notices = device_approval_notices
    return client, engine


FOUNDER = {
    "email": "founder@example.test",
    "display_name": "Founder Test",
    "password": "Strong-Founder1!",
}


def founder(client: TestClient):
    response = client.post("/api/v1/auth/register-founder", json=FOUNDER, headers={"X-Kravia-Bootstrap-Key": "test-bootstrap-secret-at-least-32-characters"})
    assert response.status_code == 201, response.text
    return response.json()


def authenticator_activation_session(client: TestClient, email: str, password: str):
    challenge = client.post(
        "/api/v1/auth/email-otp/challenges",
        json={"email": email, "password": password, "channel": "authenticator_mobile"},
    )
    assert challenge.status_code == 201, challenge.text
    verified = client.post(
        f"/api/v1/auth/email-otp/challenges/{challenge.json()['challenge_id']}/verify",
        json={"challenge_token": challenge.json()["challenge_token"], "code": "482915"},
    )
    assert verified.status_code == 200, verified.text
    session = verified.json()
    if session.get("device_approval_pending"):
        assert client.device_approval_notices
        notice = client.device_approval_notices[-1]
        decision = parse_qs(urlsplit(notice["review_url"]).query)
        approval_id = decision["id"][0]
        action_token = decision["token"][0]
        approved = client.post(
            f"/api/v1/auth/device-approvals/{approval_id}/action",
            json={"action_token": action_token, "decision": "APPROVE"},
        )
        assert approved.status_code == 200, approved.text
        assert approved.json() == {"decided": True, "status": "APPROVED"}
        completed = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": session["device_approval_id"], "device_proof": session["device_proof"]},
        )
        assert completed.status_code == 200, completed.text
        session = completed.json()
    assert session["session_purpose"] == identity_auth.AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE
    return session["access_token"]


def request_authenticator_activation(client: TestClient, email: str, password: str):
    activation_access_token = authenticator_activation_session(client, email, password)
    response = client.post(
        "/api/v1/auth/authenticator/activation-requests",
        headers={"Authorization": f"Bearer {activation_access_token}"},
    )
    assert response.status_code == 200, response.text
    return response


def activate_founder_authenticator(client: TestClient, password: str = FOUNDER["password"]):
    requested = request_authenticator_activation(client, FOUNDER["email"], password)
    request = requested.json()
    assert request["status"] == "APPROVED"
    assert request["approval_required"] is False
    assert "secret" not in request
    claimed = client.post(
        f"/api/v1/auth/authenticator/activation-requests/{request['request_id']}/claim",
        json={"claim_token": request["claim_token"]},
    )
    assert claimed.status_code == 200, claimed.text
    enrollment = claimed.json()
    assert enrollment["status"] == "ENROLLED"
    return enrollment["secret"]


def aal2_founder(client: TestClient):
    initial = founder(client)
    access = initial["access_token"]
    secret = activate_founder_authenticator(client)
    verified = client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {access}"},
        json={"code": pyotp.TOTP(secret).now()},
    )
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert body["aal"] == "aal2"
    return body


def invite_and_register(
    client: TestClient,
    owner_access_token: str,
    *,
    email: str,
    display_name: str,
    roles: list[str],
    password: str,
):
    invited = client.post(
        "/api/v1/auth/invitations",
        headers={"Authorization": f"Bearer {owner_access_token}"},
        json={
            "email": email,
            "display_name": display_name,
            "department": "OPERATIONS",
            "roles": roles,
            "reason": "Identity delegation regression test",
        },
    )
    assert invited.status_code == 201, invited.text
    registered = client.post(
        "/api/v1/auth/invitation/register",
        json={
            "token": invited.json()["registration_token"],
            "display_name": display_name,
            "password": password,
        },
    )
    assert registered.status_code == 201, registered.text
    return invited.json(), registered.json()


def aal2_invited_user(
    client: TestClient,
    owner_access_token: str,
    *,
    email: str,
    display_name: str,
    roles: list[str],
    password: str,
):
    _, registered = invite_and_register(
        client,
        owner_access_token,
        email=email,
        display_name=display_name,
        roles=roles,
        password=password,
    )
    requested = request_authenticator_activation(client, email, password)
    request = requested.json()
    assert request["status"] == "APPROVED"
    assert request["approval_required"] is False
    # The invite issuer cannot approve another person's phone. The invited
    # account's same-mailbox trust ceremony is the sole device authority.
    claimed = client.post(
        f"/api/v1/auth/authenticator/activation-requests/{request['request_id']}/claim",
        json={"claim_token": request["claim_token"]},
    )
    assert claimed.status_code == 200, claimed.text
    verified = client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
        json={"code": pyotp.TOTP(claimed.json()["secret"]).now()},
    )
    assert verified.status_code == 200, verified.text
    return verified.json()


def test_request_metadata_ignores_untrusted_forwarding_headers():
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [
                (b"x-forwarded-for", b"203.0.113.9"),
                (b"x-real-ip", b"203.0.113.10"),
                (b"user-agent", b"security-regression-test"),
            ],
            "client": ("198.51.100.24", 4242),
        }
    )

    ip, user_agent_hash = identity_auth._request_metadata(request)

    assert ip == "198.51.100.24"
    assert user_agent_hash == identity_auth.hashlib.sha256(b"security-regression-test").hexdigest()


def test_founder_bootstrap_closes_after_first_success(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        ready = client.get("/api/v1/auth/bootstrap-status")
        assert ready.status_code == 200
        assert ready.json() == {
            "registration_open": True,
            "role": "FOUNDER",
            "role_locked": True,
            "public_registration_closes_after_success": True,
        }

        created = founder(client)
        assert created["founder"] is True
        assert created["display_role"] == "FOUNDER"
        assert created["roles"] == ["OWNER"]
        assert created["aal"] == "aal1"
        assert created["access_token"]
        assert created["refresh_token"]

        closed = client.get("/api/v1/auth/bootstrap-status")
        assert closed.json()["registration_open"] is False

        second = client.post(
            "/api/v1/auth/register-founder",
            headers={"X-Kravia-Bootstrap-Key": "test-bootstrap-secret-at-least-32-characters"},
            json={
                "email": "second@example.test",
                "display_name": "Second Founder",
                "password": "Another-Strong1!",
            },
        )
        assert second.status_code == 410
        assert "permanently closed" in second.json()["detail"].lower()
    finally:
        engine.dispose()


def test_password_sign_in_and_mfa_promote_to_aal2(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder(client)
        # A claimed, approved phone has a real factor even before it is used
        # for the first browser sign-in. The next password attempt must offer
        # TOTP verification, never repeat device activation.
        secret = activate_founder_authenticator(client)
        signed_in = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert signed_in.status_code == 200, signed_in.text
        signed = signed_in.json()
        assert signed["aal"] == "aal1"
        assert signed["roles"] == ["OWNER"]
        assert signed["mfa"] == {"enrolled": True, "verified": False}

        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {signed['access_token']}"},
            json={"code": pyotp.TOTP(secret).now()},
        )
        assert verified.status_code == 200, verified.text
        aal2 = verified.json()
        assert aal2["aal"] == "aal2"
        assert aal2["mfa"] == {"enrolled": True, "verified": True}

        current = client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {aal2['access_token']}"},
        )
        assert current.status_code == 200, current.text
        assert current.json()["aal"] == "aal2"
        assert current.json()["display_role"] == "FOUNDER"
    finally:
        engine.dispose()


def test_authenticator_phone_uses_same_mailbox_trust_and_rotates_factor(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        owner = aal2_founder(client)
        headers = {"Authorization": f"Bearer {owner['access_token']}"}
        invited = client.post(
            "/api/v1/auth/invitations",
            headers=headers,
            json={
                "email": "activation-member@example.test",
                "display_name": "Activation Member",
                "department": "OPERATIONS",
                "roles": ["MEMBER"],
                "reason": "Authenticator device trust test",
            },
        )
        assert invited.status_code == 201, invited.text
        registered = client.post(
            "/api/v1/auth/invitation/register",
            json={
                "token": invited.json()["registration_token"],
                "display_name": "Activation Member",
                "password": "Member-Activation1!",
            },
        )
        assert registered.status_code == 201, registered.text

        requested = request_authenticator_activation(
            client,
            "activation-member@example.test",
            "Member-Activation1!",
        )
        activation = requested.json()
        assert activation["status"] == "APPROVED"
        assert activation["approval_required"] is False
        assert "secret" not in activation

        # The former owner/admin approval endpoint cannot approve a user's
        # phone, even when called by the owner.
        retired = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{activation['request_id']}/approve",
            headers=headers,
        )
        assert retired.status_code == 410

        claimed = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{activation['request_id']}/claim",
            json={"claim_token": activation["claim_token"]},
        )
        assert claimed.status_code == 200, claimed.text
        first = claimed.json()
        assert first["status"] == "ENROLLED"
        assert len(first["secret"]) >= 16

        replacement_request = request_authenticator_activation(
            client,
            "activation-member@example.test",
            "Member-Activation1!",
        ).json()
        replacement_claim = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{replacement_request['request_id']}/claim",
            json={"claim_token": replacement_request["claim_token"]},
        )
        assert replacement_claim.status_code == 200, replacement_claim.text
        second = replacement_claim.json()
        assert second["status"] == "ENROLLED"
        assert second["secret"] != first["secret"]

        signed_in = client.post(
            "/api/v1/auth/sign-in",
            json={"email": "activation-member@example.test", "password": "Member-Activation1!"},
        )
        assert signed_in.status_code == 200, signed_in.text
        old_code = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {signed_in.json()['access_token']}"},
            json={"code": pyotp.TOTP(first["secret"]).now()},
        )
        assert old_code.status_code == 400
        new_code = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {signed_in.json()['access_token']}"},
            json={"code": pyotp.TOTP(second["secret"]).now()},
        )
        assert new_code.status_code == 200, new_code.text
    finally:
        engine.dispose()


def test_private_invitation_is_single_use_and_cannot_assign_owner(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder_aal2 = aal2_founder(client)
        headers = {"Authorization": f"Bearer {founder_aal2['access_token']}"}

        forbidden = client.post(
            "/api/v1/auth/invitations",
            headers=headers,
            json={
                "email": "owner2@example.test",
                "display_name": "Owner Two",
                "department": "OPERATIONS",
                "roles": ["OWNER"],
                "reason": "No second owner",
            },
        )
        assert forbidden.status_code == 422

        invited = client.post(
            "/api/v1/auth/invitations",
            headers=headers,
            json={
                "email": "member@example.test",
                "display_name": "Member Test",
                "job_title": "Operations Associate",
                "department": "OPERATIONS",
                "roles": ["MEMBER", "OPERATIONS"],
                "reason": "Controlled onboarding",
            },
        )
        assert invited.status_code == 201, invited.text
        invite = invited.json()
        assert invite["registration_path"].startswith("/office/register?invite=")
        token = invite["registration_token"]

        status = client.get("/api/v1/auth/invitation", params={"token": token})
        assert status.status_code == 200, status.text
        assert status.json()["roles"] == ["MEMBER", "OPERATIONS"]

        registered = client.post(
            "/api/v1/auth/invitation/register",
            json={
                "token": token,
                "display_name": "Member Test",
                "password": "Member-Strong1!",
            },
        )
        assert registered.status_code == 201, registered.text
        assert registered.json()["roles"] == ["MEMBER", "OPERATIONS"]

        reused = client.post(
            "/api/v1/auth/invitation/register",
            json={
                "token": token,
                "display_name": "Member Test",
                "password": "Member-Strong1!",
            },
        )
        assert reused.status_code == 404
    finally:
        engine.dispose()


def test_direct_identity_api_enforces_delegated_admin_limits(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        owner = aal2_founder(client)
        owner_headers = {"Authorization": f"Bearer {owner['access_token']}"}
        admin = aal2_invited_user(
            client,
            owner["access_token"],
            email="delegated-admin@example.test",
            display_name="Delegated Admin",
            roles=["ADMIN"],
            password="Delegated-Admin1!",
        )
        admin_headers = {"Authorization": f"Bearer {admin['access_token']}"}

        director_attempt = client.post(
            "/api/v1/auth/invitations",
            headers=admin_headers,
            json={
                "email": "forbidden-director@example.test",
                "display_name": "Forbidden Director",
                "department": "EXECUTIVE",
                "roles": ["DIRECTOR"],
                "reason": "Direct API privilege-escalation probe",
            },
        )
        assert director_attempt.status_code == 403

        conflict_attempt = client.post(
            "/api/v1/auth/invitations",
            headers=admin_headers,
            json={
                "email": "forbidden-conflict@example.test",
                "display_name": "Forbidden Conflict",
                "department": "AUDIT",
                "roles": ["AUDITOR", "FINANCE"],
                "reason": "Direct API separation-of-duties probe",
            },
        )
        assert conflict_attempt.status_code == 422

        member_attempt = client.post(
            "/api/v1/auth/invitations",
            headers=admin_headers,
            json={
                "email": "allowed-member@example.test",
                "display_name": "Allowed Member",
                "department": "OPERATIONS",
                "roles": ["MEMBER"],
                "reason": "Delegated administration control",
            },
        )
        assert member_attempt.status_code == 201, member_attempt.text

        privileged_invite = client.post(
            "/api/v1/auth/invitations",
            headers=owner_headers,
            json={
                "email": "owner-issued-admin@example.test",
                "display_name": "Owner Issued Admin",
                "department": "ADMINISTRATION",
                "roles": ["ADMIN"],
                "reason": "Owner-only delegation control",
            },
        )
        assert privileged_invite.status_code == 201, privileged_invite.text
        blocked_revoke = client.post(
            f"/api/v1/auth/invitations/{privileged_invite.json()['invitation_id']}/revoke",
            headers=admin_headers,
        )
        assert blocked_revoke.status_code == 403

        member_invite = client.post(
            "/api/v1/auth/invitations",
            headers=owner_headers,
            json={
                "email": "owner-issued-member@example.test",
                "display_name": "Owner Issued Member",
                "department": "OPERATIONS",
                "roles": ["MEMBER"],
                "reason": "Delegated revocation control",
            },
        )
        assert member_invite.status_code == 201, member_invite.text
        allowed_revoke = client.post(
            f"/api/v1/auth/invitations/{member_invite.json()['invitation_id']}/revoke",
            headers=admin_headers,
        )
        assert allowed_revoke.status_code == 200, allowed_revoke.text

        _, peer_admin = invite_and_register(
            client,
            owner["access_token"],
            email="peer-admin@example.test",
            display_name="Peer Admin",
            roles=["ADMIN"],
            password="Peer-Admin1!",
        )
        blocked_reset = client.post(
            f"/api/v1/auth/users/{peer_admin['user_id']}/mfa-reset",
            headers=admin_headers,
        )
        assert blocked_reset.status_code == 403

        peer_activation = request_authenticator_activation(
            client,
            "peer-admin@example.test",
            "Peer-Admin1!",
        )
        peer_activation_id = peer_activation.json()["request_id"]
        listed_activations = client.get(
            "/api/v1/auth/authenticator/activation-requests",
            headers=admin_headers,
        )
        assert listed_activations.status_code == 200, listed_activations.text
        assert peer_activation_id not in {item["id"] for item in listed_activations.json()["activation_requests"]}
        blocked_approval = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{peer_activation_id}/approve",
            headers=admin_headers,
        )
        assert blocked_approval.status_code == 410

        _, member = invite_and_register(
            client,
            owner["access_token"],
            email="managed-member@example.test",
            display_name="Managed Member",
            roles=["MEMBER"],
            password="Managed-Member1!",
        )
        allowed_reset = client.post(
            f"/api/v1/auth/users/{member['user_id']}/mfa-reset",
            headers=admin_headers,
        )
        assert allowed_reset.status_code == 200, allowed_reset.text
    finally:
        engine.dispose()


def test_refresh_tokens_are_stored_only_as_hashes(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        created = founder(client)
        raw_refresh = created["refresh_token"]
        with engine.connect() as connection:
            row = connection.exec_driver_sql(
                "select refresh_token_hash from office_auth_sessions_v2 limit 1"
            ).first()
        assert row is not None
        assert row[0] != raw_refresh
        assert len(row[0]) == 64
    finally:
        engine.dispose()


def test_readiness_identifies_kravia_as_identity_provider(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        response = client.get("/api/v1/auth/readiness")
        assert response.status_code == 200
        body = response.json()
        assert body["provider"] == "KRAVIA_FIRST_PARTY"
        assert body["password_hash"] == "ARGON2ID"
        assert body["mfa_policy"] == "AAL2_REQUIRED"
        assert body["mfa_factor"] == "TOTP"
        assert body["mfa_authenticator_app"] == "Authenticator"
        assert body["mfa_required_for_all_roles"] is True
        assert body["mfa_issuer"] == "KRAVIA Office"
        assert body["mfa_algorithm"] == "SHA1"
        assert body["mfa_digits"] == 6
        assert body["mfa_period_seconds"] == 30
        assert body["invitation_registration"] == "SINGLE_USE_PRIVATE_LINK"
        assert body["founder_break_glass_configured"] is True
        assert "supabase" not in response.text.lower()
    finally:
        engine.dispose()


def test_first_party_session_inventory_is_user_scoped_and_other_sessions_can_be_revoked(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        current = aal2_founder(client)
        current_token = current["access_token"]

        second = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert second.status_code == 200, second.text

        listed = client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {current_token}"},
        )
        assert listed.status_code == 200, listed.text
        sessions = listed.json()["sessions"]
        assert len(sessions) == 2
        assert sum(1 for row in sessions if row["current"]) == 1
        other = next(row for row in sessions if not row["current"])
        assert other["provider"] == "KRAVIA_FIRST_PARTY"
        assert "refresh_token_hash" not in other

        revoked = client.post(
            f"/api/v1/auth/sessions/{other['id']}/revoke",
            headers={"Authorization": f"Bearer {current_token}"},
        )
        assert revoked.status_code == 200, revoked.text
        assert revoked.json()["session"]["status"] == "REVOKED"

        cannot_revoke_current = client.post(
            f"/api/v1/auth/sessions/{next(row for row in sessions if row['current'])['id']}/revoke",
            headers={"Authorization": f"Bearer {current_token}"},
        )
        assert cannot_revoke_current.status_code == 409
    finally:
        engine.dispose()


def test_first_party_session_revoke_rejects_cross_user_idor(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        owner = aal2_founder(client)
        headers = {"Authorization": f"Bearer {owner['access_token']}"}
        invited = client.post(
            "/api/v1/auth/invitations",
            headers=headers,
            json={
                "email": "session-member@example.test",
                "display_name": "Session Member",
                "department": "OPERATIONS",
                "roles": ["MEMBER"],
                "reason": "Session isolation test",
            },
        )
        assert invited.status_code == 201, invited.text
        registered = client.post(
            "/api/v1/auth/invitation/register",
            json={
                "token": invited.json()["registration_token"],
                "display_name": "Session Member",
                "password": "Member-Session1!",
            },
        )
        assert registered.status_code == 201, registered.text
        member_user_id = registered.json()["user_id"]

        with engine.connect() as connection:
            member_session_id = connection.exec_driver_sql(
                "select id from office_auth_sessions_v2 where user_id=? limit 1",
                (member_user_id,),
            ).scalar_one()

        hidden = client.get("/api/v1/auth/sessions", headers=headers)
        assert hidden.status_code == 200
        assert all(row["id"] != member_session_id for row in hidden.json()["sessions"])

        blocked = client.post(
            f"/api/v1/auth/sessions/{member_session_id}/revoke",
            headers=headers,
        )
        assert blocked.status_code == 404
    finally:
        engine.dispose()


def test_device_events_require_aal2_and_device_ownership(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        user_id = initial["user_id"]
        own_device = "11111111-1111-4111-8111-111111111111"
        foreign_device = "22222222-2222-4222-8222-222222222222"
        foreign_user = "33333333-3333-4333-8333-333333333333"
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "insert into office_device_registry(id,user_id,trust_state,company_managed,revoked_at) values(?,?,?,?,null)",
                (own_device, user_id, "TRUSTED", True),
            )
            connection.exec_driver_sql(
                "insert into office_device_registry(id,user_id,trust_state,company_managed,revoked_at) values(?,?,?,?,null)",
                (foreign_device, foreign_user, "TRUSTED", True),
            )

        aal1_blocked = client.post(
            "/api/v1/auth/device-event",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"device_id": own_device, "action": "LINKED"},
        )
        assert aal1_blocked.status_code == 403

        secret = activate_founder_authenticator(client)
        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": pyotp.TOTP(secret).now()},
        )
        assert verified.status_code == 200
        token = verified.json()["access_token"]

        linked = client.post(
            "/api/v1/auth/device-event",
            headers={"Authorization": f"Bearer {token}"},
            json={"device_id": own_device, "action": "LINKED"},
        )
        assert linked.status_code == 200, linked.text
        assert linked.json()["event_type"] == "DEVICE_LINKED"

        foreign = client.post(
            "/api/v1/auth/device-event",
            headers={"Authorization": f"Bearer {token}"},
            json={"device_id": foreign_device, "action": "LINKED"},
        )
        assert foreign.status_code == 404

        with engine.connect() as connection:
            event = connection.exec_driver_sql(
                "select event_type, user_id, session_id from office_auth_events_v2 where event_type='DEVICE_LINKED' order by created_at desc limit 1"
            ).first()
        assert event is not None
        assert event[0] == "DEVICE_LINKED"
        assert event[1] == user_id
        assert event[2]
    finally:
        engine.dispose()


def test_new_browser_stays_blocked_until_only_its_account_owner_approves_it(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    delivered: dict[str, str] = {}
    try:
        initial = founder(client)
        # Establish the pre-existing Office MFA factor through the same
        # mailbox-decision test harness before enabling the browser-specific
        # device lock that this test is about.
        secret = activate_founder_authenticator(client)
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        monkeypatch.setattr(
            identity_auth,
            "send_office_device_approval",
            lambda **kwargs: delivered.update({key: str(value) for key, value in kwargs.items()}) or "device-approval-message",
        )

        pending = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": pyotp.TOTP(secret).now()},
        )
        assert pending.status_code == 200, pending.text
        body = pending.json()
        assert body["verified"] is False
        assert body["device_approval_pending"] is True
        assert body["device_proof"]
        assert delivered["recipient_email"] == FOUNDER["email"]
        assert delivered["source_address"] == "testclient"
        assert delivered["device_label"]

        # The old AAL1 access token cannot access Office after MFA creates a
        # pending device request, even though password and TOTP were correct.
        blocked = client.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {initial['access_token']}"})
        assert blocked.status_code == 401

        approval_id = body["device_approval_id"]
        action_token = parse_qs(urlsplit(delivered["review_url"]).query)["token"][0]
        owner_access = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert owner_access.status_code == 200
        # An Office role/token does not grant a cross-request approval API;
        # only the owner-email token for this exact request can decide it.
        wrong_token = client.post(
            f"/api/v1/auth/device-approvals/{approval_id}/action",
            headers={"Authorization": f"Bearer {owner_access.json()['access_token']}"},
            json={"action_token": "not-the-owner-email-token-which-is-long-enough-123456", "decision": "APPROVE"},
        )
        assert wrong_token.status_code == 404

        approved = client.post(
            f"/api/v1/auth/device-approvals/{approval_id}/action",
            json={"action_token": action_token, "decision": "APPROVE"},
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["status"] == "APPROVED"

        completed = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": approval_id, "device_proof": body["device_proof"]},
        )
        assert completed.status_code == 200, completed.text
        assert completed.json()["aal"] == "aal2"
        assert completed.json()["refresh_token"]

        recovered = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": approval_id, "device_proof": body["device_proof"]},
        )
        assert recovered.status_code == 200, recovered.text
        assert recovered.json()["aal"] == "aal2"
        assert recovered.json()["session_purpose"] == completed.json()["session_purpose"]
        assert recovered.json()["refresh_token"]
        assert recovered.json()["refresh_token"] != completed.json()["refresh_token"]

        with engine.connect() as connection:
            approval = connection.exec_driver_sql(
                "select status,consumed_at,trusted_until from office_login_device_approvals where id=?",
                (approval_id,),
            ).first()
        assert approval is not None
        assert approval[0] == "TRUSTED"
        assert approval[1] is not None
        assert approval[2] is not None
    finally:
        engine.dispose()


def test_declined_new_browser_can_never_complete_or_refresh(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    delivered: dict[str, str] = {}
    try:
        initial = founder(client)
        secret = activate_founder_authenticator(client)
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        monkeypatch.setattr(
            identity_auth,
            "send_office_device_approval",
            lambda **kwargs: delivered.update({key: str(value) for key, value in kwargs.items()}) or "device-approval-message",
        )
        pending = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": pyotp.TOTP(secret).now()},
        )
        assert pending.status_code == 200, pending.text
        body = pending.json()
        approval_id = body["device_approval_id"]
        decline_token = parse_qs(urlsplit(delivered["review_url"]).query)["token"][0]

        declined = client.post(
            f"/api/v1/auth/device-approvals/{approval_id}/action",
            json={"action_token": decline_token, "decision": "DECLINE"},
        )
        assert declined.status_code == 200, declined.text
        assert declined.json()["status"] == "DECLINED"

        status = client.post(
            "/api/v1/auth/device-approvals/status",
            json={"device_id": approval_id, "device_proof": body["device_proof"]},
        )
        assert status.status_code == 200
        assert status.json()["status"] == "DECLINED"
        completed = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": approval_id, "device_proof": body["device_proof"]},
        )
        assert completed.status_code == 409
        refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": initial["refresh_token"]})
        assert refreshed.status_code == 401
    finally:
        engine.dispose()


def test_trusted_authenticator_qr_approval_promotes_only_the_original_browser(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    delivered: dict[str, str] = {}
    try:
        founder(client)
        activate_founder_authenticator(client)
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        monkeypatch.setattr(
            identity_auth,
            "send_office_device_approval",
            lambda **kwargs: delivered.update({key: str(value) for key, value in kwargs.items()}) or "device-approval-message",
        )

        challenge = client.post(
            "/api/v1/auth/email-otp/challenges",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"], "channel": "authenticator_mobile"},
        )
        assert challenge.status_code == 201, challenge.text
        native_pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge.json()['challenge_id']}/verify",
            json={"challenge_token": challenge.json()["challenge_token"], "code": "482915"},
        )
        assert native_pending.status_code == 200, native_pending.text
        pending_body = native_pending.json()
        assert pending_body["device_approval_pending"] is True
        action_token = parse_qs(urlsplit(delivered["review_url"]).query)["token"][0]
        reviewed = client.post(
            f"/api/v1/auth/device-approvals/{pending_body['device_approval_id']}/action",
            json={"action_token": action_token, "decision": "APPROVE"},
        )
        assert reviewed.status_code == 200, reviewed.text
        trusted_native = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": pending_body["device_approval_id"], "device_proof": pending_body["device_proof"]},
        )
        assert trusted_native.status_code == 200, trusted_native.text
        native = trusted_native.json()

        browser = client.post("/api/v1/auth/sign-in", json={"email": FOUNDER["email"], "password": FOUNDER["password"]})
        assert browser.status_code == 200, browser.text
        qr = client.post("/api/v1/auth/qr-signins", headers={"Authorization": f"Bearer {browser.json()['access_token']}"})
        assert qr.status_code == 200, qr.text
        qr_body = qr.json()
        assert qr_body["browser_proof"]
        assert qr_body["scan_token"]
        assert "access_token" not in qr_body

        scanned = client.post(
            "/api/v1/auth/qr-signins/scan",
            headers={"Authorization": f"Bearer {native['access_token']}"},
            json={
                "request_id": qr_body["request_id"],
                "scan_token": qr_body["scan_token"],
                "device_approval_id": pending_body["device_approval_id"],
                "device_proof": pending_body["device_proof"],
            },
        )
        assert scanned.status_code == 200, scanned.text
        assert scanned.json()["status"] == "SCANNED"

        replay = client.post(
            "/api/v1/auth/qr-signins/scan",
            headers={"Authorization": f"Bearer {native['access_token']}"},
            json={
                "request_id": qr_body["request_id"],
                "scan_token": qr_body["scan_token"],
                "device_approval_id": pending_body["device_approval_id"],
                "device_proof": pending_body["device_proof"],
            },
        )
        assert replay.status_code == 409

        approved = client.post(
            "/api/v1/auth/qr-signins/decision",
            headers={"Authorization": f"Bearer {native['access_token']}"},
            json={
                "request_id": qr_body["request_id"],
                "device_approval_id": pending_body["device_approval_id"],
                "device_proof": pending_body["device_proof"],
                "decision": "APPROVE",
            },
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["status"] == "APPROVED"

        browser_complete = client.post(
            "/api/v1/auth/qr-signins/complete",
            json={"request_id": qr_body["request_id"], "browser_proof": qr_body["browser_proof"]},
        )
        assert browser_complete.status_code == 200, browser_complete.text
        assert browser_complete.json()["aal"] == "aal2"

        recovered = client.post(
            "/api/v1/auth/qr-signins/complete",
            json={"request_id": qr_body["request_id"], "browser_proof": qr_body["browser_proof"]},
        )
        assert recovered.status_code == 200, recovered.text
        assert recovered.json()["aal"] == "aal2"

        wrong_browser = client.post(
            "/api/v1/auth/qr-signins/status",
            json={"request_id": qr_body["request_id"], "browser_proof": "z" * 48},
        )
        assert wrong_browser.status_code == 404
    finally:
        engine.dispose()


def test_rejecting_qr_signin_revokes_the_password_only_browser(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    delivered: dict[str, str] = {}
    try:
        founder(client)
        activate_founder_authenticator(client)
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        monkeypatch.setattr(
            identity_auth,
            "send_office_device_approval",
            lambda **kwargs: delivered.update({key: str(value) for key, value in kwargs.items()}) or "device-approval-message",
        )
        challenge = client.post(
            "/api/v1/auth/email-otp/challenges",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"], "channel": "authenticator_mobile"},
        )
        native_pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge.json()['challenge_id']}/verify",
            json={"challenge_token": challenge.json()["challenge_token"], "code": "482915"},
        )
        pending_body = native_pending.json()
        action_token = parse_qs(urlsplit(delivered["review_url"]).query)["token"][0]
        assert client.post(
            f"/api/v1/auth/device-approvals/{pending_body['device_approval_id']}/action",
            json={"action_token": action_token, "decision": "APPROVE"},
        ).status_code == 200
        native = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": pending_body["device_approval_id"], "device_proof": pending_body["device_proof"]},
        ).json()
        browser = client.post("/api/v1/auth/sign-in", json={"email": FOUNDER["email"], "password": FOUNDER["password"]}).json()
        qr = client.post("/api/v1/auth/qr-signins", headers={"Authorization": f"Bearer {browser['access_token']}"}).json()
        assert client.post(
            "/api/v1/auth/qr-signins/scan",
            headers={"Authorization": f"Bearer {native['access_token']}"},
            json={"request_id": qr["request_id"], "scan_token": qr["scan_token"], "device_approval_id": pending_body["device_approval_id"], "device_proof": pending_body["device_proof"]},
        ).status_code == 200
        rejected = client.post(
            "/api/v1/auth/qr-signins/decision",
            headers={"Authorization": f"Bearer {native['access_token']}"},
            json={"request_id": qr["request_id"], "device_approval_id": pending_body["device_approval_id"], "device_proof": pending_body["device_proof"], "decision": "REJECT"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "REJECTED"
        assert client.get("/api/v1/auth/session", headers={"Authorization": f"Bearer {browser['access_token']}"}).status_code == 401
        assert client.post(
            "/api/v1/auth/qr-signins/complete",
            json={"request_id": qr["request_id"], "browser_proof": qr["browser_proof"]},
        ).status_code == 409
    finally:
        engine.dispose()


def test_password_change_requires_aal2_and_revokes_other_sessions(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        blocked = client.post(
            "/api/v1/auth/password",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"current_password": FOUNDER["password"], "new_password": "Changed-Strong2!"},
        )
        assert blocked.status_code == 403

        secret = activate_founder_authenticator(client)
        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": pyotp.TOTP(secret).now()},
        )
        assert verified.status_code == 200
        aal2_token = verified.json()["access_token"]

        second = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert second.status_code == 200
        second_refresh = second.json()["refresh_token"]

        changed = client.post(
            "/api/v1/auth/password",
            headers={"Authorization": f"Bearer {aal2_token}"},
            json={"current_password": FOUNDER["password"], "new_password": "Changed-Strong2!"},
        )
        assert changed.status_code == 200, changed.text
        assert changed.json()["changed"] is True
        assert changed.json()["revoked_other_sessions"] >= 1

        stale_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": second_refresh})
        assert stale_refresh.status_code == 401

        old_password = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert old_password.status_code == 401

        new_password = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": "Changed-Strong2!"},
        )
        assert new_password.status_code == 200
    finally:
        engine.dispose()


def test_administrator_recovery_link_is_single_use_and_revokes_target_sessions(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        owner = aal2_founder(client)
        headers = {"Authorization": f"Bearer {owner['access_token']}"}

        invited = client.post(
            "/api/v1/auth/invitations",
            headers=headers,
            json={
                "email": "recoverable@example.test",
                "display_name": "Recoverable Member",
                "department": "OPERATIONS",
                "roles": ["MEMBER"],
                "reason": "Recovery test account",
            },
        )
        assert invited.status_code == 201, invited.text
        registered = client.post(
            "/api/v1/auth/invitation/register",
            json={
                "token": invited.json()["registration_token"],
                "display_name": "Recoverable Member",
                "password": "Member-Original1!",
            },
        )
        assert registered.status_code == 201, registered.text
        member_id = registered.json()["user_id"]

        issued = client.post(
            f"/api/v1/auth/users/{member_id}/recovery-link",
            headers=headers,
            json={"reason": "User lost access to the password"},
        )
        assert issued.status_code == 200, issued.text
        body = issued.json()
        assert body["issued"] is True
        assert body["target_user_id"] == member_id
        assert body["recovery_path"].startswith("/office/reset-password?token=")
        assert body["revoked_sessions"] >= 1
        recovery_token = body["recovery_token"]

        recovered = client.post(
            "/api/v1/auth/recovery/password",
            json={"token": recovery_token, "new_password": "Member-Recovered2!"},
        )
        assert recovered.status_code == 200, recovered.text
        assert recovered.json()["recovered"] is True

        reused = client.post(
            "/api/v1/auth/recovery/password",
            json={"token": recovery_token, "new_password": "Member-Recovered3!"},
        )
        assert reused.status_code == 410

        old_password = client.post(
            "/api/v1/auth/sign-in",
            json={"email": "recoverable@example.test", "password": "Member-Original1!"},
        )
        assert old_password.status_code == 401

        new_password = client.post(
            "/api/v1/auth/sign-in",
            json={"email": "recoverable@example.test", "password": "Member-Recovered2!"},
        )
        assert new_password.status_code == 200
    finally:
        engine.dispose()


def test_owner_recovery_cannot_be_issued_through_ordinary_administration(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        owner = aal2_founder(client)
        blocked = client.post(
            f"/api/v1/auth/users/{owner['user_id']}/recovery-link",
            headers={"Authorization": f"Bearer {owner['access_token']}"},
            json={"reason": "Ordinary recovery must not handle OWNER"},
        )
        assert blocked.status_code == 409
    finally:
        engine.dispose()


def test_founder_break_glass_requires_secret_revokes_sessions_and_resets_mfa(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        founder_aal2 = aal2_founder(client)
        access_token = founder_aal2["access_token"]

        wrong = client.post(
            "/api/v1/auth/founder/recovery-link",
            headers={"X-Kravia-Break-Glass-Key": "wrong-break-glass-secret-that-is-definitely-long-enough-123456"},
            json={"reason": "Emergency recovery test"},
        )
        assert wrong.status_code == 403

        issued = client.post(
            "/api/v1/auth/founder/recovery-link",
            headers={"X-Kravia-Break-Glass-Key": "test-break-glass-secret-at-least-48-characters-long-123456"},
            json={"reason": "Founder lost both password and MFA access"},
        )
        assert issued.status_code == 200, issued.text
        body = issued.json()
        assert body["issued"] is True
        assert body["mfa_reset"] is True
        assert body["revoked_sessions"] >= 1
        assert body["recovery_path"].startswith("/office/reset-password?token=")

        revoked_session = client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert revoked_session.status_code == 401

        recovered = client.post(
            "/api/v1/auth/recovery/password",
            json={"token": body["recovery_token"], "new_password": "Founder-Recovered3!"},
        )
        assert recovered.status_code == 200, recovered.text

        signed_in = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": "Founder-Recovered3!"},
        )
        assert signed_in.status_code == 200, signed_in.text
        signed = signed_in.json()
        assert signed["aal"] == "aal1"
        assert signed["mfa"]["enrolled"] is False

        assert activate_founder_authenticator(client, "Founder-Recovered3!")
    finally:
        engine.dispose()


def test_totp_code_cannot_be_replayed_across_office_sessions(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        secret = activate_founder_authenticator(client)
        fixed_now = identity_auth._now().replace(microsecond=0)
        monkeypatch.setattr(identity_auth, "_now", lambda: fixed_now)
        code = pyotp.TOTP(secret).at(fixed_now)

        first = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": code},
        )
        assert first.status_code == 200, first.text

        second = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert second.status_code == 200, second.text
        replay = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {second.json()['access_token']}"},
            json={"code": code},
        )
        assert replay.status_code == 400
        assert "already used" in replay.json()["detail"].lower()

        with engine.connect() as connection:
            accepted = connection.exec_driver_sql(
                "select mfa_last_accepted_counter from office_auth_users where email=?",
                (FOUNDER["email"],),
            ).scalar_one()
            event = connection.exec_driver_sql(
                "select event_type from office_auth_events_v2 where event_type='MFA_REPLAY_BLOCKED' order by created_at desc limit 1"
            ).scalar_one()
        assert accepted == int(fixed_now.timestamp()) // identity_auth.MFA_PERIOD_SECONDS
        assert event == "MFA_REPLAY_BLOCKED"
    finally:
        engine.dispose()


def test_five_wrong_totp_codes_revoke_the_aal1_session(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        secret = activate_founder_authenticator(client)
        fixed_now = identity_auth._now().replace(microsecond=0)
        monkeypatch.setattr(identity_auth, "_now", lambda: fixed_now)
        valid_code = pyotp.TOTP(secret).at(fixed_now)
        invalid_code = "000000" if valid_code != "000000" else "000001"

        for attempt in range(1, identity_auth.MFA_MAX_FAILED_ATTEMPTS + 1):
            response = client.post(
                "/api/v1/auth/mfa/verify",
                headers={"Authorization": f"Bearer {initial['access_token']}"},
                json={"code": invalid_code},
            )
            expected = 429 if attempt == identity_auth.MFA_MAX_FAILED_ATTEMPTS else 400
            assert response.status_code == expected, response.text

        denied = client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
        )
        assert denied.status_code == 401

        with engine.connect() as connection:
            session = connection.exec_driver_sql(
                "select status,mfa_failed_attempts,revoked_at from office_auth_sessions_v2 limit 1"
            ).first()
            event = connection.exec_driver_sql(
                "select event_type from office_auth_events_v2 where event_type='MFA_SESSION_REVOKED' order by created_at desc limit 1"
            ).scalar_one()
        assert session is not None
        assert session[0] == "REVOKED"
        assert session[1] == identity_auth.MFA_MAX_FAILED_ATTEMPTS
        assert session[2] is not None
        assert event == "MFA_SESSION_REVOKED"
    finally:
        engine.dispose()

def test_mfa_counter_claim_is_atomic_and_single_use(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        assert activate_founder_authenticator(client)

        with engine.connect() as connection:
            user_id = connection.exec_driver_sql(
                "select id from office_auth_users where email=?",
                (FOUNDER["email"],),
            ).scalar_one()

        counter = int(identity_auth._now().timestamp()) // identity_auth.MFA_PERIOD_SECONDS
        Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

        with Session() as db:
            assert identity_auth._claim_mfa_counter(db, user_id, counter) is True
            db.commit()

        with Session() as db:
            assert identity_auth._claim_mfa_counter(db, user_id, counter) is False
            db.rollback()

        with engine.connect() as connection:
            accepted = connection.exec_driver_sql(
                "select mfa_last_accepted_counter from office_auth_users where id=?",
                (user_id,),
            ).scalar_one()
        assert accepted == counter
    finally:
        engine.dispose()


def test_stale_aal1_token_cannot_mutate_mfa_after_promotion(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        access = initial["access_token"]
        secret = activate_founder_authenticator(client)
        valid_code = pyotp.TOTP(secret).now()

        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {access}"},
            json={"code": valid_code},
        )
        assert verified.status_code == 200, verified.text

        invalid_code = "000000" if valid_code != "000000" else "000001"
        stale = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {access}"},
            json={"code": invalid_code},
        )
        assert stale.status_code == 409
        assert "already completed" in stale.json()["detail"].lower()

        with engine.connect() as connection:
            state = connection.exec_driver_sql(
                "select status,aal,mfa_failed_attempts from office_auth_sessions_v2 limit 1"
            ).first()
        assert state is not None
        assert state[0] == "ACTIVE"
        assert state[1] == "aal2"
        assert state[2] == 0
    finally:
        engine.dispose()
