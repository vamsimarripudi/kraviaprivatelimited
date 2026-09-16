import jwt
from starlette.requests import Request

from backend.security_controls import ACCESS_COOKIE, _oidc_mfa_guard


def request_for(path, token=None):
    headers = []
    if token:
        headers.append((b"cookie", f"{ACCESS_COOKIE}={token}".encode()))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "https",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "server": ("office.example.test", 443),
    }
    return Request(scope)


def bearer(aal="aal2", status="ACTIVE"):
    return jwt.encode(
        {"sub": "u1", "aal": aal, "office_access_status": status, "office_roles": ["OWNER"]},
        "test-only-secret",
        algorithm="HS256",
    )


def test_protected_api_rejects_aal1(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_REQUIRED_AAL", "aal2")
    blocked = _oidc_mfa_guard(request_for("/api/v1/company", bearer("aal1")), "production")
    assert blocked is not None
    assert blocked.status_code == 403


def test_aal2_cookie_is_bridged_to_bearer(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_REQUIRED_AAL", "aal2")
    token = bearer("aal2")
    request = request_for("/api/v1/company", token)
    blocked = _oidc_mfa_guard(request, "production")
    assert blocked is None
    assert request.headers["authorization"] == f"Bearer {token}"


def test_inactive_identity_is_blocked_even_with_aal2(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_REQUIRED_AAL", "aal2")
    blocked = _oidc_mfa_guard(request_for("/api/v1/company", bearer("aal2", "SUSPENDED")), "production")
    assert blocked is not None
    assert blocked.status_code == 403


def test_auth_endpoints_remain_available_before_mfa(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "oidc")
    monkeypatch.setenv("OIDC_REQUIRED_AAL", "aal2")
    assert _oidc_mfa_guard(request_for("/api/v1/auth/session", bearer("aal1")), "production") is None


def test_unauthenticated_browser_entry_redirects_to_auth(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "oidc")
    blocked = _oidc_mfa_guard(request_for("/"), "production")
    assert blocked is not None
    assert blocked.status_code == 307
    assert blocked.headers["location"] == "/auth.html"
