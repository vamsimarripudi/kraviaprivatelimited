"""HTTP security controls for the canonical KRAVIA Office ASGI app.

The controls are intentionally dependency-light: security headers, browser-origin
checks, a conservative per-process mutation rate limit, and the production OIDC
MFA boundary are enforced before business routes execute.
"""
from __future__ import annotations

import hashlib
import os
import threading
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse, RedirectResponse

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
ACCESS_COOKIE = "kravia_office_access"
AUTH_API_PREFIX = "/api/v1/auth/"
PROVIDER_WEBHOOK_PREFIX = "/api/v1/finance/webhooks/"
# The backend root is intentionally a public, metadata-only status page. Legacy
# browser application entry points still require an authenticated Office session.
BROWSER_ENTRY_PATHS = {"/index.html", "/finance.html"}


class FixedWindowRateLimiter:
    """Small in-process limiter used as a baseline abuse control.

    Production deployments with multiple replicas must also enforce a shared
    edge/provider limit. This limiter still protects each individual worker.
    """

    def __init__(self, requests: int, window_seconds: int):
        if requests < 1 or window_seconds < 1:
            raise ValueError("Rate-limit requests and window must be positive")
        self.requests = requests
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> tuple[bool, int, int]:
        timestamp = time.monotonic() if now is None else now
        cutoff = timestamp - self.window_seconds
        with self._lock:
            bucket = self._events[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.requests:
                retry_after = max(1, int(self.window_seconds - (timestamp - bucket[0])))
                return False, 0, retry_after
            bucket.append(timestamp)
            return True, self.requests - len(bucket), 0


def _csv_env(name: str) -> set[str]:
    return {item.strip() for item in os.getenv(name, "").split(",") if item.strip()}


def _allowed_origins() -> set[str]:
    origins = _csv_env("OFFICE_ALLOWED_ORIGINS")
    public_base = os.getenv("PUBLIC_BASE_URL", "").strip()
    if public_base:
        parsed = urlparse(public_base)
        if parsed.scheme and parsed.netloc:
            origins.add(f"{parsed.scheme}://{parsed.netloc}")
    return origins


def _identity_key(request: Request) -> str:
    actor = request.headers.get("x-office-actor", "").strip()
    auth = request.headers.get("authorization", "").strip()
    if actor:
        identity = f"actor:{actor.lower()}"
    elif auth:
        identity = "bearer:" + hashlib.sha256(auth.encode()).hexdigest()[:20]
    else:
        identity = "anonymous"
    client = request.client.host if request.client else "unknown"
    return f"{client}|{identity}"


def _host_allowed(host: str, allowed: set[str]) -> bool:
    hostname = host.split(":", 1)[0].lower()
    for rule in allowed:
        normalized = rule.lower()
        if normalized == hostname:
            return True
        if normalized.startswith("*.") and hostname.endswith(normalized[1:]):
            return True
    return False


def _bearer_value(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


def _inject_bearer(request: Request, token: str) -> None:
    """Inject an HttpOnly-cookie access token as the downstream Bearer token.

    Existing route dependencies continue to perform the cryptographic issuer,
    audience, expiry and role verification; this function only bridges the
    same-origin browser session into that already-tested authorization layer.
    """
    headers = [(k, v) for k, v in request.scope.get("headers", []) if k.lower() != b"authorization"]
    headers.append((b"authorization", f"Bearer {token}".encode("latin-1")))
    request.scope["headers"] = headers
    # Starlette may have materialized the immutable Headers object before this
    # middleware ran. Delete the cache so downstream Header dependencies rebuild
    # it from the modified ASGI scope.
    if hasattr(request, "_headers"):
        delattr(request, "_headers")


def _unverified_claims(token: str) -> dict:
    try:
        return jwt.decode(
            token,
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


def _oidc_mfa_guard(request: Request, app_env: str):
    """Fail closed on production browser/API sessions that are below AAL2.

    Claims are decoded here only for the early MFA gate. Cryptographic JWT
    verification still occurs in ``main.actor_context`` before any protected
    business handler runs, so an attacker cannot bypass authentication by
    forging an AAL claim.
    """
    auth_mode = os.getenv("AUTH_MODE", "bootstrap" if app_env != "production" else "oidc").lower()
    if auth_mode != "oidc":
        return None

    cookie_token = request.cookies.get(ACCESS_COOKIE)
    bearer = _bearer_value(request)
    if not bearer and cookie_token:
        _inject_bearer(request, cookie_token)
        bearer = cookie_token

    path = request.url.path
    provider_webhook = path.startswith(PROVIDER_WEBHOOK_PREFIX)
    auth_endpoint = path.startswith(AUTH_API_PREFIX)
    protected_api = path.startswith("/api/v1/") and not auth_endpoint and not provider_webhook

    if app_env == "production" and request.method.upper() == "GET" and path in BROWSER_ENTRY_PATHS and not cookie_token:
        return RedirectResponse(url="/auth.html", status_code=307)

    if not protected_api:
        return None
    if not bearer:
        return JSONResponse({"detail": "Office sign-in required"}, status_code=401)

    claims = _unverified_claims(bearer)
    required_aal = os.getenv("OIDC_REQUIRED_AAL", "aal2" if app_env == "production" else "").strip().lower()
    if required_aal and str(claims.get("aal") or "aal1").lower() != required_aal:
        return JSONResponse({"detail": "MFA verification required", "required_aal": required_aal}, status_code=403)
    if claims.get("office_access_status") and claims.get("office_access_status") != "ACTIVE":
        return JSONResponse({"detail": "KRAVIA Office access is not active"}, status_code=403)
    return None


def configure_security(app) -> None:
    requests = int(os.getenv("OFFICE_MUTATION_RATE_LIMIT", "120"))
    window = int(os.getenv("OFFICE_RATE_LIMIT_WINDOW_SECONDS", "60"))
    limiter = FixedWindowRateLimiter(requests=requests, window_seconds=window)
    allowed_hosts = _csv_env("OFFICE_ALLOWED_HOSTS")
    allowed_origins = _allowed_origins()
    app_env = os.getenv("APP_ENV", "development").lower()

    @app.middleware("http")
    async def office_security(request: Request, call_next):
        if allowed_hosts and not _host_allowed(request.headers.get("host", ""), allowed_hosts):
            return JSONResponse({"detail": "Untrusted host"}, status_code=400)

        oidc_block = _oidc_mfa_guard(request, app_env)
        if oidc_block is not None:
            _set_security_headers(oidc_block, app_env)
            return oidc_block

        mutation = request.method.upper() not in SAFE_METHODS
        provider_webhook = request.url.path.startswith(PROVIDER_WEBHOOK_PREFIX)

        # Bearer/cookie auth is not ambient cross-site authentication because the
        # cookies are SameSite=Strict, and this explicit Origin gate adds a second
        # server-side control for browser mutation requests.
        origin = request.headers.get("origin")
        if mutation and origin and not provider_webhook and allowed_origins and origin not in allowed_origins:
            response = JSONResponse({"detail": "Cross-origin mutation is not allowed"}, status_code=403)
            _set_security_headers(response, app_env)
            return response

        remaining = None
        if mutation and request.url.path.startswith("/api/") and not provider_webhook:
            allowed, remaining, retry_after = limiter.allow(_identity_key(request))
            if not allowed:
                response = JSONResponse({"detail": "Office mutation rate limit exceeded"}, status_code=429)
                response.headers["Retry-After"] = str(retry_after)
                _set_security_headers(response, app_env)
                return response

        response = await call_next(request)
        _set_security_headers(response, app_env)
        if remaining is not None:
            response.headers["X-RateLimit-Limit"] = str(requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


def _set_security_headers(response, app_env: str) -> None:
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "font-src 'self'; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; "
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    )
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
    if app_env == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
