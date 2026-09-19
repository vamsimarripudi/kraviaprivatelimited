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
import io
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pyotp
import qrcode
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth_models import OfficeAuthEvent, OfficeAuthInvite, OfficeAuthRole, OfficeAuthSession, OfficeAuthUser
from .database import get_db

ACCESS_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_ACCESS_TTL_SECONDS", "1800"))
REFRESH_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_REFRESH_TTL_SECONDS", str(7 * 24 * 60 * 60)))
INVITE_TTL_SECONDS = int(os.getenv("OFFICE_AUTH_INVITE_TTL_SECONDS", str(72 * 60 * 60)))
MAX_FAILED_LOGINS = int(os.getenv("OFFICE_AUTH_MAX_FAILED_LOGINS", "5"))
LOCKOUT_SECONDS = int(os.getenv("OFFICE_AUTH_LOCKOUT_SECONDS", "900"))
ISSUER = os.getenv("OFFICE_AUTH_ISSUER", "kravia-office")
AUDIENCE = os.getenv("OFFICE_AUTH_AUDIENCE", "kravia-office-api")
FOUNDER_SLOT = "PRIMARY_FOUNDER"

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


def _signing_secret() -> str:
    secret = os.getenv("OFFICE_AUTH_SIGNING_SECRET", "").strip()
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if not secret and app_env != "production":
        secret = "kravia-office-development-only-signing-secret-change-me"
    if len(secret) < 32:
        raise RuntimeError("OFFICE_AUTH_SIGNING_SECRET must be at least 32 characters")
    return secret


def first_party_auth_configured() -> bool:
    try:
        _signing_secret()
        return True
    except RuntimeError:
        return False


def validate_first_party_auth_configuration() -> None:
    _signing_secret()


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


def _request_metadata(request: Request) -> tuple[str | None, str | None]:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    ip = (forwarded or real_ip or None)
    user_agent = request.headers.get("user-agent", "").strip()
    user_agent_hash = hashlib.sha256(user_agent.encode()).hexdigest() if user_agent else None
    return ip[:64] if ip else None, user_agent_hash


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
    schema = "public" if bind.dialect.name == "postgresql" else None
    inspector = inspect(bind)
    return inspector.has_table("office_identity_users", schema=schema) and inspector.has_table("office_user_roles", schema=schema)


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
              (cast(:id as uuid),:email,:display_name,:job_title,:department,ARRAY[:role0]::text[],'PENDING',
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
            "role0": roles[0],
            "requested_by": requested_by,
            "auth_user_id": invited_user_id,
            "expires_at": expires_at,
        },
    )
    if len(roles) > 1:
        db.execute(
            text("update office_access_invitations set requested_roles=cast(:roles as text[]) where id=cast(:id as uuid)"),
            {"roles": roles, "id": invite_id},
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


def _safe_identity(db: Session, user: OfficeAuthUser, aal: str) -> dict[str, Any]:
    roles = _active_roles(db, user.id)
    return {
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "roles": roles,
        "access_status": _identity_status(db, user),
        "aal": aal,
        "founder": user.founder_slot == FOUNDER_SLOT,
        "display_role": "FOUNDER" if user.founder_slot == FOUNDER_SLOT else (roles[0] if roles else "MEMBER"),
        "mfa": {"enrolled": bool(user.mfa_verified_at and user.mfa_secret_ciphertext)},
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
            "aal": session.aal,
            "sid": session.id,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=ACCESS_TTL_SECONDS)).timestamp()),
            "jti": str(uuid.uuid4()),
        },
        _signing_secret(),
        algorithm="HS256",
    )


def _issue_session(db: Session, user: OfficeAuthUser, request: Request, *, aal: str = "aal1") -> dict[str, Any]:
    refresh_token = secrets.token_urlsafe(48)
    now = _now()
    ip, user_agent_hash = _request_metadata(request)
    session = OfficeAuthSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh_token),
        status="ACTIVE",
        aal=aal,
        ip_address=ip,
        user_agent_hash=user_agent_hash,
        expires_at=now + timedelta(seconds=REFRESH_TTL_SECONDS),
    )
    db.add(session)
    db.flush()
    access_token = _encode_access(db, user, session)
    _event(db, "LOGIN_SUCCESS", request, user_id=user.id, session_id=session.id, metadata={"aal": aal})
    return {
        "authenticated": True,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TTL_SECONDS,
        **_safe_identity(db, user, aal),
    }


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
) -> dict[str, Any]:
    claims = _decode_access(token)
    user_id = str(claims.get("sub") or "")
    session_id = str(claims.get("sid") or "")
    session = db.get(OfficeAuthSession, session_id)
    user = db.get(OfficeAuthUser, user_id)
    now = _now()
    if not session or not user or session.user_id != user_id:
        raise HTTPException(status_code=401, detail="Office session is invalid")
    if session.status != "ACTIVE" or session.revoked_at or _aware(session.expires_at) <= now:
        raise HTTPException(status_code=401, detail="Office session is expired or revoked")
    status = _identity_status(db, user)
    if user.status != "ACTIVE" or status != "ACTIVE":
        raise HTTPException(status_code=403, detail="KRAVIA Office access is not active")
    roles = _active_roles(db, user.id)
    if not roles:
        raise HTTPException(status_code=403, detail="No KRAVIA Office role is assigned")
    if require_aal2 and session.aal != "aal2":
        raise HTTPException(status_code=403, detail="MFA verification required")
    session.last_seen_at = now
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
        **_safe_identity(db, user, session.aal),
    }


