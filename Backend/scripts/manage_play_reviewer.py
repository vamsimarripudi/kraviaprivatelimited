"""Provision, inspect, or revoke the isolated Google Play review identity.

This operational command deliberately reads credentials from protected process
environment variables.  It never accepts them on the command line and never
prints them, so shell history and deployment logs do not become a credential
store.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

# Match the repository's documented `python scripts/...` invocation without
# requiring callers to set PYTHONPATH or expose configuration in a shell alias.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import identity_auth
from backend.auth_models import (
    OfficeAuthenticatorActivation,
    OfficeAuthEvent,
    OfficeAuthRole,
    OfficeAuthSession,
    OfficeAuthUser,
    OfficeLoginDeviceApproval,
    OfficePlayReviewerAccess,
)
from backend.database import SessionLocal


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def _reviewer_email() -> str:
    return identity_auth._normalize_email(_required_env("KRAVIA_PLAY_REVIEWER_EMAIL"))


def _reviewer_expiry() -> datetime:
    raw = _required_env("KRAVIA_PLAY_REVIEWER_EXPIRES_AT")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeError("KRAVIA_PLAY_REVIEWER_EXPIRES_AT must be ISO-8601 with a timezone") from exc
    if parsed.tzinfo is None:
        raise RuntimeError("KRAVIA_PLAY_REVIEWER_EXPIRES_AT must include a timezone")
    expiry = parsed.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    if expiry <= now:
        raise RuntimeError("KRAVIA_PLAY_REVIEWER_EXPIRES_AT must be in the future")
    if expiry > now + timedelta(days=365):
        raise RuntimeError("KRAVIA_PLAY_REVIEWER_EXPIRES_AT must be no more than one year away")
    return expiry


def _as_utc(value: datetime) -> datetime:
    """SQLite local rehearsals may deserialize timezone-aware columns naively."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _revoke_live_capabilities(db, user_id: str, now: datetime) -> None:
    for session in db.execute(
        select(OfficeAuthSession).where(
            OfficeAuthSession.user_id == user_id,
            OfficeAuthSession.status.in_(["ACTIVE", "PENDING_DEVICE_APPROVAL"]),
        )
    ).scalars():
        session.status = "REVOKED"
        session.revoked_at = now
    for device in db.execute(
        select(OfficeLoginDeviceApproval).where(
            OfficeLoginDeviceApproval.user_id == user_id,
            OfficeLoginDeviceApproval.status.in_(["PENDING", "APPROVED", "TRUSTED"]),
        )
    ).scalars():
        device.status = "REVOKED"
        device.trusted_until = now
    for activation in db.execute(
        select(OfficeAuthenticatorActivation).where(
            OfficeAuthenticatorActivation.user_id == user_id,
            OfficeAuthenticatorActivation.status.in_(["PENDING", "APPROVED"]),
        )
    ).scalars():
        activation.status = "CANCELLED"
        activation.cancelled_at = now


def _event(db, event_type: str, user_id: str) -> None:
    db.add(
        OfficeAuthEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            event_type=event_type,
            metadata_json=json.dumps({"operator": "play-reviewer-management"}, sort_keys=True),
        )
    )


