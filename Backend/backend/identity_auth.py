"""KRAVIA-owned identity, registration, session and MFA APIs.

Supabase Auth is intentionally not part of this boundary. PostgreSQL remains the
persistence layer, while KRAVIA owns password hashing, session issuance, MFA,
bootstrap registration and private invitation links.

The browser never talks to these APIs directly in production. The canonical
Next.js application acts as a same-origin BFF and stores access/refresh tokens
in HttpOnly, SameSite=Strict cookies.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from urllib.parse import urlencode, urlsplit

import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import inspect, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth_models import (
    OfficeAuthenticatorActivation,
    OfficeAuthEvent,
    OfficeAuthInvite,
    OfficeAuthRole,
    OfficeAuthSession,
    OfficeAuthUser,
    OfficeEmailOtpChallenge,
    OfficeLoginDeviceApproval,
)
from .database import get_db
from .email_delivery import (
    EmailDeliveryRejected,
    EmailDeliveryUnavailable,
    EmailDeliveryUnknown,
    send_office_device_approval,
    send_office_email_verification_code,
)

ACCESS_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_ACCESS_TTL_SECONDS", "1800"))
REFRESH_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_REFRESH_TTL_SECONDS", str(7 * 24 * 60 * 60)))
INVITE_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_INVITE_TTL_SECONDS", str(72 * 60 * 60)))
MAX_FAILED_LOGINS = int(os.getenv("OFFICE_AUTH_MAX_FAILED_LOGINS", "5"))
LOCKOUT_SECONDS = int(os.getenv("OFFICE_AUTH_LOCKOUT_SECONDS", "900"))
RECOVERY_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_RECOVERY_TTL_SECONDS", "1800"))
ISSUER = os.getenv("OFFICE_AUTH_ISSUER", "kravia-office")
AUDIENCE = os.getenv("OFFICE_AUTH_AUDIENCE", "kravia-office-api")
FOUNDER_SLOT = "PRIMARY_FOUNDER"
MFA_ISSUER = "KRAVIA Office"
MFA_AUTHENTICATOR_APP = "Authenticator"
MFA_ALGORITHM = "SHA1"
MFA_DIGITS = 6
MFA_PERIOD_SECONDS = 30
MFA_MAX_FAILED_ATTEMPTS = int(os.getenv("OFFICE_AUTH_MFA_MAX_FAILED_ATTEMPTS", "5"))
AUTHENTICATOR_ACTIVATION_TTL_SECONDS = int(os.getenv("OFFICE_AUTHENTICATOR_ACTIVATION_TTL_SECONDS", "600"))
EMAIL_OTP_TTL_SECONDS = int(os.getenv("OFFICE_EMAIL_OTP_TTL_SECONDS", "600"))
EMAIL_OTP_RESEND_INTERVAL_SECONDS = int(os.getenv("OFFICE_EMAIL_OTP_RESEND_INTERVAL_SECONDS", "60"))
EMAIL_OTP_MAX_ATTEMPTS = int(os.getenv("OFFICE_EMAIL_OTP_MAX_ATTEMPTS", "5"))
EMAIL_OTP_MOBILE_REFRESH_TTL_SECONDS = int(os.getenv("OFFICE_EMAIL_OTP_MOBILE_REFRESH_TTL_SECONDS", str(30 * 24 * 60 * 60)))
DEVICE_APPROVAL_REQUIRED = os.getenv("OFFICE_DEVICE_APPROVAL_REQUIRED", "true").strip().lower() == "true"
DEVICE_APPROVAL_TTL_SECONDS = int(os.getenv("OFFICE_DEVICE_APPROVAL_TTL_SECONDS", "900"))
DEVICE_TRUST_TTL_SECONDS = int(os.getenv("OFFICE_DEVICE_TRUST_TTL_SECONDS", str(30 * 24 * 60 * 60)))
OFFICE_SESSION_PURPOSE = "OFFICE"
AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE = "AUTHENTICATOR_ACTIVATION"

OFFICE_ROLES = {
    "OWNER",
    "DIRECTOR",
    "ADMIN",
    "MEMBER",
    "FINANCE",
    "CA",
    "CS",
    "LEGAL",
    "HR",
    "OPERATIONS",
    "AUDITOR",
    "PRODUCT_ADMIN",
}
INVITABLE_ROLES = OFFICE_ROLES - {"OWNER"}
PRIVILEGED_DELEGATION_ROLES = {"OWNER", "DIRECTOR", "ADMIN"}
ADMIN_ASSIGNABLE_ROLES = INVITABLE_ROLES - PRIVILEGED_DELEGATION_ROLES
PASSWORD_HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)


class FounderRegisterPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class SignInPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class RefreshPayload(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=512)


class MfaVerifyPayload(BaseModel):
    code: str = Field(pattern=r"^[0-9]{6}$")
    device_approval_id: str | None = Field(default=None, min_length=36, max_length=36)
    device_proof: str | None = Field(default=None, min_length=32, max_length=256)


class DeviceApprovalActionPayload(BaseModel):
    action_token: str = Field(min_length=32, max_length=256)
    decision: Literal["APPROVE", "DECLINE"]


class DeviceApprovalProofPayload(BaseModel):
    device_id: str = Field(min_length=36, max_length=36)
    device_proof: str = Field(min_length=32, max_length=256)


class AuthenticatorActivationClaimPayload(BaseModel):
    claim_token: str = Field(min_length=32, max_length=256)


class EmailOtpChallengePayload(SignInPayload):
    channel: Literal["authenticator_mobile"]


class EmailOtpChallengeTokenPayload(BaseModel):
    challenge_token: str = Field(min_length=32, max_length=256)


class EmailOtpVerifyPayload(EmailOtpChallengeTokenPayload):
    code: str = Field(pattern=r"^[0-9]{6}$")


class DeviceEventPayload(BaseModel):
    device_id: str = Field(min_length=36, max_length=36)
    action: str = Field(pattern=r"^(LINKED|UNLINKED)$")


class PasswordChangePayload(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class RecoveryIssuePayload(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class RecoveryCompletePayload(BaseModel):
    token: str = Field(min_length=64, max_length=4096)
    new_password: str = Field(min_length=12, max_length=256)


class InviteCreatePayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=64)
    roles: list[str] = Field(min_length=1, max_length=6)
    reason: str = Field(min_length=3, max_length=500)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, values: list[str]) -> list[str]:
        normalized = sorted({str(value).strip().upper() for value in values})
        if not normalized or any(role not in INVITABLE_ROLES for role in normalized):
            raise ValueError("Invitation includes a role that cannot be assigned")
        if "AUDITOR" in normalized and any(role in normalized for role in {"DIRECTOR", "ADMIN", "FINANCE"}):
            raise ValueError("AUDITOR cannot be combined with privileged or finance-execution roles")
        return normalized


class InviteRegisterPayload(BaseModel):
    token: str = Field(min_length=32, max_length=512)
    display_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=12, max_length=256)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _bootstrap_secret() -> str:
    secret = os.getenv("OFFICE_AUTH_BOOTSTRAP_SECRET", "").strip()
    if len(secret) < 32:
        raise RuntimeError("OFFICE_AUTH_BOOTSTRAP_SECRET must be at least 32 characters")
    return secret


def _signing_secret() -> str:
    secret = os.getenv("OFFICE_AUTH_SIGNING_SECRET", "").strip()
    if len(secret) < 32:
        raise RuntimeError("OFFICE_AUTH_SIGNING_SECRET must be at least 32 characters")
    return secret


def _break_glass_secret() -> str:
    secret = os.getenv("OFFICE_AUTH_BREAK_GLASS_SECRET", "").strip()
    if len(secret) < 48:
        raise RuntimeError("OFFICE_AUTH_BREAK_GLASS_SECRET must be at least 48 characters")
    return secret


def break_glass_configured() -> bool:
    try:
        _break_glass_secret()
        return True
    except RuntimeError:
        return False


def first_party_auth_configured() -> bool:
    try:
        _signing_secret()
        return True
    except RuntimeError:
        return False


def validate_first_party_auth_configuration() -> None:
    _signing_secret()
    _bootstrap_secret()


def _fernet() -> Fernet:
    digest = hashlib.sha256((_signing_secret() + "|mfa-at-rest").encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt_mfa_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def _decrypt_mfa_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise HTTPException(status_code=503, detail="MFA credential store is unavailable") from exc


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) > 320 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
        raise ValueError("Invalid email address")
    allowed_domain = os.getenv("OFFICE_AUTH_EMAIL_DOMAIN", "kraviaprivatelimited.com").strip().lower()
    if allowed_domain and not normalized.endswith("@" + allowed_domain):
        raise ValueError("Use an authorised KRAVIA corporate email")
    return normalized


def _validate_password(password: str) -> None:
    if len(password) < 12:
        raise HTTPException(status_code=400, detail="Password must contain at least 12 characters")
    tests = (
        any(char.islower() for char in password),
        any(char.isupper() for char in password),
        any(char.isdigit() for char in password),
        any(not char.isalnum() for char in password),
    )
    if not all(tests):
        raise HTTPException(
            status_code=400,
            detail="Password must include uppercase, lowercase, number and symbol characters",
        )


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _email_otp_code_hash(challenge_id: str, code: str) -> str:
    """Hash a six-digit code with the private identity signing secret as pepper."""
    material = f"email-otp|{challenge_id}|{code}".encode()
    return hmac.new(_signing_secret().encode(), material, hashlib.sha256).hexdigest()


def _email_otp_settings() -> tuple[int, int, int, int]:
    values = (
        EMAIL_OTP_TTL_SECONDS,
        EMAIL_OTP_RESEND_INTERVAL_SECONDS,
        EMAIL_OTP_MAX_ATTEMPTS,
        EMAIL_OTP_MOBILE_REFRESH_TTL_SECONDS,
    )
    ttl, resend_interval, max_attempts, mobile_refresh_ttl = values
    if not 60 <= ttl <= 1800:
        raise HTTPException(status_code=503, detail="Email verification duration is not configured")
    if not 30 <= resend_interval <= ttl:
        raise HTTPException(status_code=503, detail="Email verification resend policy is not configured")
    if not 1 <= max_attempts <= 10:
        raise HTTPException(status_code=503, detail="Email verification attempt policy is not configured")
    if mobile_refresh_ttl != 30 * 24 * 60 * 60:
        raise HTTPException(status_code=503, detail="Mobile session duration is not configured")
    return values


def _email_otp_json(
    challenge: OfficeEmailOtpChallenge,
    user: OfficeAuthUser,
    *,
    challenge_token: str,
) -> dict[str, str]:
    return {
        "challenge_id": challenge.id,
        "challenge_token": challenge_token,
        "email": user.email,
        "expires_at": _aware(challenge.expires_at).isoformat(),
        "resend_available_at": _aware(challenge.resend_available_at).isoformat(),
    }


def _expire_email_otp_challenge(challenge: OfficeEmailOtpChallenge, now: datetime) -> bool:
    if challenge.status in {"PENDING", "SENT", "DELIVERY_UNKNOWN"} and _aware(challenge.expires_at) <= now:
        challenge.status = "EXPIRED"
        return True
    return False


def _request_metadata(request: Request) -> tuple[str | None, str | None]:
    # Forwarding headers are client-controlled unless a trusted proxy boundary
    # rewrites and authenticates them. This application does not configure one,
    # so audit and session records retain only the direct ASGI peer address.
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "").strip()
    user_agent_hash = hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else None
    return ip[:64] if ip else None, user_agent_hash


def _device_approval_ttl_seconds() -> int:
    """Return the bounded lifetime for a first-use browser approval request."""
    if not 300 <= DEVICE_APPROVAL_TTL_SECONDS <= 3600:
        raise RuntimeError("OFFICE_DEVICE_APPROVAL_TTL_SECONDS must be between 300 and 3600 seconds")
    return DEVICE_APPROVAL_TTL_SECONDS


def _device_trust_ttl_seconds() -> int:
    if not 86400 <= DEVICE_TRUST_TTL_SECONDS <= 90 * 24 * 60 * 60:
        raise RuntimeError("OFFICE_DEVICE_TRUST_TTL_SECONDS must be between 1 and 90 days")
    return DEVICE_TRUST_TTL_SECONDS


def _device_label(request: Request) -> str:
    """Create a bounded descriptive label without retaining the raw user agent."""
    agent = request.headers.get("user-agent", "").lower()
    platform = "web device"
    if "iphone" in agent:
        platform = "iPhone"
    elif "ipad" in agent:
        platform = "iPad"
    elif "android" in agent:
        platform = "Android device"
    elif "windows" in agent:
        platform = "Windows device"
    elif "mac os" in agent or "macintosh" in agent:
        platform = "Mac"
    elif "linux" in agent:
        platform = "Linux device"

    browser = "Browser"
    if "edg/" in agent:
        browser = "Microsoft Edge"
    elif "firefox/" in agent:
        browser = "Firefox"
    elif "chrome/" in agent or "crios/" in agent:
        browser = "Chrome"
    elif "safari/" in agent:
        browser = "Safari"
    return f"{browser} on {platform}"[:160]


def _public_web_origin() -> str:
    """Use only a canonical HTTPS public origin in owner-action email links."""
    candidate = os.getenv("PUBLIC_BASE_URL", "https://www.kraviaprivatelimited.com").strip()
    parsed = urlsplit(candidate)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        return "https://www.kraviaprivatelimited.com"
    return f"https://{parsed.netloc}"


def _device_approval_action_url(approval_id: str, action_token: str, decision: Literal["approve", "decline"]) -> str:
    query = urlencode({"id": approval_id, "token": action_token, "decision": decision})
    return f"{_public_web_origin()}/office/device-approval/confirm?{query}"


def _expire_device_approval(approval: OfficeLoginDeviceApproval, now: datetime) -> bool:
    if approval.status in {"PENDING", "APPROVED"} and _aware(approval.expires_at) <= now:
        approval.status = "EXPIRED"
        return True
    return False


def _approval_status_json(approval: OfficeLoginDeviceApproval) -> dict[str, Any]:
    return {
        "approval_id": approval.id,
        "status": approval.status,
        "expires_at": _aware(approval.expires_at).isoformat(),
        "device_label": approval.device_label,
    }


def _known_browser_device(
    db: Session,
    user_id: str,
    approval_id: str | None,
    device_proof: str | None,
) -> bool:
    if not approval_id or not device_proof:
        return False
    try:
        normalized_id = str(uuid.UUID(approval_id))
    except ValueError:
        return False
    approval = db.get(OfficeLoginDeviceApproval, normalized_id)
    if not approval or approval.user_id != user_id or approval.status != "TRUSTED":
        return False
    if not approval.trusted_until or _aware(approval.trusted_until) <= _now():
        approval.status = "EXPIRED"
        return False
    return hmac.compare_digest(approval.device_token_hash, _hash_token(device_proof))


def _create_device_approval(
    db: Session,
    *,
    user: OfficeAuthUser,
    session: OfficeAuthSession,
    request: Request,
) -> dict[str, str]:
    """Persist a pending browser request before the external email side effect."""
    now = _now()
    device_token = secrets.token_urlsafe(48)
    action_token = secrets.token_urlsafe(48)
    source_ip, user_agent_hash = _request_metadata(request)
    approval = OfficeLoginDeviceApproval(
        id=str(uuid.uuid4()),
        user_id=user.id,
        session_id=session.id,
        device_token_hash=_hash_token(device_token),
        owner_action_token_hash=_hash_token(action_token),
        status="PENDING",
        source_ip_address=source_ip,
        user_agent_hash=user_agent_hash,
        device_label=_device_label(request),
        expires_at=now + timedelta(seconds=_device_approval_ttl_seconds()),
    )
    session.status = "PENDING_DEVICE_APPROVAL"
    session.aal = "aal2"
    session.last_seen_at = now
    db.add(approval)
    db.flush()
    _event(
        db,
        "DEVICE_APPROVAL_REQUESTED",
        request,
        user_id=user.id,
        session_id=session.id,
        metadata={"approval_id": approval.id, "device_label": approval.device_label},
    )
    return {"approval_id": approval.id, "device_token": device_token, "action_token": action_token}


def _send_device_approval_notice(
    db: Session,
    *,
    user: OfficeAuthUser,
    approval: OfficeLoginDeviceApproval,
    action_token: str,
    request: Request,
) -> None:
    """Deliver once, and fail closed when Brevo has no confirmed outcome."""
    try:
        provider_message_id = send_office_device_approval(
            recipient_email=user.email,
            device_label=approval.device_label,
            source_address=approval.source_ip_address,
            approve_url=_device_approval_action_url(approval.id, action_token, "approve"),
            decline_url=_device_approval_action_url(approval.id, action_token, "decline"),
            delivery_id=f"device-approval:{approval.id}",
        )
    except EmailDeliveryRejected as exc:
        approval.status = "DELIVERY_FAILED"
        session = db.get(OfficeAuthSession, approval.session_id)
        if session:
            session.status = "REVOKED"
            session.revoked_at = _now()
        _event(db, "DEVICE_APPROVAL_DELIVERY_FAILED", request, user_id=user.id, session_id=approval.session_id)
        db.commit()
        raise HTTPException(status_code=503, detail="New-device approval email could not be delivered. Sign in again later.") from exc
    except (EmailDeliveryUnavailable, EmailDeliveryUnknown) as exc:
        approval.status = "DELIVERY_UNKNOWN"
        session = db.get(OfficeAuthSession, approval.session_id)
        if session:
            session.status = "REVOKED"
            session.revoked_at = _now()
        _event(db, "DEVICE_APPROVAL_DELIVERY_UNKNOWN", request, user_id=user.id, session_id=approval.session_id)
        db.commit()
        raise HTTPException(status_code=503, detail="New-device approval could not be confirmed. Sign in again later.") from exc

    approval.provider_message_id = provider_message_id
    _event(db, "DEVICE_APPROVAL_SENT", request, user_id=user.id, session_id=approval.session_id)
    db.commit()


def _event(
    db: Session,
    event_type: str,
    request: Request,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    ip, user_agent_hash = _request_metadata(request)
    db.add(
        OfficeAuthEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            session_id=session_id,
            event_type=event_type,
            ip_address=ip,
            user_agent_hash=user_agent_hash,
            metadata_json=json.dumps(metadata or {}, separators=(",", ":"), sort_keys=True),
        )
    )


def _control_plane_present(db: Session) -> bool:
    bind = db.get_bind()
    cached = getattr(bind, "_kravia_control_plane_present", None)
    if isinstance(cached, bool):
        return cached
    schema = "public" if bind.dialect.name == "postgresql" else None
    inspector = inspect(bind)
    present = inspector.has_table("office_identity_users", schema=schema) and inspector.has_table("office_user_roles", schema=schema)
    # The control-plane schema is immutable during a running production process.
    # Cache the metadata probe on the shared Engine so normal API requests do not
    # perform repeated information_schema lookups.
    setattr(bind, "_kravia_control_plane_present", present)
    return present


def _control_plane_owner_id(db: Session) -> str | None:
    if not _control_plane_present(db):
        return None
    rows = db.execute(
        text(
            """
            select cast(i.user_id as text)
            from office_identity_users i
            join office_user_roles r on r.user_id=i.user_id
            where i.status='ACTIVE' and r.role='OWNER'
              and (r.expires_at is null or r.expires_at > current_timestamp)
            order by i.created_at asc
            limit 2
            """
        )
    ).scalars().all()
    return str(rows[0]) if len(rows) == 1 else None


def _mirror_identity(
    db: Session,
    *,
    user_id: str,
    status: str,
    display_name: str | None,
    roles: list[str],
    created_by: str | None,
    department: str | None = None,
    job_title: str | None = None,
    reason: str = "KRAVIA first-party identity",
) -> None:
    if not _control_plane_present(db):
        return
    db.execute(
        text(
            """
            insert into office_identity_users
              (user_id,status,display_name,primary_department,job_title,created_by)
            values
              (cast(:user_id as uuid),:status,:display_name,:department,:job_title,cast(:created_by as uuid))
            on conflict (user_id) do update set
              status=excluded.status,
              display_name=coalesce(excluded.display_name,office_identity_users.display_name),
              primary_department=coalesce(excluded.primary_department,office_identity_users.primary_department),
              job_title=coalesce(excluded.job_title,office_identity_users.job_title),
              updated_at=current_timestamp
            """
        ),
        {
            "user_id": user_id,
            "status": status,
            "display_name": display_name,
            "department": department,
            "job_title": job_title,
            "created_by": created_by,
        },
    )
    for role in roles:
        db.execute(
            text(
                """
                insert into office_user_roles
                  (user_id,role,granted_by,grant_reason)
                select cast(:user_id as uuid),:role,cast(:granted_by as uuid),:reason
                where not exists (
                  select 1 from office_user_roles
                  where user_id=cast(:user_id as uuid) and role=:role
                )
                """
            ),
            {"user_id": user_id, "role": role, "granted_by": created_by, "reason": reason},
        )


def _mirror_invitation(
    db: Session,
    *,
    invite_id: str,
    email: str,
    display_name: str | None,
    job_title: str | None,
    department: str | None,
    roles: list[str],
    requested_by: str,
    invited_user_id: str,
    expires_at: datetime,
) -> None:
    if not _control_plane_present(db):
        return
    _mirror_identity(
        db,
        user_id=invited_user_id,
        status="INVITED",
        display_name=display_name,
        roles=roles,
        created_by=requested_by,
        department=department,
        job_title=job_title,
        reason="Private first-party registration invitation",
    )
    db.execute(
        text(
            """
            insert into office_access_invitations
              (id,email,display_name,job_title,department,requested_roles,status,requested_by,auth_user_id,expires_at)
            values
              (cast(:id as uuid),:email,:display_name,:job_title,:department,
               string_to_array(:roles_csv, ','),'PENDING',
               cast(:requested_by as uuid),cast(:auth_user_id as uuid),:expires_at)
            on conflict (id) do nothing
            """
        ),
        {
            "id": invite_id,
            "email": email,
            "display_name": display_name,
            "job_title": job_title,
            "department": department,
            "roles_csv": ",".join(roles),
            "requested_by": requested_by,
            "auth_user_id": invited_user_id,
            "expires_at": expires_at,
        },
    )


def _mirror_invitation_accepted(db: Session, invite_id: str, user_id: str) -> None:
    if not _control_plane_present(db):
        return
    db.execute(
        text("update office_identity_users set status='ACTIVE',updated_at=current_timestamp where user_id=cast(:user_id as uuid)"),
        {"user_id": user_id},
    )
    db.execute(
        text(
            """
            update office_access_invitations
            set status='ACCEPTED',accepted_at=current_timestamp,updated_at=current_timestamp
            where id=cast(:id as uuid)
            """
        ),
        {"id": invite_id},
    )


def _active_roles(db: Session, user_id: str) -> list[str]:
    now = _now()
    if _control_plane_present(db):
        rows = db.execute(
            text(
                """
                select role
                from office_user_roles
                where user_id=cast(:user_id as uuid)
                  and (expires_at is null or expires_at > current_timestamp)
                order by role
                """
            ),
            {"user_id": user_id},
        ).scalars().all()
        roles = sorted({str(role).upper() for role in rows if str(role).upper() in OFFICE_ROLES})
        if roles:
            return roles
    rows = db.execute(select(OfficeAuthRole).where(OfficeAuthRole.user_id == user_id)).scalars().all()
    return sorted(
        {
            row.role.upper()
            for row in rows
            if row.role.upper() in OFFICE_ROLES and (_aware(row.expires_at) is None or _aware(row.expires_at) > now)
        }
    )


def _identity_status(db: Session, user: OfficeAuthUser) -> str:
    if _control_plane_present(db):
        value = db.execute(
            text("select status from office_identity_users where user_id=cast(:user_id as uuid)"),
            {"user_id": user.id},
        ).scalar_one_or_none()
        if isinstance(value, str):
            return value
    return user.status


def _identity_metadata(db: Session, user_id: str) -> dict[str, Any]:
    if not _control_plane_present(db):
        return {"department": None, "authorization_version": 1}
    row = db.execute(
        text(
            """
            select primary_department, authorization_version
            from office_identity_users
            where user_id=cast(:user_id as uuid)
            """
        ),
        {"user_id": user_id},
    ).mappings().first()
    if not row:
        return {"department": None, "authorization_version": 1}
    version = int(row.get("authorization_version") or 1)
    return {"department": row.get("primary_department"), "authorization_version": version}


def _safe_identity(db: Session, user: OfficeAuthUser, aal: str) -> dict[str, Any]:
    roles = _active_roles(db, user.id)
    metadata = _identity_metadata(db, user.id)
    return {
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "roles": roles,
        "access_status": _identity_status(db, user),
        "department": metadata["department"],
        "authorization_version": metadata["authorization_version"],
        "aal": aal,
        "founder": user.founder_slot == FOUNDER_SLOT,
        "display_role": "FOUNDER" if user.founder_slot == FOUNDER_SLOT else (roles[0] if roles else "MEMBER"),
        # Claiming an approved device installs an encrypted factor before its
        # first browser verification.  That factor must send the next password
        # sign-in to the TOTP challenge, rather than incorrectly offering a
        # second phone-activation ceremony.  ``verified`` remains distinct so
        # audit/UI clients can tell first use from an established factor.
        "mfa": {
            "enrolled": bool(user.mfa_secret_ciphertext),
            "verified": bool(user.mfa_verified_at and user.mfa_secret_ciphertext),
        },
    }


def _encode_access(db: Session, user: OfficeAuthUser, session: OfficeAuthSession) -> str:
    now = _now()
    identity = _safe_identity(db, user, session.aal)
    return jwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "sub": user.id,
            "email": user.email,
            "office_roles": identity["roles"],
            "office_access_status": identity["access_status"],
            "office_founder": identity["founder"],
            "office_department": identity["department"],
            "office_authz_version": identity["authorization_version"],
            "aal": session.aal,
            "purpose": session.purpose,
            "sid": session.id,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=ACCESS_TTL_SECONDS)).timestamp()),
            "jti": str(uuid.uuid4()),
        },
        _signing_secret(),
        algorithm="HS256",
    )


def _issue_session(
    db: Session,
    user: OfficeAuthUser,
    request: Request,
    *,
    aal: str = "aal1",
    refresh_ttl_seconds: int | None = None,
    channel: str = "office_web",
    purpose: Literal["OFFICE", "AUTHENTICATOR_ACTIVATION"] = OFFICE_SESSION_PURPOSE,
) -> dict[str, Any]:
    refresh_token = secrets.token_urlsafe(48)
    now = _now()
    refresh_ttl = REFRESH_TTL_SECONDS if refresh_ttl_seconds is None else refresh_ttl_seconds
    ip, user_agent_hash = _request_metadata(request)
    session = OfficeAuthSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh_token),
        status="ACTIVE",
        aal=aal,
        purpose=purpose,
        ip_address=ip,
        user_agent_hash=user_agent_hash,
        expires_at=now + timedelta(seconds=refresh_ttl),
    )
    db.add(session)
    db.flush()
    access_token = _encode_access(db, user, session)
    _event(db, "LOGIN_SUCCESS", request, user_id=user.id, session_id=session.id, metadata={"aal": aal, "channel": channel, "purpose": purpose})
    return {
        "authenticated": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "refresh_expires_at": _aware(session.expires_at).isoformat(),
        "token_type": "bearer",
        "expires_in": ACCESS_TTL_SECONDS,
        "session_purpose": purpose,
        **_safe_identity(db, user, aal),
    }


def _password_version(user: OfficeAuthUser) -> str:
    value = user.password_changed_at or user.created_at
    return _aware(value).isoformat() if value else "UNVERSIONED"


def _issue_recovery_token(user: OfficeAuthUser, actor_user_id: str) -> str:
    now = _now()
    return jwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "sub": user.id,
            "purpose": "password_recovery",
            "pwdv": _password_version(user),
            "issued_by": actor_user_id,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=RECOVERY_TTL_SECONDS)).timestamp()),
            "jti": str(uuid.uuid4()),
        },
        _signing_secret(),
        algorithm="HS256",
    )


def _recovery_user(token: str, db: Session) -> OfficeAuthUser:
    try:
        claims = jwt.decode(
            token,
            _signing_secret(),
            algorithms=["HS256"],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=410, detail="Recovery link has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=400, detail="Recovery link is invalid") from exc
    if claims.get("purpose") != "password_recovery":
        raise HTTPException(status_code=400, detail="Recovery link is invalid")
    user = db.get(OfficeAuthUser, str(claims.get("sub") or ""))
    if not user or user.status not in {"ACTIVE", "SUSPENDED"}:
        raise HTTPException(status_code=404, detail="Recoverable Office identity not found")
    if not hmac.compare_digest(str(claims.get("pwdv") or ""), _password_version(user)):
        raise HTTPException(status_code=410, detail="Recovery link has already been used or superseded")
    return user


def _decode_access(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            _signing_secret(),
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "sid"]},
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Office session is invalid or expired") from exc


def authenticate_office_access(
    token: str,
    db: Session,
    *,
    require_aal2: bool = False,
    required_purpose: Literal["OFFICE", "AUTHENTICATOR_ACTIVATION"] = OFFICE_SESSION_PURPOSE,
) -> dict[str, Any]:
    claims = _decode_access(token)
    user_id = str(claims.get("sub") or "")
    session_id = str(claims.get("sid") or "")
    now = _now()

    auth_row = db.execute(
        select(OfficeAuthSession, OfficeAuthUser)
        .join(OfficeAuthUser, OfficeAuthUser.id == OfficeAuthSession.user_id)
        .where(
            OfficeAuthSession.id == session_id,
            OfficeAuthUser.id == user_id,
        )
    ).first()
    if not auth_row:
        raise HTTPException(status_code=401, detail="Office session is invalid")
    session, user = auth_row

    if session.status != "ACTIVE" or session.revoked_at or _aware(session.expires_at) <= now:
        raise HTTPException(status_code=401, detail="Office session is expired or revoked")
    if session.purpose != required_purpose or claims.get("purpose") != required_purpose:
        raise HTTPException(status_code=403, detail="This session cannot access the requested service")
    if require_aal2 and session.aal != "aal2":
        raise HTTPException(status_code=403, detail="MFA verification required")

    if _control_plane_present(db):
        authz = db.execute(
            text(
                """
                select
                  i.status,
                  coalesce(
                    array_agg(r.role order by r.role)
                      filter (
                        where r.role is not null
                          and (r.expires_at is null or r.expires_at > current_timestamp)
                      ),
                    '{}'::text[]
                  ) as roles
                from office_identity_users i
                left join office_user_roles r on r.user_id = i.user_id
                where i.user_id = cast(:user_id as uuid)
                group by i.status
                """
            ),
            {"user_id": user.id},
        ).mappings().first()
        status = str(authz["status"]) if authz else "REVOKED"
        roles = sorted({
            str(role).upper()
            for role in (authz["roles"] if authz else [])
            if str(role).upper() in OFFICE_ROLES
        })
    else:
        status = user.status
        roles = _active_roles(db, user.id)

    if user.status != "ACTIVE" or status != "ACTIVE":
        raise HTTPException(status_code=403, detail="KRAVIA Office access is not active")
    if not roles:
        raise HTTPException(status_code=403, detail="No KRAVIA Office role is assigned")

    # Do not write last_seen_at on every business API request. Session activity is
    # already captured by the dedicated auth/session heartbeat paths; avoiding a
    # write here keeps read-heavy REST traffic read-only and reduces DB latency.
    return {
        "actor": user.email,
        "role": roles[0],
        "roles": set(roles),
        "subject": user.id,
        "user_id": user.id,
        "email": user.email,
        "aal": session.aal,
        "founder": user.founder_slot == FOUNDER_SLOT,
        "session_id": session.id,
        "session_purpose": session.purpose,
        "auth_mode": "first_party",
    }


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return token


def _session_response(db: Session, user: OfficeAuthUser, session: OfficeAuthSession) -> dict[str, Any]:
    return {
        "authenticated": True,
        "access_token": _encode_access(db, user, session),
        "expires_in": ACCESS_TTL_SECONDS,
        "refresh_expires_at": _aware(session.expires_at).isoformat(),
        "session_purpose": session.purpose,
        **_safe_identity(db, user, session.aal),
    }


def _session_listing_json(session: OfficeAuthSession, current_session_id: str) -> dict[str, Any]:
    status = session.status
    if status == "ACTIVE" and _aware(session.expires_at) <= _now():
        status = "EXPIRED"
    return {
        "id": session.id,
        "status": status,
        "aal": session.aal,
        "purpose": session.purpose,
        "mfa_verified": session.aal == "aal2",
        "ip_address": session.ip_address,
        "user_agent_hash": session.user_agent_hash,
        "started_at": session.created_at.isoformat() if session.created_at else None,
        "last_seen_at": session.last_seen_at.isoformat() if session.last_seen_at else None,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "revoked_at": session.revoked_at.isoformat() if session.revoked_at else None,
        "current": session.id == current_session_id,
        "provider": "KRAVIA_FIRST_PARTY",
    }


def _matching_totp_counter(factor: pyotp.TOTP, code: str, now: datetime | None = None) -> int | None:
    current = int((now or _now()).timestamp()) // MFA_PERIOD_SECONDS
    for offset in (-1, 0, 1):
        counter = current + offset
        if counter >= 0 and hmac.compare_digest(factor.generate_otp(counter), code):
            return counter
    return None


def _claim_mfa_counter(db: Session, user_id: str, counter: int) -> bool:
    """Atomically claim a TOTP counter so concurrent requests cannot reuse it."""
    result = db.execute(
        update(OfficeAuthUser)
        .where(
            OfficeAuthUser.id == user_id,
            or_(
                OfficeAuthUser.mfa_last_accepted_counter.is_(None),
                OfficeAuthUser.mfa_last_accepted_counter < counter,
            ),
        )
        .values(mfa_last_accepted_counter=counter)
        .execution_options(synchronize_session=False)
    )
    return int(result.rowcount or 0) == 1


def _bootstrap_open(db: Session) -> bool:
    return db.execute(select(OfficeAuthUser.id).where(OfficeAuthUser.founder_slot == FOUNDER_SLOT)).first() is None


def _create_founder(payload: FounderRegisterPayload, request: Request, db: Session) -> dict[str, Any]:
    if not _bootstrap_open(db):
        raise HTTPException(status_code=410, detail="Founder registration is permanently closed")
    _validate_password(payload.password)
    if db.execute(select(OfficeAuthUser.id).where(OfficeAuthUser.email == payload.email)).first():
        raise HTTPException(status_code=409, detail="That corporate email is already registered")

    adopted_id = _control_plane_owner_id(db)
    user_id = adopted_id or str(uuid.uuid4())
    user = OfficeAuthUser(
        id=user_id,
        email=payload.email,
        display_name=payload.display_name.strip(),
        password_hash=PASSWORD_HASHER.hash(payload.password),
        status="ACTIVE",
        founder_slot=FOUNDER_SLOT,
    )
    db.add(user)
    try:
        # Persist the parent auth user first. OfficeAuthRole has a database FK to
        # office_auth_users but no ORM relationship, so one combined flush can
        # schedule the dependent role insert before the user on PostgreSQL.
        db.flush()
        db.add(
            OfficeAuthRole(
                user_id=user_id,
                role="OWNER",
                granted_by=user_id,
                grant_reason="One-time KRAVIA Founder bootstrap registration",
            )
        )
        db.flush()
        _mirror_identity(
            db,
            user_id=user_id,
            status="ACTIVE",
            display_name=user.display_name,
            roles=["OWNER"],
            created_by=user_id,
            department="EXECUTIVE",
            job_title="Founder",
            reason="One-time KRAVIA Founder bootstrap registration",
        )
        _event(db, "FOUNDER_REGISTERED", request, user_id=user_id, metadata={"email": payload.email})
        result = _issue_session(db, user, request)
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=410, detail="Founder registration is permanently closed") from exc


def _find_pending_invite(db: Session, token: str) -> OfficeAuthInvite:
    digest = _hash_token(token)
    invite = db.execute(select(OfficeAuthInvite).where(OfficeAuthInvite.token_hash == digest)).scalar_one_or_none()
    now = _now()
    if not invite or invite.status != "PENDING" or invite.revoked_at or _aware(invite.expires_at) <= now:
        raise HTTPException(status_code=404, detail="This private registration link is invalid, expired or already used")
    return invite


def build_identity_router() -> APIRouter:
    router = APIRouter(prefix="/api/v1/auth", tags=["identity"])

    def verify_credentials(payload: SignInPayload, request: Request, db: Session, *, channel: str) -> OfficeAuthUser:
        """Verify an active corporate identity without issuing a browser session.

        Authenticator activation uses this only to request a phone approval. It
        does not return an Office access token or an MFA seed.
        """
        user = db.execute(select(OfficeAuthUser).where(OfficeAuthUser.email == payload.email)).scalar_one_or_none()
        if not user:
            _event(db, "LOGIN_FAILED", request, metadata={"reason": "unknown_email", "channel": channel})
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid Office sign-in")

        now = _now()
        locked_until = _aware(user.locked_until)
        if locked_until and locked_until > now:
            _event(db, "LOGIN_BLOCKED", request, user_id=user.id, metadata={"reason": "temporary_lock", "channel": channel})
            db.commit()
            raise HTTPException(status_code=429, detail="This account is temporarily locked. Try again later")

        try:
            PASSWORD_HASHER.verify(user.password_hash, payload.password)
        except (VerifyMismatchError, VerificationError):
            user.failed_login_count = int(user.failed_login_count or 0) + 1
            if user.failed_login_count >= MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(seconds=LOCKOUT_SECONDS)
                user.failed_login_count = 0
            _event(db, "LOGIN_FAILED", request, user_id=user.id, metadata={"reason": "invalid_password", "channel": channel})
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid Office sign-in")

        if PASSWORD_HASHER.check_needs_rehash(user.password_hash):
            user.password_hash = PASSWORD_HASHER.hash(payload.password)
        if user.status != "ACTIVE" or _identity_status(db, user) != "ACTIVE":
            _event(db, "LOGIN_BLOCKED", request, user_id=user.id, metadata={"reason": "inactive_identity", "channel": channel})
            db.commit()
            raise HTTPException(status_code=403, detail="KRAVIA Office access is not active")
        if not _active_roles(db, user.id):
            raise HTTPException(status_code=403, detail="No KRAVIA Office role is assigned")

        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = now
        return user

    @router.get("/readiness")
    def readiness(db: Session = Depends(get_db)):
        return {
            "configured": first_party_auth_configured(),
            "provider": "KRAVIA_FIRST_PARTY",
            "bootstrap_open": _bootstrap_open(db),
            "mfa_policy": "AAL2_REQUIRED",
            "mfa_factor": "TOTP",
            "mfa_authenticator_app": MFA_AUTHENTICATOR_APP,
            "mfa_required_for_all_roles": True,
            "mfa_issuer": MFA_ISSUER,
            "mfa_algorithm": MFA_ALGORITHM,
            "mfa_digits": MFA_DIGITS,
            "mfa_period_seconds": MFA_PERIOD_SECONDS,
            "founder_break_glass_configured": break_glass_configured(),
            "public_registration": "ONE_TIME_FOUNDER_ONLY" if _bootstrap_open(db) else "DISABLED",
            "invitation_registration": "SINGLE_USE_PRIVATE_LINK",
            "password_hash": "ARGON2ID",
            "token_storage": "HTTPONLY_SAMESITE_COOKIE_AT_BFF",
        }

    @router.get("/bootstrap-status")
    def bootstrap_status(db: Session = Depends(get_db)):
        return {
            "registration_open": _bootstrap_open(db),
            "role": "FOUNDER",
            "role_locked": True,
            "public_registration_closes_after_success": True,
        }

    @router.post("/register-founder", status_code=201)
    def register_founder(
        payload: FounderRegisterPayload,
        request: Request,
        x_kravia_bootstrap_key: str | None = Header(default=None, alias="X-Kravia-Bootstrap-Key"),
        db: Session = Depends(get_db),
    ):
        try:
            expected = _bootstrap_secret()
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail="Founder registration is not configured") from exc
        supplied = x_kravia_bootstrap_key or ""
        if not supplied or not hmac.compare_digest(supplied, expected):
            _event(db, "FOUNDER_REGISTRATION_BLOCKED", request, metadata={"reason": "invalid_bootstrap_key"})
            db.commit()
            raise HTTPException(status_code=403, detail="Founder registration is not authorised")
        return _create_founder(payload, request, db)

    @router.post("/sign-in")
    def sign_in(payload: SignInPayload, request: Request, db: Session = Depends(get_db)):
        user = verify_credentials(payload, request, db, channel="office_web")
        result = _issue_session(db, user, request, aal="aal1")
        db.commit()
        return result

    @router.post("/email-otp/challenges", status_code=201)
    def request_email_otp_challenge(
        payload: EmailOtpChallengePayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        """Verify credentials then deliver one short-lived mobile email code.

        A provider request is persisted before sending so a timeout can be
        recorded as an unknown external outcome rather than retried blindly.
        """
        ttl, resend_interval, _, _ = _email_otp_settings()
        user = verify_credentials(payload, request, db, channel=payload.channel)
        now = _now()
        active = db.execute(
            select(OfficeEmailOtpChallenge)
            .where(
                OfficeEmailOtpChallenge.user_id == user.id,
                OfficeEmailOtpChallenge.status.in_(["PENDING", "SENT", "DELIVERY_UNKNOWN"]),
            )
            .order_by(OfficeEmailOtpChallenge.created_at.desc())
        ).scalars().all()
        for existing in active:
            if _expire_email_otp_challenge(existing, now):
                continue
            if existing.status == "DELIVERY_UNKNOWN":
                _event(db, "EMAIL_OTP_REQUEST_BLOCKED", request, user_id=user.id, metadata={"reason": "provider_outcome_unknown"})
                db.commit()
                raise HTTPException(status_code=503, detail="Email verification could not be confirmed. Try again after the current code expires.")
            if _aware(existing.resend_available_at) > now:
                _event(db, "EMAIL_OTP_REQUEST_RATE_LIMITED", request, user_id=user.id, metadata={"channel": payload.channel})
                db.commit()
                raise HTTPException(status_code=429, detail="A verification code was already sent. Please wait before requesting another.")
            existing.status = "CANCELLED"
            existing.cancelled_at = now

        challenge_id = str(uuid.uuid4())
        challenge_token = secrets.token_urlsafe(48)
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = OfficeEmailOtpChallenge(
            id=challenge_id,
            user_id=user.id,
            challenge_token_hash=_hash_token(challenge_token),
            code_hash=_email_otp_code_hash(challenge_id, code),
            status="PENDING",
            channel=payload.channel,
            attempt_count=0,
            delivery_attempt_count=1,
            expires_at=now + timedelta(seconds=ttl),
            resend_available_at=now + timedelta(seconds=resend_interval),
        )
        db.add(challenge)
        _event(db, "EMAIL_OTP_REQUESTED", request, user_id=user.id, metadata={"channel": payload.channel})
        db.commit()

        try:
            message_id = send_office_email_verification_code(
                recipient_email=user.email,
                code=code,
                expiry_minutes=max(1, ttl // 60),
                delivery_id=f"email-otp:{challenge.id}:1",
            )
        except EmailDeliveryUnavailable as exc:
            challenge.status = "DELIVERY_FAILED"
            _event(db, "EMAIL_OTP_DELIVERY_FAILED", request, user_id=user.id, metadata={"reason": "provider_unavailable"})
            db.commit()
            raise HTTPException(status_code=503, detail="Email verification is temporarily unavailable") from exc
        except EmailDeliveryRejected as exc:
            challenge.status = "DELIVERY_FAILED"
            _event(db, "EMAIL_OTP_DELIVERY_FAILED", request, user_id=user.id, metadata={"reason": "provider_rejected"})
            db.commit()
            raise HTTPException(status_code=503, detail="Email verification is temporarily unavailable") from exc
        except EmailDeliveryUnknown as exc:
            challenge.status = "DELIVERY_UNKNOWN"
            _event(db, "EMAIL_OTP_DELIVERY_UNKNOWN", request, user_id=user.id, metadata={"reason": "provider_outcome_unknown"})
            db.commit()
            raise HTTPException(status_code=503, detail="Email verification could not be confirmed. Try again later.") from exc

        challenge.status = "SENT"
        challenge.provider_message_id = message_id
        challenge.delivered_at = _now()
        _event(db, "EMAIL_OTP_SENT", request, user_id=user.id, metadata={"channel": payload.channel, "provider": "BREVO"})
        db.commit()
        return _email_otp_json(challenge, user, challenge_token=challenge_token)

    @router.post("/email-otp/challenges/{challenge_id}/resend")
    def resend_email_otp_challenge(
        challenge_id: str,
        payload: EmailOtpChallengeTokenPayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        ttl, resend_interval, _, _ = _email_otp_settings()
        challenge = db.execute(
            select(OfficeEmailOtpChallenge)
            .where(OfficeEmailOtpChallenge.id == challenge_id)
            .with_for_update()
        ).scalar_one_or_none()
        if not challenge or not hmac.compare_digest(challenge.challenge_token_hash, _hash_token(payload.challenge_token)):
            raise HTTPException(status_code=404, detail="Email verification request was not found")
        user = db.get(OfficeAuthUser, challenge.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Email verification request was not found")
        now = _now()
        if _expire_email_otp_challenge(challenge, now):
            db.commit()
            raise HTTPException(status_code=410, detail="This verification code has expired. Request a new one.")
        if challenge.status != "SENT":
            raise HTTPException(status_code=409, detail="This verification request cannot be resent")
        if _aware(challenge.resend_available_at) > now:
            raise HTTPException(status_code=429, detail="Please wait before requesting another verification code")

        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge.code_hash = _email_otp_code_hash(challenge.id, code)
        challenge.status = "PENDING"
        challenge.attempt_count = 0
        challenge.delivery_attempt_count = int(challenge.delivery_attempt_count or 0) + 1
        challenge.provider_message_id = None
        challenge.expires_at = now + timedelta(seconds=ttl)
        challenge.resend_available_at = now + timedelta(seconds=resend_interval)
        _event(db, "EMAIL_OTP_RESEND_REQUESTED", request, user_id=user.id)
        db.commit()

        try:
            message_id = send_office_email_verification_code(
                recipient_email=user.email,
                code=code,
                expiry_minutes=max(1, ttl // 60),
                delivery_id=f"email-otp:{challenge.id}:{challenge.delivery_attempt_count}",
            )
        except EmailDeliveryUnavailable as exc:
            challenge.status = "DELIVERY_FAILED"
            _event(db, "EMAIL_OTP_DELIVERY_FAILED", request, user_id=user.id, metadata={"reason": "provider_unavailable"})
            db.commit()
            raise HTTPException(status_code=503, detail="Email verification is temporarily unavailable") from exc
        except EmailDeliveryRejected as exc:
            challenge.status = "DELIVERY_FAILED"
            _event(db, "EMAIL_OTP_DELIVERY_FAILED", request, user_id=user.id, metadata={"reason": "provider_rejected"})
            db.commit()
            raise HTTPException(status_code=503, detail="Email verification is temporarily unavailable") from exc
        except EmailDeliveryUnknown as exc:
            challenge.status = "DELIVERY_UNKNOWN"
            _event(db, "EMAIL_OTP_DELIVERY_UNKNOWN", request, user_id=user.id, metadata={"reason": "provider_outcome_unknown"})
            db.commit()
            raise HTTPException(status_code=503, detail="Email verification could not be confirmed. Try again later.") from exc

        challenge.status = "SENT"
        challenge.provider_message_id = message_id
        challenge.delivered_at = _now()
        _event(db, "EMAIL_OTP_RESENT", request, user_id=user.id, metadata={"provider": "BREVO"})
        db.commit()
        return _email_otp_json(challenge, user, challenge_token=payload.challenge_token)

    @router.post("/email-otp/challenges/{challenge_id}/verify")
    def verify_email_otp_challenge(
        challenge_id: str,
        payload: EmailOtpVerifyPayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        _, _, max_attempts, mobile_refresh_ttl = _email_otp_settings()
        challenge = db.execute(
            select(OfficeEmailOtpChallenge)
            .where(OfficeEmailOtpChallenge.id == challenge_id)
            .with_for_update()
        ).scalar_one_or_none()
        if not challenge or not hmac.compare_digest(challenge.challenge_token_hash, _hash_token(payload.challenge_token)):
            raise HTTPException(status_code=404, detail="Email verification request was not found")
        user = db.get(OfficeAuthUser, challenge.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Email verification request was not found")
        now = _now()
        if _expire_email_otp_challenge(challenge, now):
            _event(db, "EMAIL_OTP_EXPIRED", request, user_id=user.id)
            db.commit()
            raise HTTPException(status_code=410, detail="This verification code has expired. Request a new one.")
        if challenge.status != "SENT":
            raise HTTPException(status_code=409, detail="This verification request is no longer available")
        if not hmac.compare_digest(challenge.code_hash, _email_otp_code_hash(challenge.id, payload.code)):
            challenge.attempt_count = int(challenge.attempt_count or 0) + 1
            exhausted = challenge.attempt_count >= max_attempts
            if exhausted:
                challenge.status = "CANCELLED"
                challenge.cancelled_at = now
            _event(
                db,
                "EMAIL_OTP_FAILED",
                request,
                user_id=user.id,
                metadata={"attempts": challenge.attempt_count, "exhausted": exhausted},
            )
            db.commit()
            if exhausted:
                raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new verification code.")
            raise HTTPException(status_code=400, detail="The verification code was not accepted")

        challenge.status = "VERIFIED"
        challenge.verified_at = now
        _event(db, "EMAIL_OTP_VERIFIED", request, user_id=user.id, metadata={"channel": challenge.channel})
        result = _issue_session(
            db,
            user,
            request,
            aal="aal2",
            refresh_ttl_seconds=mobile_refresh_ttl,
            channel=challenge.channel,
            # This session is an activation capability for the native app, not
            # a substitute for an Office browser session or an enrolled TOTP.
            purpose=AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE,
        )
        db.commit()
        return result

    @router.post("/authenticator/activation-requests")
    def request_authenticator_activation(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        """Create a short-lived phone claim after email-verified mobile sign-in.

        This intentionally returns no TOTP secret. A separate AAL2 owner/admin
        approval (or the controlled first-Founder bootstrap) is required before
        the phone can claim its local, one-time seed.
        """
        token = _bearer_token(authorization)
        context = authenticate_office_access(
            token,
            db,
            require_aal2=True,
            required_purpose=AUTHENTICATOR_ACTIVATION_SESSION_PURPOSE,
        )
        user = db.get(OfficeAuthUser, context["user_id"])
        if not user:
            raise HTTPException(status_code=401, detail="Office identity is unavailable")
        if user.mfa_secret_ciphertext:
            _event(db, "AUTHENTICATOR_ACTIVATION_BLOCKED", request, user_id=user.id, metadata={"reason": "factor_exists"})
            db.commit()
            raise HTTPException(status_code=409, detail="Authenticator is already active. Ask an authorised Office administrator to reset MFA before activating a replacement phone")

        now = _now()
        stale_requests = db.execute(
            select(OfficeAuthenticatorActivation).where(
                OfficeAuthenticatorActivation.user_id == user.id,
                OfficeAuthenticatorActivation.status.in_(["PENDING", "APPROVED"]),
            )
        ).scalars().all()
        for activation in stale_requests:
            activation.status = "CANCELLED"
            activation.cancelled_at = now

        first_founder_bootstrap = (
            user.founder_slot == FOUNDER_SLOT
            and db.execute(
                select(OfficeAuthUser.id).where(OfficeAuthUser.mfa_verified_at.is_not(None)).limit(1)
            ).first() is None
        )
        # The raw claim token is deliberately kept out of the database and
        # event log; it is held only by the requesting phone's secure storage.
        raw_claim_token = secrets.token_urlsafe(48)
        activation = OfficeAuthenticatorActivation(
            id=str(uuid.uuid4()),
            user_id=user.id,
            claim_token_hash=_hash_token(raw_claim_token),
            status="APPROVED" if first_founder_bootstrap else "PENDING",
            expires_at=now + timedelta(seconds=AUTHENTICATOR_ACTIVATION_TTL_SECONDS),
            approved_by=user.id if first_founder_bootstrap else None,
            approved_at=now if first_founder_bootstrap else None,
        )
        db.add(activation)
        _event(
            db,
            "AUTHENTICATOR_ACTIVATION_REQUESTED",
            request,
            user_id=user.id,
            metadata={"bootstrap": first_founder_bootstrap, "approval_required": not first_founder_bootstrap},
        )
        db.commit()
        return {
            "request_id": activation.id,
            "claim_token": raw_claim_token,
            "status": activation.status,
            "expires_at": activation.expires_at.isoformat(),
            "approval_required": not first_founder_bootstrap,
        }

    @router.get("/authenticator/activation-requests")
    def list_authenticator_activation_requests(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        context = authenticate_office_access(_bearer_token(authorization), db, require_aal2=True)
        if not ({"OWNER", "ADMIN"} & context["roles"]):
            return {"activation_requests": []}
        now = _now()
        requests = db.execute(
            select(OfficeAuthenticatorActivation)
            .where(
                OfficeAuthenticatorActivation.status == "PENDING",
                OfficeAuthenticatorActivation.expires_at > now,
            )
            .order_by(OfficeAuthenticatorActivation.created_at.asc())
            .limit(50)
        ).scalars().all()
        if "OWNER" not in context["roles"]:
            requests = [
                activation
                for activation in requests
                if set(_active_roles(db, activation.user_id)).issubset(ADMIN_ASSIGNABLE_ROLES)
            ]
        users_by_id = {
            user.id: user
            for user in db.execute(
                select(OfficeAuthUser).where(OfficeAuthUser.id.in_([item.user_id for item in requests]))
            ).scalars().all()
        }
        return {
            "activation_requests": [
                {
                    "id": activation.id,
                    "email": users_by_id.get(activation.user_id).email if activation.user_id in users_by_id else "Unknown identity",
                    "created_at": activation.created_at.isoformat() if activation.created_at else None,
                    "expires_at": activation.expires_at.isoformat(),
                }
                for activation in requests
            ]
        }

    @router.post("/authenticator/activation-requests/{activation_id}/approve")
    def approve_authenticator_activation(
        activation_id: str,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        context = authenticate_office_access(_bearer_token(authorization), db, require_aal2=True)
        if not ({"OWNER", "ADMIN"} & context["roles"]):
            raise HTTPException(status_code=403, detail="Only Office owners or administrators can approve an Authenticator phone")
        try:
            activation_uuid = str(uuid.UUID(activation_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Authenticator activation request was not found") from exc
        activation = db.get(OfficeAuthenticatorActivation, activation_uuid)
        if not activation or activation.status != "PENDING":
            raise HTTPException(status_code=404, detail="Authenticator activation request was not found")
        if _aware(activation.expires_at) <= _now():
            activation.status = "EXPIRED"
            db.commit()
            raise HTTPException(status_code=410, detail="Authenticator activation request has expired")
        _require_delegated_identity_authority(context, set(_active_roles(db, activation.user_id)))
        activation.status = "APPROVED"
        activation.approved_by = context["user_id"]
        activation.approved_at = _now()
        _event(
            db,
            "AUTHENTICATOR_ACTIVATION_APPROVED",
            request,
            user_id=activation.user_id,
            session_id=context["session_id"],
            metadata={"activation_id": activation.id, "approved_by": context["user_id"]},
        )
        db.commit()
        return {"approved": True, "request_id": activation.id}

    @router.post("/authenticator/activation-requests/{activation_id}/claim")
    def claim_authenticator_activation(
        activation_id: str,
        payload: AuthenticatorActivationClaimPayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        try:
            activation_uuid = str(uuid.UUID(activation_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Authenticator activation request was not found") from exc
        activation = db.get(OfficeAuthenticatorActivation, activation_uuid)
        if not activation or not hmac.compare_digest(activation.claim_token_hash, _hash_token(payload.claim_token)):
            raise HTTPException(status_code=404, detail="Authenticator activation request was not found")
        if _aware(activation.expires_at) <= _now() and activation.status in {"PENDING", "APPROVED"}:
            activation.status = "EXPIRED"
            db.commit()
            raise HTTPException(status_code=410, detail="Authenticator activation request has expired")
        if activation.status == "PENDING":
            return {"status": "PENDING", "expires_at": activation.expires_at.isoformat()}
        if activation.status != "APPROVED":
            raise HTTPException(status_code=409, detail="Authenticator activation is no longer available")

        user = db.get(OfficeAuthUser, activation.user_id)
        if not user or user.mfa_verified_at or user.mfa_secret_ciphertext:
            activation.status = "CANCELLED"
            activation.cancelled_at = _now()
            db.commit()
            raise HTTPException(status_code=409, detail="Authenticator activation is no longer available")

        secret = pyotp.random_base32()
        user.mfa_secret_ciphertext = _encrypt_mfa_secret(secret)
        user.mfa_verified_at = None
        user.mfa_last_accepted_counter = None
        activation.status = "CLAIMED"
        activation.claimed_at = _now()
        _event(
            db,
            "AUTHENTICATOR_ACTIVATION_CLAIMED",
            request,
            user_id=user.id,
            metadata={"activation_id": activation.id},
        )
        db.commit()
        return {
            "status": "ENROLLED",
            "account": user.email,
            "secret": secret,
            "issuer": MFA_ISSUER,
            "algorithm": MFA_ALGORITHM,
            "digits": MFA_DIGITS,
            "period": MFA_PERIOD_SECONDS,
            "enrolled_at": activation.claimed_at.isoformat(),
        }

    @router.get("/session")
    def session_state(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=False)
        user = db.get(OfficeAuthUser, context["user_id"])
        session = db.get(OfficeAuthSession, context["session_id"])
        if not user or not session:
            raise HTTPException(status_code=401, detail="Office session is invalid")
        db.commit()
        return _session_response(db, user, session)

    @router.get("/sessions")
    def list_sessions(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=True)
        sessions = list(
            db.execute(
                select(OfficeAuthSession)
                .where(
                    OfficeAuthSession.user_id == context["user_id"],
                    OfficeAuthSession.purpose == OFFICE_SESSION_PURPOSE,
                )
                .order_by(OfficeAuthSession.created_at.desc())
                .limit(50)
            ).scalars()
        )
        return {
            "sessions": [
                _session_listing_json(session, context["session_id"])
                for session in sessions
            ]
        }

    @router.post("/sessions/{session_id}/revoke")
    def revoke_session(
        session_id: str,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=True)
        try:
            normalized_session_id = str(uuid.UUID(session_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Office session not found") from exc
        if normalized_session_id == context["session_id"]:
            raise HTTPException(status_code=409, detail="Use sign out to close the current Office session")

        target = db.execute(
            select(OfficeAuthSession).where(
                OfficeAuthSession.id == normalized_session_id,
                OfficeAuthSession.user_id == context["user_id"],
                OfficeAuthSession.purpose == OFFICE_SESSION_PURPOSE,
            )
        ).scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Office session not found")
        if target.status == "ACTIVE" and not target.revoked_at:
            target.status = "REVOKED"
            target.revoked_at = _now()
            _event(
                db,
                "SESSION_REVOKED",
                request,
                user_id=context["user_id"],
                session_id=target.id,
                metadata={"revoked_by_session_id": context["session_id"]},
            )
            db.commit()
        return {
            "revoked": True,
            "session": _session_listing_json(target, context["session_id"]),
        }

    @router.post("/password")
    def change_password(
        payload: PasswordChangePayload,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=True)
        user = db.get(OfficeAuthUser, context["user_id"])
        if not user:
            raise HTTPException(status_code=401, detail="Office identity is unavailable")
        try:
            PASSWORD_HASHER.verify(user.password_hash, payload.current_password)
        except (VerifyMismatchError, VerificationError):
            raise HTTPException(status_code=400, detail="Current password was not accepted")
        try:
            if PASSWORD_HASHER.verify(user.password_hash, payload.new_password):
                raise HTTPException(status_code=400, detail="New password must be different from the current password")
        except (VerifyMismatchError, VerificationError):
            pass
        _validate_password(payload.new_password)

        user.password_hash = PASSWORD_HASHER.hash(payload.new_password)
        user.password_changed_at = _now()
        user.failed_login_count = 0
        user.locked_until = None
        revoked = 0
        other_sessions = db.execute(
            select(OfficeAuthSession).where(
                OfficeAuthSession.user_id == user.id,
                OfficeAuthSession.status == "ACTIVE",
                OfficeAuthSession.id != context["session_id"],
            )
        ).scalars().all()
        for session in other_sessions:
            session.status = "REVOKED"
            session.revoked_at = _now()
            revoked += 1
        _event(
            db,
            "PASSWORD_CHANGED",
            request,
            user_id=user.id,
            session_id=context["session_id"],
            metadata={"revoked_other_sessions": revoked},
        )
        db.commit()
        return {"changed": True, "revoked_other_sessions": revoked}

    @router.post("/recovery/password")
    def complete_password_recovery(
        payload: RecoveryCompletePayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        user = _recovery_user(payload.token, db)
        _validate_password(payload.new_password)
        try:
            if PASSWORD_HASHER.verify(user.password_hash, payload.new_password):
                raise HTTPException(status_code=400, detail="New password must be different from the previous password")
        except (VerifyMismatchError, VerificationError):
            pass

        user.password_hash = PASSWORD_HASHER.hash(payload.new_password)
        user.password_changed_at = _now()
        user.failed_login_count = 0
        user.locked_until = None
        sessions = db.execute(
            select(OfficeAuthSession).where(
                OfficeAuthSession.user_id == user.id,
                OfficeAuthSession.status == "ACTIVE",
            )
        ).scalars().all()
        for session in sessions:
            session.status = "REVOKED"
            session.revoked_at = _now()
        _event(
            db,
            "PASSWORD_RECOVERY_COMPLETED",
            request,
            user_id=user.id,
            metadata={"revoked_sessions": len(sessions)},
        )
        db.commit()
        return {"recovered": True, "revoked_sessions": len(sessions)}

    @router.post("/refresh")
    def refresh(payload: RefreshPayload, request: Request, db: Session = Depends(get_db)):
        session = db.execute(
            select(OfficeAuthSession).where(OfficeAuthSession.refresh_token_hash == _hash_token(payload.refresh_token))
        ).scalar_one_or_none()
        now = _now()
        if not session or session.status != "ACTIVE" or session.revoked_at or _aware(session.expires_at) <= now:
            raise HTTPException(status_code=401, detail="Office refresh session is invalid or expired")
        user = db.get(OfficeAuthUser, session.user_id)
        if not user or user.status != "ACTIVE" or _identity_status(db, user) != "ACTIVE":
            raise HTTPException(status_code=403, detail="KRAVIA Office access is not active")

        replacement = secrets.token_urlsafe(48)
        session.refresh_token_hash = _hash_token(replacement)
        session.last_seen_at = now
        _event(db, "SESSION_REFRESHED", request, user_id=user.id, session_id=session.id)
        response = _session_response(db, user, session)
        response["refresh_token"] = replacement
        db.commit()
        return response

    @router.post("/sign-out")
    def sign_out(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=False)
        session = db.get(OfficeAuthSession, context["session_id"])
        if session:
            session.status = "REVOKED"
            session.revoked_at = _now()
            _event(db, "LOGOUT", request, user_id=context["user_id"], session_id=session.id)
            db.commit()
        return {"signed_out": True}

    @router.post("/device-event")
    def record_device_event(
        payload: DeviceEventPayload,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=True)
        try:
            device_id = str(uuid.UUID(payload.device_id))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid Office device identifier") from exc

        if db.get_bind().dialect.name == "postgresql":
            device_query = text(
                """
                select trust_state,company_managed,revoked_at
                from office_device_registry
                where id=cast(:device_id as uuid)
                  and user_id=cast(:user_id as uuid)
                """
            )
        else:
            device_query = text(
                """
                select trust_state,company_managed,revoked_at
                from office_device_registry
                where id=:device_id and user_id=:user_id
                """
            )
        device = db.execute(
            device_query,
            {"device_id": device_id, "user_id": context["user_id"]},
        ).mappings().first()
        if not device:
            raise HTTPException(status_code=404, detail="Office device not found")
        if payload.action == "LINKED" and (
            device["trust_state"] != "TRUSTED"
            or not bool(device["company_managed"])
            or device["revoked_at"] is not None
        ):
            raise HTTPException(status_code=409, detail="Only a trusted company-managed device can be linked")

        event_type = "DEVICE_LINKED" if payload.action == "LINKED" else "DEVICE_UNLINKED"
        _event(
            db,
            event_type,
            request,
            user_id=context["user_id"],
            session_id=context["session_id"],
            metadata={"device_id": device_id},
        )
        db.commit()
        return {"recorded": True, "event_type": event_type, "device_id": device_id}

    @router.post("/mfa/verify")
    def verify_mfa(
        payload: MfaVerifyPayload,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=False)
        user = db.get(OfficeAuthUser, context["user_id"])
        session = db.get(OfficeAuthSession, context["session_id"])
        if not user or not session or not user.mfa_secret_ciphertext:
            raise HTTPException(status_code=409, detail="Authenticator enrollment is required")
        if session.aal == "aal2":
            raise HTTPException(status_code=409, detail="MFA is already completed for this Office session")

        secret = _decrypt_mfa_secret(user.mfa_secret_ciphertext)
        factor = pyotp.TOTP(
            secret,
            digits=MFA_DIGITS,
            interval=MFA_PERIOD_SECONDS,
            digest=hashlib.sha1,
        )
        matched_counter = _matching_totp_counter(factor, payload.code)
        if matched_counter is None:
            failure = db.execute(
                update(OfficeAuthSession)
                .where(
                    OfficeAuthSession.id == session.id,
                    OfficeAuthSession.status == "ACTIVE",
                    OfficeAuthSession.aal == "aal1",
                )
                .values(
                    mfa_failed_attempts=OfficeAuthSession.mfa_failed_attempts + 1,
                    last_seen_at=_now(),
                )
                .execution_options(synchronize_session=False)
            )
            if int(failure.rowcount or 0) != 1:
                db.rollback()
                raise HTTPException(status_code=409, detail="MFA can no longer be verified for this Office session")
            db.flush()
            db.refresh(session)
            attempts = int(session.mfa_failed_attempts or 0)
            _event(
                db,
                "MFA_FAILED",
                request,
                user_id=user.id,
                session_id=session.id,
                metadata={"attempt": attempts, "max_attempts": MFA_MAX_FAILED_ATTEMPTS},
            )
            if attempts >= MFA_MAX_FAILED_ATTEMPTS:
                session.status = "REVOKED"
                session.revoked_at = _now()
                _event(
                    db,
                    "MFA_SESSION_REVOKED",
                    request,
                    user_id=user.id,
                    session_id=session.id,
                    metadata={"reason": "mfa_attempt_limit", "attempts": attempts},
                )
                db.commit()
                raise HTTPException(
                    status_code=429,
                    detail="Too many authenticator failures. Sign in again to start a new Office session",
                )
            db.commit()
            raise HTTPException(status_code=400, detail="The authenticator code was not accepted")

        if not _claim_mfa_counter(db, user.id, matched_counter):
            _event(
                db,
                "MFA_REPLAY_BLOCKED",
                request,
                user_id=user.id,
                session_id=session.id,
                metadata={"counter": matched_counter},
            )
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="That authenticator code was already used. Wait for the next Authenticator code",
            )

        verified_at = _now()
        promoted = db.execute(
            update(OfficeAuthSession)
            .where(
                OfficeAuthSession.id == session.id,
                OfficeAuthSession.status == "ACTIVE",
                OfficeAuthSession.aal == "aal1",
            )
            .values(
                aal="aal2",
                mfa_failed_attempts=0,
                last_seen_at=verified_at,
            )
            .execution_options(synchronize_session=False)
        )
        if int(promoted.rowcount or 0) != 1:
            db.rollback()
            raise HTTPException(status_code=409, detail="MFA can no longer be verified for this Office session")

        user.mfa_verified_at = user.mfa_verified_at or verified_at
        db.flush()
        db.refresh(session)
        _event(
            db,
            "MFA_VERIFIED",
            request,
            user_id=user.id,
            session_id=session.id,
            metadata={"counter": matched_counter},
        )

        # A known browser can proceed after MFA. A new browser is deliberately
        # held in a non-active session until the *same account holder* decides
        # the request from the registered corporate mailbox. A role never
        # grants authority to approve another user's device.
        known_device = not DEVICE_APPROVAL_REQUIRED or _known_browser_device(
            db,
            user.id,
            payload.device_approval_id,
            payload.device_proof,
        )
        if not known_device:
            try:
                pending = _create_device_approval(db, user=user, session=session, request=request)
            except RuntimeError as exc:
                db.rollback()
                raise HTTPException(status_code=503, detail="Device approval is not configured") from exc
            db.commit()
            approval = db.get(OfficeLoginDeviceApproval, pending["approval_id"])
            if not approval:
                raise HTTPException(status_code=503, detail="Device approval could not be created")
            _send_device_approval_notice(
                db,
                user=user,
                approval=approval,
                action_token=pending["action_token"],
                request=request,
            )
            return {
                "verified": False,
                "aal": "aal2",
                "device_approval_pending": True,
                "device_approval_id": pending["approval_id"],
                "device_proof": pending["device_token"],
                "expires_at": _aware(approval.expires_at).isoformat(),
                "device_label": approval.device_label,
            }

        access_token = _encode_access(db, user, session)
        db.commit()
        return {
            "verified": True,
            "aal": "aal2",
            "access_token": access_token,
            **_safe_identity(db, user, "aal2"),
        }

    @router.post("/device-approvals/{approval_id}/action")
    def decide_device_approval(
        approval_id: str,
        payload: DeviceApprovalActionPayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        """Record an account-owner email decision; this endpoint never issues a session."""
        try:
            normalized_id = str(uuid.UUID(approval_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Device approval request was not found") from exc
        approval = db.execute(
            select(OfficeLoginDeviceApproval)
            .where(OfficeLoginDeviceApproval.id == normalized_id)
            .with_for_update()
        ).scalar_one_or_none()
        if not approval or not hmac.compare_digest(approval.owner_action_token_hash, _hash_token(payload.action_token)):
            raise HTTPException(status_code=404, detail="Device approval request was not found")

        now = _now()
        if _expire_device_approval(approval, now):
            session = db.get(OfficeAuthSession, approval.session_id)
            if session and session.status == "PENDING_DEVICE_APPROVAL":
                session.status = "REVOKED"
                session.revoked_at = now
            _event(db, "DEVICE_APPROVAL_EXPIRED", request, user_id=approval.user_id, session_id=approval.session_id)
            db.commit()
            raise HTTPException(status_code=410, detail="Device approval request has expired")
        if approval.status != "PENDING":
            raise HTTPException(status_code=409, detail="This device approval request has already been decided")

        if payload.decision == "APPROVE":
            approval.status = "APPROVED"
            approval.approved_at = now
            event_type = "DEVICE_APPROVAL_APPROVED"
        else:
            approval.status = "DECLINED"
            approval.declined_at = now
            session = db.get(OfficeAuthSession, approval.session_id)
            if session and session.status == "PENDING_DEVICE_APPROVAL":
                session.status = "REVOKED"
                session.revoked_at = now
            event_type = "DEVICE_APPROVAL_DECLINED"

        _event(
            db,
            event_type,
            request,
            user_id=approval.user_id,
            session_id=approval.session_id,
            metadata={"approval_id": approval.id, "decision": payload.decision},
        )
        db.commit()
        return {"decided": True, "status": approval.status}

    def _device_approval_from_proof(payload: DeviceApprovalProofPayload, db: Session) -> OfficeLoginDeviceApproval:
        try:
            normalized_id = str(uuid.UUID(payload.device_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Device approval request was not found") from exc
        approval = db.execute(
            select(OfficeLoginDeviceApproval)
            .where(OfficeLoginDeviceApproval.id == normalized_id)
            .with_for_update()
        ).scalar_one_or_none()
        if not approval or not hmac.compare_digest(approval.device_token_hash, _hash_token(payload.device_proof)):
            raise HTTPException(status_code=404, detail="Device approval request was not found")
        return approval

    @router.post("/device-approvals/status")
    def device_approval_status(
        payload: DeviceApprovalProofPayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        """Return only the pending browser's own approval state."""
        approval = _device_approval_from_proof(payload, db)
        now = _now()
        if _expire_device_approval(approval, now):
            session = db.get(OfficeAuthSession, approval.session_id)
            if session and session.status == "PENDING_DEVICE_APPROVAL":
                session.status = "REVOKED"
                session.revoked_at = now
            _event(db, "DEVICE_APPROVAL_EXPIRED", request, user_id=approval.user_id, session_id=approval.session_id)
            db.commit()
        return _approval_status_json(approval)

    @router.post("/device-approvals/complete")
    def complete_device_approval(
        payload: DeviceApprovalProofPayload,
        request: Request,
        db: Session = Depends(get_db),
    ):
        """Redeem an approved request only in the browser that started it."""
        approval = _device_approval_from_proof(payload, db)
        now = _now()
        if _expire_device_approval(approval, now):
            session = db.get(OfficeAuthSession, approval.session_id)
            if session and session.status == "PENDING_DEVICE_APPROVAL":
                session.status = "REVOKED"
                session.revoked_at = now
            _event(db, "DEVICE_APPROVAL_EXPIRED", request, user_id=approval.user_id, session_id=approval.session_id)
            db.commit()
            raise HTTPException(status_code=410, detail="Device approval request has expired")
        if approval.status != "APPROVED":
            raise HTTPException(status_code=409, detail="This device has not been approved")
        session = db.get(OfficeAuthSession, approval.session_id)
        user = db.get(OfficeAuthUser, approval.user_id)
        if not session or not user or session.status != "PENDING_DEVICE_APPROVAL" or session.aal != "aal2":
            raise HTTPException(status_code=409, detail="Device approval can no longer be completed")
        if user.status != "ACTIVE" or _identity_status(db, user) != "ACTIVE" or not _active_roles(db, user.id):
            session.status = "REVOKED"
            session.revoked_at = now
            db.commit()
            raise HTTPException(status_code=403, detail="KRAVIA Office access is not active")

        refresh_token = secrets.token_urlsafe(48)
        try:
            trusted_until = now + timedelta(seconds=_device_trust_ttl_seconds())
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail="Device trust lifetime is not configured") from exc
        session.status = "ACTIVE"
        session.refresh_token_hash = _hash_token(refresh_token)
        session.last_seen_at = now
        approval.status = "TRUSTED"
        approval.trusted_until = trusted_until
        approval.consumed_at = now
        _event(
            db,
            "DEVICE_APPROVAL_COMPLETED",
            request,
            user_id=user.id,
            session_id=session.id,
            metadata={"approval_id": approval.id, "device_label": approval.device_label},
        )
        response = _session_response(db, user, session)
        response["refresh_token"] = refresh_token
        db.commit()
        return response

    @router.get("/invitation")
    def invitation_status(token: str, db: Session = Depends(get_db)):
        invite = _find_pending_invite(db, token)
        return {
            "valid": True,
            "email": invite.email,
            "display_name": invite.display_name,
            "job_title": invite.job_title,
            "department": invite.department,
            "roles": json.loads(invite.roles_json or "[]"),
            "expires_at": _aware(invite.expires_at).isoformat(),
        }

    @router.post("/invitation/register", status_code=201)
    def register_invited_user(payload: InviteRegisterPayload, request: Request, db: Session = Depends(get_db)):
        invite = _find_pending_invite(db, payload.token)
        _validate_password(payload.password)
        if db.execute(select(OfficeAuthUser.id).where(OfficeAuthUser.email == invite.email)).first():
            raise HTTPException(status_code=409, detail="That corporate email is already registered")

        user_id = invite.used_by or str(uuid.uuid4())
        roles = [role for role in json.loads(invite.roles_json or "[]") if role in INVITABLE_ROLES]
        if not roles:
            raise HTTPException(status_code=409, detail="Invitation contains no active Office role")
        user = OfficeAuthUser(
            id=user_id,
            email=invite.email,
            display_name=payload.display_name.strip(),
            password_hash=PASSWORD_HASHER.hash(payload.password),
            status="ACTIVE",
        )
        db.add(user)
        # Persist the auth user before its dependent role rows for the same reason
        # as Founder bootstrap: role rows carry a database FK but no ORM relationship.
        db.flush()
        for role in roles:
            db.add(
                OfficeAuthRole(
                    user_id=user_id,
                    role=role,
                    granted_by=invite.created_by,
                    grant_reason="Accepted private KRAVIA Office registration link",
                )
            )
        db.flush()
        invite.status = "ACCEPTED"
        invite.used_by = user_id
        invite.used_at = _now()
        _mirror_identity(
            db,
            user_id=user_id,
            status="ACTIVE",
            display_name=user.display_name,
            roles=roles,
            created_by=invite.created_by,
            department=invite.department,
            job_title=invite.job_title,
            reason="Accepted private KRAVIA Office registration link",
        )
        _mirror_invitation_accepted(db, invite.id, user_id)
        _event(db, "INVITATION_ACCEPTED", request, user_id=user_id, metadata={"invitation_id": invite.id})
        result = _issue_session(db, user, request)
        db.commit()
        return result

    def _invite_actor(authorization: str | None, db: Session) -> dict[str, Any]:
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=True)
        if not (context["roles"] & {"OWNER", "ADMIN"}):
            raise HTTPException(status_code=403, detail="OWNER or ADMIN authority is required")
        return context

    def _require_delegated_identity_authority(actor: dict[str, Any], subject_roles: set[str] | list[str]) -> None:
        """Enforce delegated ADMIN limits at the API authority boundary.

        The Office web BFF provides the same UX guard, but Authenticator and
        other first-party clients can call these routes directly. OWNER retains
        the controlled ability to manage privileged Office identities; a
        delegated ADMIN may manage only non-privileged roles.
        """
        if "OWNER" in actor["roles"]:
            return
        if not set(subject_roles).issubset(ADMIN_ASSIGNABLE_ROLES):
            raise HTTPException(
                status_code=403,
                detail="ADMIN cannot manage OWNER, DIRECTOR or ADMIN identities",
            )

    @router.post("/founder/recovery-link")
    def issue_founder_break_glass_recovery(
        payload: RecoveryIssuePayload,
        request: Request,
        x_kravia_break_glass_key: str | None = Header(default=None, alias="X-Kravia-Break-Glass-Key"),
        db: Session = Depends(get_db),
    ):
        try:
            expected = _break_glass_secret()
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail="Founder break-glass recovery is not configured") from exc
        provided = (x_kravia_break_glass_key or "").strip()
        if not provided or not hmac.compare_digest(provided, expected):
            _event(db, "FOUNDER_BREAK_GLASS_RECOVERY_BLOCKED", request, metadata={"reason": "invalid_break_glass_key"})
            db.commit()
            raise HTTPException(status_code=403, detail="Founder break-glass recovery was not accepted")

        founder = db.execute(
            select(OfficeAuthUser).where(OfficeAuthUser.founder_slot == FOUNDER_SLOT)
        ).scalar_one_or_none()
        if not founder or founder.status not in {"ACTIVE", "SUSPENDED"}:
            raise HTTPException(status_code=404, detail="Founder recovery identity is unavailable")

        active_sessions = db.execute(
            select(OfficeAuthSession).where(
                OfficeAuthSession.user_id == founder.id,
                OfficeAuthSession.status == "ACTIVE",
            )
        ).scalars().all()
        for session in active_sessions:
            session.status = "REVOKED"
            session.revoked_at = _now()

        founder.mfa_secret_ciphertext = None
        founder.mfa_verified_at = None
        founder.mfa_last_accepted_counter = None
        recovery_token = _issue_recovery_token(founder, "BREAK_GLASS")
        _event(
            db,
            "FOUNDER_BREAK_GLASS_RECOVERY_ISSUED",
            request,
            user_id=founder.id,
            metadata={
                "reason": payload.reason.strip(),
                "revoked_sessions": len(active_sessions),
                "mfa_reset": True,
            },
        )
        db.commit()
        return {
            "issued": True,
            "expires_in": RECOVERY_TTL_SECONDS,
            "recovery_token": recovery_token,
            "recovery_path": f"/office/reset-password?token={recovery_token}",
            "revoked_sessions": len(active_sessions),
            "mfa_reset": True,
        }

    @router.post("/users/{user_id}/recovery-link")
    def issue_password_recovery_link(
        user_id: str,
        payload: RecoveryIssuePayload,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = _invite_actor(authorization, db)
        if user_id == actor["user_id"]:
            raise HTTPException(status_code=409, detail="Use authenticated password change for your own account")
        target = db.get(OfficeAuthUser, user_id)
        if not target or target.status not in {"ACTIVE", "SUSPENDED"}:
            raise HTTPException(status_code=404, detail="Recoverable Office identity not found")
        target_roles = set(_active_roles(db, user_id))
        if target.founder_slot == FOUNDER_SLOT or "OWNER" in target_roles:
            raise HTTPException(status_code=403, detail="OWNER recovery requires the protected break-glass procedure")
        _require_delegated_identity_authority(actor, target_roles)

        active_sessions = db.execute(
            select(OfficeAuthSession).where(
                OfficeAuthSession.user_id == user_id,
                OfficeAuthSession.status == "ACTIVE",
            )
        ).scalars().all()
        for session in active_sessions:
            session.status = "REVOKED"
            session.revoked_at = _now()
        recovery_token = _issue_recovery_token(target, actor["user_id"])
        _event(
            db,
            "PASSWORD_RECOVERY_ISSUED",
            request,
            user_id=user_id,
            session_id=actor["session_id"],
            metadata={
                "issued_by": actor["user_id"],
                "reason": payload.reason.strip(),
                "revoked_sessions": len(active_sessions),
            },
        )
        db.commit()
        return {
            "issued": True,
            "target_user_id": user_id,
            "expires_in": RECOVERY_TTL_SECONDS,
            "recovery_token": recovery_token,
            "recovery_path": f"/office/reset-password?token={recovery_token}",
            "revoked_sessions": len(active_sessions),
        }

    @router.post("/invitations", status_code=201)
    def create_invitation(
        payload: InviteCreatePayload,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = _invite_actor(authorization, db)
        _require_delegated_identity_authority(actor, set(payload.roles))
        if db.execute(select(OfficeAuthUser.id).where(OfficeAuthUser.email == payload.email)).first():
            raise HTTPException(status_code=409, detail="That corporate email is already registered")
        pending = db.execute(
            select(OfficeAuthInvite).where(
                OfficeAuthInvite.email == payload.email,
                OfficeAuthInvite.status == "PENDING",
            )
        ).scalar_one_or_none()
        if pending and _aware(pending.expires_at) > _now() and not pending.revoked_at:
            raise HTTPException(status_code=409, detail="A valid private registration link already exists for that email")

        raw_token = secrets.token_urlsafe(48)
        invite_id = str(uuid.uuid4())
        invited_user_id = str(uuid.uuid4())
        expires_at = _now() + timedelta(seconds=INVITE_TTL_SECONDS)
        invite = OfficeAuthInvite(
            id=invite_id,
            token_hash=_hash_token(raw_token),
            email=payload.email,
            display_name=payload.display_name.strip() if payload.display_name else None,
            job_title=payload.job_title.strip() if payload.job_title else None,
            department=payload.department,
            roles_json=json.dumps(payload.roles),
            status="PENDING",
            created_by=actor["user_id"],
            expires_at=expires_at,
            used_by=invited_user_id,
        )
        db.add(invite)
        _mirror_invitation(
            db,
            invite_id=invite_id,
            email=payload.email,
            display_name=invite.display_name,
            job_title=invite.job_title,
            department=invite.department,
            roles=payload.roles,
            requested_by=actor["user_id"],
            invited_user_id=invited_user_id,
            expires_at=expires_at,
        )
        _event(
            db,
            "INVITATION_CREATED",
            request,
            user_id=actor["user_id"],
            session_id=actor["session_id"],
            metadata={"invitation_id": invite_id, "target_email": payload.email, "roles": payload.roles},
        )
        db.commit()
        return {
            "invited": True,
            "invitation_id": invite_id,
            "email": payload.email,
            "roles": payload.roles,
            "department": payload.department,
            "expires_at": expires_at.isoformat(),
            "registration_token": raw_token,
            "registration_path": f"/office/register?invite={raw_token}",
        }

    @router.post("/invitations/{invitation_id}/revoke")
    def revoke_invitation(
        invitation_id: str,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = _invite_actor(authorization, db)
        invite = db.get(OfficeAuthInvite, invitation_id)
        if not invite or invite.status != "PENDING":
            raise HTTPException(status_code=404, detail="Pending invitation not found")
        try:
            invite_roles = json.loads(invite.roles_json or "[]")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=409, detail="Invitation role state is invalid") from exc
        if not isinstance(invite_roles, list) or any(role not in INVITABLE_ROLES for role in invite_roles):
            raise HTTPException(status_code=409, detail="Invitation role state is invalid")
        _require_delegated_identity_authority(actor, set(invite_roles))
        invite.status = "REVOKED"
        invite.revoked_at = _now()
        if _control_plane_present(db):
            db.execute(
                text(
                    """
                    update office_access_invitations
                    set status='REVOKED',revoked_at=current_timestamp,updated_at=current_timestamp
                    where id=cast(:id as uuid)
                    """
                ),
                {"id": invitation_id},
            )
            if invite.used_by:
                db.execute(
                    text(
                        """
                        update office_identity_users
                        set status='REVOKED',updated_at=current_timestamp
                        where user_id=cast(:user_id as uuid) and status='INVITED'
                        """
                    ),
                    {"user_id": invite.used_by},
                )
        _event(
            db,
            "INVITATION_REVOKED",
            request,
            user_id=actor["user_id"],
            session_id=actor["session_id"],
            metadata={"invitation_id": invitation_id},
        )
        db.commit()
        return {"revoked": True, "invitation_id": invitation_id}

    @router.post("/users/{user_id}/mfa-reset")
    def reset_mfa(
        user_id: str,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = _invite_actor(authorization, db)
        if user_id == actor["user_id"]:
            raise HTTPException(status_code=409, detail="Use account recovery for your own MFA reset")
        user = db.get(OfficeAuthUser, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Office identity not found")
        if user.founder_slot == FOUNDER_SLOT:
            raise HTTPException(status_code=403, detail="Founder MFA cannot be reset through delegated administration")
        _require_delegated_identity_authority(actor, set(_active_roles(db, user_id)))
        user.mfa_secret_ciphertext = None
        user.mfa_verified_at = None
        user.mfa_last_accepted_counter = None
        sessions = db.execute(
            select(OfficeAuthSession).where(
                OfficeAuthSession.user_id == user_id,
                OfficeAuthSession.status == "ACTIVE",
            )
        ).scalars().all()
        for session in sessions:
            session.status = "REVOKED"
            session.revoked_at = _now()
        _event(
            db,
            "MFA_RESET",
            request,
            user_id=user_id,
            session_id=actor["session_id"],
            metadata={"reset_by": actor["user_id"]},
        )
        db.commit()
        return {"reset": True, "target_user_id": user_id, "revoked_sessions": len(sessions)}

    return router


__all__ = [
    "OFFICE_ROLES",
    "authenticate_office_access",
    "break_glass_configured",
    "build_identity_router",
    "first_party_auth_configured",
    "validate_first_party_auth_configuration",
]