def _qr_data_uri(uri: str) -> str:
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


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
    db.add(
        OfficeAuthRole(
            user_id=user_id,
            role="OWNER",
            granted_by=user_id,
            grant_reason="One-time KRAVIA Founder bootstrap registration",
        )
    )
    try:
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

    @router.get("/readiness")
    def readiness(db: Session = Depends(get_db)):
        return {
            "configured": first_party_auth_configured(),
            "provider": "KRAVIA_FIRST_PARTY",
            "bootstrap_open": _bootstrap_open(db),
            "mfa_policy": "AAL2_REQUIRED",
            "mfa_factor": "TOTP",
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
    def register_founder(payload: FounderRegisterPayload, request: Request, db: Session = Depends(get_db)):
        return _create_founder(payload, request, db)

    @router.post("/sign-in")
    def sign_in(payload: SignInPayload, request: Request, db: Session = Depends(get_db)):
        user = db.execute(select(OfficeAuthUser).where(OfficeAuthUser.email == payload.email)).scalar_one_or_none()
        if not user:
            _event(db, "LOGIN_FAILED", request, metadata={"reason": "unknown_email"})
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid Office sign-in")

        now = _now()
        locked_until = _aware(user.locked_until)
        if locked_until and locked_until > now:
            _event(db, "LOGIN_BLOCKED", request, user_id=user.id, metadata={"reason": "temporary_lock"})
            db.commit()
            raise HTTPException(status_code=429, detail="This account is temporarily locked. Try again later")

        try:
            PASSWORD_HASHER.verify(user.password_hash, payload.password)
        except (VerifyMismatchError, VerificationError):
            user.failed_login_count = int(user.failed_login_count or 0) + 1
            if user.failed_login_count >= MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(seconds=LOCKOUT_SECONDS)
                user.failed_login_count = 0
            _event(db, "LOGIN_FAILED", request, user_id=user.id, metadata={"reason": "invalid_password"})
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid Office sign-in")

        if PASSWORD_HASHER.check_needs_rehash(user.password_hash):
            user.password_hash = PASSWORD_HASHER.hash(payload.password)
        if user.status != "ACTIVE" or _identity_status(db, user) != "ACTIVE":
            _event(db, "LOGIN_BLOCKED", request, user_id=user.id, metadata={"reason": "inactive_identity"})
            db.commit()
            raise HTTPException(status_code=403, detail="KRAVIA Office access is not active")
        if not _active_roles(db, user.id):
            raise HTTPException(status_code=403, detail="No KRAVIA Office role is assigned")

        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = now
        result = _issue_session(db, user, request, aal="aal1")
        db.commit()
        return result

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

    @router.post("/mfa/enroll")
    def enroll_mfa(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        token = _bearer_token(authorization)
        context = authenticate_office_access(token, db, require_aal2=False)
        user = db.get(OfficeAuthUser, context["user_id"])
        if not user:
            raise HTTPException(status_code=401, detail="Office identity is unavailable")
        if user.mfa_verified_at and user.mfa_secret_ciphertext:
            raise HTTPException(status_code=409, detail="A verified authenticator is already enrolled")

        secret = pyotp.random_base32()
        user.mfa_secret_ciphertext = _encrypt_mfa_secret(secret)
        user.mfa_verified_at = None
        uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="KRAVIA Office")
        _event(db, "MFA_ENROLLMENT_STARTED", request, user_id=user.id, session_id=context["session_id"])
        db.commit()
        return {
            "factor_id": "totp",
            "qr_code": _qr_data_uri(uri),
            "manual_key": secret,
            "friendly_name": "KRAVIA Office",
        }

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
        secret = _decrypt_mfa_secret(user.mfa_secret_ciphertext)
        if not pyotp.TOTP(secret).verify(payload.code, valid_window=1):
            _event(db, "MFA_FAILED", request, user_id=user.id, session_id=session.id)
            db.commit()
            raise HTTPException(status_code=400, detail="The authenticator code was not accepted")

        user.mfa_verified_at = user.mfa_verified_at or _now()
        session.aal = "aal2"
        session.last_seen_at = _now()
        _event(db, "MFA_VERIFIED", request, user_id=user.id, session_id=session.id)
        access_token = _encode_access(db, user, session)
        db.commit()
        return {
            "verified": True,
            "aal": "aal2",
            "access_token": access_token,
            **_safe_identity(db, user, "aal2"),
        }

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
        for role in roles:
            db.add(
                OfficeAuthRole(
                    user_id=user_id,
                    role=role,
                    granted_by=invite.created_by,
                    grant_reason="Accepted private KRAVIA Office registration link",
                )
            )
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

    @router.post("/invitations", status_code=201)
    def create_invitation(
        payload: InviteCreatePayload,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = _invite_actor(authorization, db)
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
        user.mfa_secret_ciphertext = None
        user.mfa_verified_at = None
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
    "build_identity_router",
    "first_party_auth_configured",
    "validate_first_party_auth_configuration",
]
