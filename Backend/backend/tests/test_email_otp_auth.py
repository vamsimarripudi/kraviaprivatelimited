from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend import identity_auth
from backend.auth_models import OfficeAuthUser, OfficePlayReviewerAccess
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


def _capture_device_email(monkeypatch):
    delivered = []

    def send(**kwargs):
        delivered.append(kwargs)
        return "brevo-device-approval-test-message-id"

    monkeypatch.setattr(identity_auth, "send_office_device_approval", send)
    return delivered


def _decide_device(client, notice, decision):
    approval_id = parse_qs(urlparse(notice["review_url"]).query)["id"][0]
    action_token = parse_qs(urlparse(notice["review_url"]).query)["token"][0]
    response = client.post(
        f"/api/v1/auth/device-approvals/{approval_id}/action",
        json={"action_token": action_token, "decision": decision},
    )
    assert response.status_code == 200, response.text
    return approval_id, response.json()


def _complete_device(client, pending):
    response = client.post(
        "/api/v1/auth/device-approvals/complete",
        json={"device_id": pending["device_approval_id"], "device_proof": pending["device_proof"]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _provision_play_reviewer(engine):
    user = OfficeAuthUser(
        id="8d777f62-5bbc-4af8-a912-fb3cc9ef6fd0",
        email="play-review@example.test",
        display_name="Google Play Reviewer",
        password_hash=identity_auth.PASSWORD_HASHER.hash("Review-Only-Passphrase-2026!"),
        status="ACTIVE",
    )
    reviewer = OfficePlayReviewerAccess(
        id="3d98c5cc-f623-4cfe-839c-3de0cdca7150",
        user_id=user.id,
        otp_code_hash=identity_auth.PASSWORD_HASHER.hash("246810"),
        enabled=True,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    with Session(engine) as db:
        db.add(user)
        db.flush()
        db.add(reviewer)
        user_id, email, reviewer_id = user.id, user.email, reviewer.id
        db.commit()
    return user_id, email, reviewer_id


def test_device_approval_link_is_pinned_to_the_canonical_web_origin(monkeypatch):
    """A public email must not use Railway, the redirecting apex or an arbitrary host."""
    approval_id = "11111111-1111-4111-8111-111111111111"
    action_token = "synthetic-token-value-which-is-long-enough-123456"
    for configured_base_url in (
        "https://kravia-office-api-production.up.railway.app",
        "https://kraviaprivatelimited.com",
        "https://www.kraviaprivatelimited.com:8443",
        "http://www.kraviaprivatelimited.com",
        "https://attacker.example",
    ):
        monkeypatch.setenv("PUBLIC_BASE_URL", configured_base_url)
        url = identity_auth._device_approval_review_url(approval_id, action_token)

        assert url.startswith("https://www.kraviaprivatelimited.com/office/device-approval/confirm?")
        assert f"id={approval_id}" in url
        assert "decision=" not in url


def test_play_reviewer_can_activate_authenticator_without_email_but_never_access_office(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        reviewer_id, reviewer_email, reviewer_access_id = _provision_play_reviewer(engine)
        deliveries = []
        monkeypatch.setattr(
            identity_auth,
            "send_office_email_verification_code",
            lambda **kwargs: deliveries.append(kwargs),
        )

        challenge = client.post(
            "/api/v1/auth/email-otp/challenges",
            json={
                "email": reviewer_email,
                "password": "Review-Only-Passphrase-2026!",
                "channel": "authenticator_mobile",
            },
        )
        assert challenge.status_code == 201, challenge.text
        body = challenge.json()
        assert body["verification_method"] == "PLAY_REVIEW"
        assert "code" not in body
        assert deliveries == []

        wrong_code = client.post(
            f"/api/v1/auth/email-otp/challenges/{body['challenge_id']}/verify",
            json={"challenge_token": body["challenge_token"], "code": "000000"},
        )
        assert wrong_code.status_code == 400, wrong_code.text

        verified = client.post(
            f"/api/v1/auth/email-otp/challenges/{body['challenge_id']}/verify",
            json={"challenge_token": body["challenge_token"], "code": "246810"},
        )
        assert verified.status_code == 200, verified.text
        session = verified.json()
        assert session["authenticated"] is True
        assert session["session_purpose"] == identity_auth.AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE
        assert session["roles"] == []
        assert session["display_role"] == "PLAY_REVIEWER"
        assert session["review_device"]["device_approval_id"]
        assert session["review_device"]["device_proof"]

        web_login = client.post(
            "/api/v1/auth/sign-in",
            json={"email": reviewer_email, "password": "Review-Only-Passphrase-2026!"},
        )
        assert web_login.status_code == 403
        assert "limited to Authenticator" in web_login.json()["detail"]
        office_session = client.get(
            "/api/v1/auth/session",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )
        assert office_session.status_code == 403

        activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )
        assert activation.status_code == 200, activation.text
        claim = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{activation.json()['request_id']}/claim",
            json={"claim_token": activation.json()["claim_token"]},
        )
        assert claim.status_code == 200, claim.text
        assert claim.json()["account"] == reviewer_email

        with Session(engine) as db:
            stored = db.get(OfficePlayReviewerAccess, reviewer_access_id)
            assert stored is not None
            stored.enabled = False
            db.commit()

        refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": session["refresh_token"]})
        assert refreshed.status_code == 403
    finally:
        engine.dispose()


def test_email_otp_requires_registered_mailbox_to_trust_a_new_device_before_issuing_a_scoped_session(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        founder(client)
        challenge, delivered = request_code(client, monkeypatch)
        device_notices = _capture_device_email(monkeypatch)

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
        pending = verified.json()
        assert pending["authenticated"] is False
        assert pending["device_approval_pending"] is True
        assert pending["email"] == FOUNDER["email"]
        assert "refresh_token" not in pending
        assert len(device_notices) == 1
        assert device_notices[0]["recipient_email"] == FOUNDER["email"]
        assert "decision=" not in device_notices[0]["review_url"]

        review_query = parse_qs(urlparse(device_notices[0]["review_url"]).query)
        review = client.post(
            f"/api/v1/auth/device-approvals/{pending['device_approval_id']}/review",
            json={"action_token": review_query["token"][0]},
        )
        assert review.status_code == 200, review.text
        assert review.json()["status"] == "PENDING"
        assert review.json()["device_label"] == pending["device_label"]
        assert review.json()["location"] is None

        approval_id, decision = _decide_device(client, device_notices[0], "APPROVE")
        assert approval_id == pending["device_approval_id"]
        assert decision == {"decided": True, "status": "APPROVED"}
        approved_review = client.post(
            f"/api/v1/auth/device-approvals/{approval_id}/review",
            json={"action_token": review_query["token"][0]},
        )
        assert approved_review.status_code == 200, approved_review.text
        assert approved_review.json()["status"] == "APPROVED"
        session = _complete_device(client, pending)
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

        first_activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            headers={"Authorization": f"Bearer {refreshed_session['access_token']}"},
        )
        assert first_activation.status_code == 200, first_activation.text
        assert first_activation.json()["status"] == "APPROVED"
        assert first_activation.json()["approval_required"] is False

        # A role-holder cannot approve another person's phone.  The only
        # authority is the registered-mailbox Trust decision above.
        retired_approval = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{first_activation.json()['request_id']}/approve",
        )
        assert retired_approval.status_code == 410

        first_claim = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{first_activation.json()['request_id']}/claim",
            json={"claim_token": first_activation.json()["claim_token"]},
        )
        assert first_claim.status_code == 200, first_claim.text
        assert first_claim.json()["status"] == "ENROLLED"
        assert first_claim.json()["account"] == FOUNDER["email"]
        assert first_claim.json()["digits"] == 6
        assert first_claim.json()["period"] == 30

        # A replacement phone receives a new local factor.  It replaces, not
        # adds to, the former factor, so a code held by the prior phone stops
        # validating after this claim succeeds.
        replacement_activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            headers={"Authorization": f"Bearer {refreshed_session['access_token']}"},
        )
        assert replacement_activation.status_code == 200, replacement_activation.text
        replacement_claim = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{replacement_activation.json()['request_id']}/claim",
            json={"claim_token": replacement_activation.json()["claim_token"]},
        )
        assert replacement_claim.status_code == 200, replacement_claim.text
        assert replacement_claim.json()["secret"] != first_claim.json()["secret"]

        same_device_challenge, _ = request_code(client, monkeypatch, code="593741")
        same_device = client.post(
            f"/api/v1/auth/email-otp/challenges/{same_device_challenge['challenge_id']}/verify",
            json={
                "challenge_token": same_device_challenge["challenge_token"],
                "code": "593741",
                "device_approval_id": pending["device_approval_id"],
                "device_proof": pending["device_proof"],
            },
        )
        assert same_device.status_code == 200, same_device.text
        assert same_device.json()["authenticated"] is True
        assert len(device_notices) == 1

        replay = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "482915"},
        )
        assert replay.status_code == 409

        with engine.connect() as connection:
            row = connection.execute(
                text(
                    "select code_hash, challenge_token_hash, status from office_email_otp_challenges "
                    "where id = :id"
                ),
                {"id": challenge["challenge_id"]},
            ).mappings().one()
        assert row["status"] == "VERIFIED"
        assert row["code_hash"] != "482915"
        assert row["challenge_token_hash"] != challenge["challenge_token"]
    finally:
        engine.dispose()


