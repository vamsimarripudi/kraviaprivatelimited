"""Production identity boundary for KRAVIA Office.

Supabase Auth is used as the identity provider. The browser never receives or
stores bearer/refresh tokens directly: this router keeps them in HttpOnly,
SameSite cookies and exposes only sanitized session/MFA state.

Public self-signup is intentionally not implemented. Office users must be
created/invited by an authorized operator and explicitly assigned Office roles.
"""
from __future__ import annotations

import os
from typing import Any, Callable

import jwt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from supabase import create_client

ACCESS_COOKIE = "kravia_office_access"
REFRESH_COOKIE = "kravia_office_refresh"


class SignInPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class FactorPayload(BaseModel):
    factor_id: str = Field(min_length=1, max_length=200)


class VerifyPayload(FactorPayload):
    challenge_id: str = Field(min_length=1, max_length=200)
    code: str = Field(pattern=r"^[0-9]{6,10}$")


class EnrollPayload(BaseModel):
    friendly_name: str = Field(default="KRAVIA Office Authenticator", min_length=1, max_length=120)


def _configured() -> bool:
    return bool(os.getenv("SUPABASE_AUTH_URL", "").strip() and os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip())


def _new_client():
    url = os.getenv("SUPABASE_AUTH_URL", "").strip()
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not (url and key):
        raise HTTPException(status_code=503, detail="Production identity provider is not configured")
    return create_client(url, key)


def _value(obj: Any, name: str, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _plain(obj: Any):
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): _plain(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_plain(v) for v in obj]
    if hasattr(obj, "model_dump"):
        return _plain(obj.model_dump(mode="json"))
    if hasattr(obj, "dict"):
        return _plain(obj.dict())
    if hasattr(obj, "__dict__"):
        return {k: _plain(v) for k, v in vars(obj).items() if not k.startswith("_")}
    return str(obj)


def _extract_session(response: Any):
    session = _value(response, "session")
    if session is not None:
        return session
    data = _value(response, "data")
    session = _value(data, "session")
    if session is not None:
        return session
    # MFA verification response shapes have varied across GoTrue client versions.
    # Treat a token-bearing response itself as the session if necessary.
    if _value(response, "access_token") and _value(response, "refresh_token"):
        return response
    return None


def _claims(access_token: str | None) -> dict:
    if not access_token:
        return {}
    try:
        return jwt.decode(
            access_token,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_aud": False,
                "verify_iss": False,
            },
            algorithms=["ES256", "RS256", "HS256"],
        )
    except Exception:
        return {}


def _roles(claims: dict) -> list[str]:
    raw = claims.get("office_roles") or []
    if isinstance(raw, str):
        raw = [raw]
    allowed = {"OWNER", "DIRECTOR", "FINANCE", "CA", "CS", "LEGAL", "HR", "OPERATIONS", "AUDITOR", "PRODUCT_ADMIN"}
    return sorted({str(role).upper() for role in raw if str(role).upper() in allowed})


def _safe_session(session: Any) -> dict:
    access_token = _value(session, "access_token")
    claims = _claims(access_token)
    return {
        "authenticated": bool(access_token),
        "email": claims.get("email"),
        "subject": claims.get("sub"),
        "aal": claims.get("aal") or "aal1",
        "mfa_verified": claims.get("aal") == "aal2",
        "office_roles": _roles(claims),
        "office_access_status": claims.get("office_access_status") or "UNASSIGNED",
        "expires_at": _value(session, "expires_at"),
    }


def _set_cookies(response: JSONResponse, session: Any) -> None:
    access_token = _value(session, "access_token")
    refresh_token = _value(session, "refresh_token")
    if not access_token or not refresh_token:
        raise HTTPException(status_code=502, detail="Identity provider did not return a complete session")
    secure = os.getenv("APP_ENV", "development").lower() == "production"
    expires_in = int(_value(session, "expires_in", 3600) or 3600)
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=max(60, expires_in),
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/",
    )


def _clear_cookies(response: JSONResponse) -> None:
    secure = os.getenv("APP_ENV", "development").lower() == "production"
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/", secure=secure, httponly=True, samesite="strict")


def _session_client(request: Request):
    access = request.cookies.get(ACCESS_COOKIE)
    refresh = request.cookies.get(REFRESH_COOKIE)
    if not access or not refresh:
        raise HTTPException(status_code=401, detail="Office sign-in required")
    client = _new_client()
    try:
        auth_response = client.auth.set_session(access, refresh)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Office session is invalid or expired") from exc
    session = _extract_session(auth_response)
    if session is None:
        try:
            session = client.auth.get_session()
        except Exception:
            session = None
    if session is None:
        raise HTTPException(status_code=401, detail="Office session could not be restored")
    return client, session