def provision() -> dict[str, str | bool]:
    email = _reviewer_email()
    password = _required_env("KRAVIA_PLAY_REVIEWER_PASSWORD")
    code = _required_env("KRAVIA_PLAY_REVIEWER_OTP")
    display_name = os.getenv("KRAVIA_PLAY_REVIEWER_DISPLAY_NAME", "Google Play Reviewer").strip() or "Google Play Reviewer"
    if not code.isdigit() or len(code) != 6:
        raise RuntimeError("KRAVIA_PLAY_REVIEWER_OTP must be exactly six digits")
    identity_auth._validate_password(password)
    expiry = _reviewer_expiry()
    now = datetime.now(timezone.utc)

    with SessionLocal.begin() as db:
        user = db.execute(select(OfficeAuthUser).where(OfficeAuthUser.email == email)).scalar_one_or_none()
        reviewer = None
        if user:
            reviewer = db.execute(
                select(OfficePlayReviewerAccess).where(OfficePlayReviewerAccess.user_id == user.id)
            ).scalar_one_or_none()
            if not reviewer:
                raise RuntimeError("The configured reviewer email belongs to an existing non-reviewer identity")
            if db.execute(select(OfficeAuthRole.id).where(OfficeAuthRole.user_id == user.id)).first():
                raise RuntimeError("A reviewer identity must not hold an Office role")
        else:
            user = OfficeAuthUser(
                id=str(uuid.uuid4()),
                email=email,
                display_name=display_name[:160],
                password_hash=identity_auth.PASSWORD_HASHER.hash(password),
                status="ACTIVE",
            )
            db.add(user)
            db.flush()

        _revoke_live_capabilities(db, user.id, now)
        user.display_name = display_name[:160]
        user.password_hash = identity_auth.PASSWORD_HASHER.hash(password)
        user.password_changed_at = now
        user.status = "ACTIVE"
        user.mfa_secret_ciphertext = None
        user.mfa_verified_at = None
        user.mfa_last_accepted_counter = None
        user.failed_login_count = 0
        user.locked_until = None

        if reviewer is None:
            reviewer = OfficePlayReviewerAccess(
                id=str(uuid.uuid4()),
                user_id=user.id,
                otp_code_hash=identity_auth.PASSWORD_HASHER.hash(code),
                enabled=True,
                expires_at=expiry,
            )
            db.add(reviewer)
        else:
            reviewer.otp_code_hash = identity_auth.PASSWORD_HASHER.hash(code)
            reviewer.enabled = True
            reviewer.expires_at = expiry
            reviewer.disabled_at = None
            reviewer.last_used_at = None
        _event(db, "PLAY_REVIEWER_PROVISIONED", user.id)

    return {"email": email, "enabled": True, "expires_at": expiry.isoformat()}


def disable() -> dict[str, str | bool]:
    email = _reviewer_email()
    now = datetime.now(timezone.utc)
    with SessionLocal.begin() as db:
        user = db.execute(select(OfficeAuthUser).where(OfficeAuthUser.email == email)).scalar_one_or_none()
        if not user:
            raise RuntimeError("Google Play reviewer identity was not found")
        reviewer = db.execute(
            select(OfficePlayReviewerAccess).where(OfficePlayReviewerAccess.user_id == user.id)
        ).scalar_one_or_none()
        if not reviewer:
            raise RuntimeError("Configured identity is not a Google Play reviewer")
        reviewer.enabled = False
        reviewer.disabled_at = now
        _revoke_live_capabilities(db, user.id, now)
        _event(db, "PLAY_REVIEWER_DISABLED", user.id)
        expiry = _as_utc(reviewer.expires_at).isoformat()
    return {"email": email, "enabled": False, "expires_at": expiry}


def status() -> dict[str, str | bool | None]:
    email = _reviewer_email()
    with SessionLocal() as db:
        user = db.execute(select(OfficeAuthUser).where(OfficeAuthUser.email == email)).scalar_one_or_none()
        reviewer = (
            db.execute(select(OfficePlayReviewerAccess).where(OfficePlayReviewerAccess.user_id == user.id)).scalar_one_or_none()
            if user
            else None
        )
        if not reviewer:
            return {"email": email, "configured": False, "enabled": False, "expires_at": None}
        active = reviewer.enabled and reviewer.disabled_at is None and _as_utc(reviewer.expires_at) > datetime.now(timezone.utc)
        return {
            "email": email,
            "configured": True,
            "enabled": active,
            "expires_at": _as_utc(reviewer.expires_at).isoformat(),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("provision", "disable", "status"))
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required for provision or disable because those commands revoke active reviewer capabilities.",
    )
    args = parser.parse_args()
    if args.command in {"provision", "disable"} and not args.confirm:
        parser.error("--confirm is required for a state-changing reviewer operation")
    try:
        result = {"provision": provision, "disable": disable, "status": status}[args.command]()
    except RuntimeError as exc:
        print(f"play-reviewer: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