def test_device_trust_replaces_the_previous_device_and_ignore_revokes_the_pending_session(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        founder(client)
        device_notices = _capture_device_email(monkeypatch)

        first_challenge, _ = request_code(client, monkeypatch, code="482915")
        first_pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{first_challenge['challenge_id']}/verify",
            json={"challenge_token": first_challenge["challenge_token"], "code": "482915"},
        ).json()
        _decide_device(client, device_notices[-1], "APPROVE")
        first_session = _complete_device(client, first_pending)
        stale_activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            headers={"Authorization": f"Bearer {first_session['access_token']}"},
        )
        assert stale_activation.status_code == 200, stale_activation.text

        second_challenge, _ = request_code(client, monkeypatch, code="593741")
        second_pending_response = client.post(
            f"/api/v1/auth/email-otp/challenges/{second_challenge['challenge_id']}/verify",
            json={"challenge_token": second_challenge["challenge_token"], "code": "593741"},
        )
        assert second_pending_response.status_code == 200, second_pending_response.text
        second_pending = second_pending_response.json()
        _decide_device(client, device_notices[-1], "APPROVE")
        _complete_device(client, second_pending)

        old_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": first_session["refresh_token"]})
        assert old_refresh.status_code == 401
        old_status = client.post(
            "/api/v1/auth/device-approvals/status",
            json={"device_id": first_pending["device_approval_id"], "device_proof": first_pending["device_proof"]},
        )
        assert old_status.status_code == 200
        assert old_status.json()["status"] == "REVOKED"
        stale_claim = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{stale_activation.json()['request_id']}/claim",
            json={"claim_token": stale_activation.json()["claim_token"]},
        )
        assert stale_claim.status_code == 409

        ignored_challenge, _ = request_code(client, monkeypatch, code="763924")
        ignored_pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{ignored_challenge['challenge_id']}/verify",
            json={"challenge_token": ignored_challenge["challenge_token"], "code": "763924"},
        ).json()
        _, ignored = _decide_device(client, device_notices[-1], "DECLINE")
        assert ignored == {"decided": True, "status": "DECLINED"}
        completion = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": ignored_pending["device_approval_id"], "device_proof": ignored_pending["device_proof"]},
        )
        assert completion.status_code == 409

        with engine.connect() as connection:
            trusted_count = connection.execute(
                text("select count(*) from office_login_device_approvals where status = 'TRUSTED'")
            ).scalar_one()
            ignored_session = connection.execute(
                text(
                    "select status from office_auth_sessions_v2 where id = "
                    "(select session_id from office_login_device_approvals where id = :id)"
                ),
                {"id": ignored_pending["device_approval_id"]},
            ).scalar_one()
        assert trusted_count == 1
        assert ignored_session == "REVOKED"
    finally:
        engine.dispose()


