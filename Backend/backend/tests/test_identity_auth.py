import os

import pyotp
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import identity_auth
from backend.database import Base


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("OFFICE_AUTH_SIGNING_SECRET", "test-first-party-signing-secret-at-least-32-chars")
    monkeypatch.setenv("OFFICE_AUTH_BOOTSTRAP_SECRET", "test-bootstrap-secret-at-least-32-characters")
    monkeypatch.setenv("OFFICE_AUTH_BREAK_GLASS_SECRET", "test-break-glass-secret-at-least-48-characters-long-123456")
    monkeypatch.setenv("OFFICE_AUTH_EMAIL_DOMAIN", "example.test")
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
    return TestClient(app), engine


FOUNDER = {
    "email": "founder@example.test",
    "display_name": "Founder Test",
    "password": "Strong-Founder1!",
}


def founder(client: TestClient):
    response = client.post("/api/v1/auth/register-founder", json=FOUNDER, headers={"X-Kravia-Bootstrap-Key": "test-bootstrap-secret-at-least-32-characters"})
    assert response.status_code == 201, response.text
    return response.json()


def aal2_founder(client: TestClient):
    initial = founder(client)
    access = initial["access_token"]
    enrolled = client.post(
        "/api/v1/auth/mfa/enroll",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert enrolled.status_code == 200, enrolled.text
    manual_key = enrolled.json()["manual_key"]
    verified = client.post(
        "/api/v1/auth/mfa/verify",
        headers={"Authorization": f"Bearer {access}"},
        json={"code": pyotp.TOTP(manual_key).now()},
    )
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert body["aal"] == "aal2"
    return body


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
        signed_in = client.post(
            "/api/v1/auth/sign-in",
            json={"email": FOUNDER["email"], "password": FOUNDER["password"]},
        )
        assert signed_in.status_code == 200, signed_in.text
        signed = signed_in.json()
        assert signed["aal"] == "aal1"
        assert signed["roles"] == ["OWNER"]

        enrolled = client.post(
            "/api/v1/auth/mfa/enroll",
            headers={"Authorization": f"Bearer {signed['access_token']}"},
        )
        assert enrolled.status_code == 200, enrolled.text
        assert enrolled.json()["qr_code"].startswith("data:image/png;base64,")

        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {signed['access_token']}"},
            json={"code": pyotp.TOTP(enrolled.json()["manual_key"]).now()},
        )
        assert verified.status_code == 200, verified.text
        aal2 = verified.json()
        assert aal2["aal"] == "aal2"

        current = client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {aal2['access_token']}"},
        )
        assert current.status_code == 200, current.text
        assert current.json()["aal"] == "aal2"
        assert current.json()["display_role"] == "FOUNDER"
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
        assert body["mfa_authenticator_app"] == "KRAVIA Authenticator"
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

        enrolled = client.post(
            "/api/v1/auth/mfa/enroll",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
        )
        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": pyotp.TOTP(enrolled.json()["manual_key"]).now()},
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

        enrolled = client.post(
            "/api/v1/auth/mfa/enroll",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
        )
        verified = client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
            json={"code": pyotp.TOTP(enrolled.json()["manual_key"]).now()},
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

        enrolled = client.post(
            "/api/v1/auth/mfa/enroll",
            headers={"Authorization": f"Bearer {signed['access_token']}"},
        )
        assert enrolled.status_code == 200
    finally:
        engine.dispose()


def test_totp_code_cannot_be_replayed_across_office_sessions(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        initial = founder(client)
        enrolled = client.post(
            "/api/v1/auth/mfa/enroll",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
        )
        assert enrolled.status_code == 200, enrolled.text
        secret = enrolled.json()["manual_key"]
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
        enrolled = client.post(
            "/api/v1/auth/mfa/enroll",
            headers={"Authorization": f"Bearer {initial['access_token']}"},
        )
        assert enrolled.status_code == 200
        secret = enrolled.json()["manual_key"]
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