def _provider_error(exc: Exception, fallback: str) -> HTTPException:
    text = str(exc).lower()
    if any(token in text for token in ("invalid login", "invalid credentials", "email not confirmed")):
        return HTTPException(status_code=401, detail="Invalid Office sign-in")
    if "mfa" in text or "factor" in text or "challenge" in text:
        return HTTPException(status_code=422, detail=fallback)
    return HTTPException(status_code=502, detail=fallback)


def build_identity_router() -> APIRouter:
    router = APIRouter(prefix="/api/v1/auth", tags=["identity"])

    @router.get("/readiness")
    def readiness():
        base = os.getenv("SUPABASE_AUTH_URL", "").strip()
        return {
            "configured": _configured(),
            "provider": "SUPABASE_AUTH",
            "issuer": f"{base.rstrip('/')}/auth/v1" if base else None,
            "mfa_policy": "AAL2_REQUIRED",
            "mfa_factor": "TOTP",
            "public_signup_exposed_by_office": False,
            "token_storage": "HTTPONLY_SAMESITE_COOKIE",
        }

    @router.post("/sign-in")
    def sign_in(payload: SignInPayload):
        client = _new_client()
        try:
            auth_response = client.auth.sign_in_with_password({"email": payload.email.strip(), "password": payload.password})
        except Exception as exc:
            raise _provider_error(exc, "Identity provider sign-in failed") from exc
        session = _extract_session(auth_response)
        if session is None:
            raise HTTPException(status_code=401, detail="Invalid Office sign-in")
        response = JSONResponse(_safe_session(session))
        _set_cookies(response, session)
        return response

    @router.get("/session")
    def session_state(request: Request):
        try:
            _, session = _session_client(request)
        except HTTPException:
            return {"authenticated": False, "mfa_verified": False, "office_roles": [], "office_access_status": "UNAUTHENTICATED"}
        response = JSONResponse(_safe_session(session))
        _set_cookies(response, session)
        return response

    @router.get("/factors")
    def factors(request: Request):
        client, session = _session_client(request)
        try:
            result = client.auth.mfa.list_factors()
        except Exception as exc:
            raise _provider_error(exc, "Unable to list MFA factors") from exc
        response = JSONResponse({"factors": _plain(result)})
        _set_cookies(response, session)
        return response

    @router.post("/mfa/enroll")
    def enroll_mfa(payload: EnrollPayload, request: Request):
        client, session = _session_client(request)
        try:
            result = client.auth.mfa.enroll({"factor_type": "totp", "friendly_name": payload.friendly_name})
        except Exception as exc:
            raise _provider_error(exc, "Unable to enroll authenticator") from exc
        response = JSONResponse({"factor": _plain(result)})
        _set_cookies(response, session)
        return response

    @router.post("/mfa/challenge")
    def challenge_mfa(payload: FactorPayload, request: Request):
        client, session = _session_client(request)
        try:
            result = client.auth.mfa.challenge({"factor_id": payload.factor_id})
        except Exception as exc:
            raise _provider_error(exc, "Unable to create MFA challenge") from exc
        response = JSONResponse({"challenge": _plain(result)})
        _set_cookies(response, session)
        return response

    @router.post("/mfa/verify")
    def verify_mfa(payload: VerifyPayload, request: Request):
        client, prior_session = _session_client(request)
        try:
            result = client.auth.mfa.verify({
                "factor_id": payload.factor_id,
                "challenge_id": payload.challenge_id,
                "code": payload.code,
            })
            session = _extract_session(result) or client.auth.get_session() or prior_session
        except Exception as exc:
            raise _provider_error(exc, "MFA verification failed") from exc
        safe = _safe_session(session)
        if safe["aal"] != "aal2":
            raise HTTPException(status_code=403, detail="MFA verification did not produce an AAL2 session")
        response = JSONResponse(safe)
        _set_cookies(response, session)
        return response

    @router.post("/refresh")
    def refresh(request: Request):
        client, session = _session_client(request)
        try:
            result = client.auth.refresh_session(_value(session, "refresh_token"))
        except Exception as exc:
            raise _provider_error(exc, "Unable to refresh Office session") from exc
        refreshed = _extract_session(result) or client.auth.get_session()
        if refreshed is None:
            raise HTTPException(status_code=401, detail="Office session refresh failed")
        response = JSONResponse(_safe_session(refreshed))
        _set_cookies(response, refreshed)
        return response

    @router.post("/sign-out")
    def sign_out(request: Request):
        try:
            client, _ = _session_client(request)
            client.auth.sign_out()
        except Exception:
            # Cookie removal is fail-safe even if the remote session is already gone.
            pass
        response = JSONResponse({"signed_out": True})
        _clear_cookies(response)
        return response

    return router


__all__ = ["ACCESS_COOKIE", "REFRESH_COOKIE", "build_identity_router"]