def test_device_replacement_revokes_before_promoting_under_the_database_invariant(tmp_path, monkeypatch):
    """The replacement transaction must respect PostgreSQL's partial index.

    Production has a partial unique index allowing one TRUSTED approval per
    user.  A normal ORM commit may sort dirty rows by primary key, which can
    otherwise promote a newly approved request before it persists the old
    trusted row as REVOKED.  Use an intentionally lower second UUID to make
    the unsafe ordering deterministic on SQLite as well.
    """
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        founder(client)
        device_notices = _capture_device_email(monkeypatch)

        first_challenge, _ = request_code(client, monkeypatch, code="482915")
        first_pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{first_challenge['challenge_id']}/verify",
            json={"challenge_token": first_challenge["challenge_token"], "code": "482915"},
        ).json()
        _decide_device(client, device_notices[-1], "APPROVE")
        _complete_device(client, first_pending)

        with engine.begin() as connection:
            connection.execute(
                text(
                    "create unique index uq_office_login_device_approvals_one_trusted_user "
                    "on office_login_device_approvals (user_id) where status = 'TRUSTED'"
                )
            )

        second_challenge, _ = request_code(client, monkeypatch, code="593741")
        pending_response = client.post(
            f"/api/v1/auth/email-otp/challenges/{second_challenge['challenge_id']}/verify",
            json={"challenge_token": second_challenge["challenge_token"], "code": "593741"},
        )
        assert pending_response.status_code == 200, pending_response.text
        second_pending = pending_response.json()
        original_id = second_pending["device_approval_id"]
        ordered_id = "00000000-0000-4000-8000-000000000001"
        with engine.begin() as connection:
            connection.execute(
                text("update office_login_device_approvals set id = :new_id where id = :old_id"),
                {"new_id": ordered_id, "old_id": original_id},
            )
        second_pending["device_approval_id"] = ordered_id
        action_token = parse_qs(urlparse(device_notices[-1]["review_url"]).query)["token"][0]
        approved = client.post(
            f"/api/v1/auth/device-approvals/{ordered_id}/action",
            json={"action_token": action_token, "decision": "APPROVE"},
        )
        assert approved.status_code == 200, approved.text

        completed = client.post(
            "/api/v1/auth/device-approvals/complete",
            json={"device_id": ordered_id, "device_proof": second_pending["device_proof"]},
        )
        assert completed.status_code == 200, completed.text

        with engine.connect() as connection:
            trusted_count = connection.execute(
                text("select count(*) from office_login_device_approvals where status = 'TRUSTED'")
            ).scalar_one()
            first_status = connection.execute(
                text("select status from office_login_device_approvals where id = :id"),
                {"id": first_pending["device_approval_id"]},
            ).scalar_one()
        assert trusted_count == 1
        assert first_status == "REVOKED"
    finally:
        engine.dispose()


def test_native_trusted_device_removal_revokes_server_session_and_activation(tmp_path, monkeypatch):
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        founder(client)
        device_notices = _capture_device_email(monkeypatch)
        challenge, _ = request_code(client, monkeypatch)
        pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "482915"},
        ).json()
        _decide_device(client, device_notices[-1], "APPROVE")
        session = _complete_device(client, pending)
        activation = client.post(
            "/api/v1/auth/authenticator/activation-requests",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )
        assert activation.status_code == 200, activation.text

        removed = client.post(
            "/api/v1/auth/device-approvals/revoke",
            headers={"Authorization": f"Bearer {session['access_token']}"},
            json={"device_id": pending["device_approval_id"], "device_proof": pending["device_proof"]},
        )
        assert removed.status_code == 200, removed.text
        assert removed.json() == {"revoked": True}
        assert client.post("/api/v1/auth/refresh", json={"refresh_token": session["refresh_token"]}).status_code == 401
        claim = client.post(
            f"/api/v1/auth/authenticator/activation-requests/{activation.json()['request_id']}/claim",
            json={"claim_token": activation.json()["claim_token"]},
        )
        assert claim.status_code == 409
    finally:
        engine.dispose()


def test_native_authenticator_session_can_sign_out_with_its_own_capability(tmp_path, monkeypatch):
    """A mobile-only session may revoke itself but cannot gain Office access."""
    client, engine = make_client(tmp_path, monkeypatch)
    try:
        monkeypatch.setattr(identity_auth, "DEVICE_APPROVAL_REQUIRED", True)
        founder(client)
        device_notices = _capture_device_email(monkeypatch)
        challenge, _ = request_code(client, monkeypatch)
        pending = client.post(
            f"/api/v1/auth/email-otp/challenges/{challenge['challenge_id']}/verify",
            json={"challenge_token": challenge["challenge_token"], "code": "482915"},
        ).json()
        _decide_device(client, device_notices[-1], "APPROVE")
        session = _complete_device(client, pending)

        signed_out = client.post(
            "/api/v1/auth/sign-out",
            headers={"Authorization": f"Bearer {session['access_token']}"},
        )
        assert signed_out.status_code == 200, signed_out.text
        assert signed_out.json() == {"signed_out": True}
        assert client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": session["refresh_token"]},
        ).status_code == 401
        with engine.connect() as connection:
            trust_status = connection.execute(
                text("select status from office_login_device_approvals where id = :id"),
                {"id": pending["device_approval_id"]},
            ).scalar_one()
        assert trust_status == "TRUSTED"
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
        device_notices = _capture_device_email(monkeypatch)
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
        assert new_code.json()["device_approval_pending"] is True
        assert len(device_notices) == 1
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
