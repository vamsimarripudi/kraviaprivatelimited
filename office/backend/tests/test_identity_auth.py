import os
from types import SimpleNamespace

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import identity_auth

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("SUPABASE_AUTH_URL", "https://identity.example.invalid")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")


def token(aal="aal1", roles=None, status="ACTIVE"):
    return jwt.encode(
        {
            "sub": "user-1",
            "email": "owner@example.test",
            "aud": "authenticated",
            "aal": aal,
            "office_roles": roles or ["OWNER"],
            "office_access_status": status,
        },
        "test-only-secret",
        algorithm="HS256",
    )


def session(aal="aal1", roles=None):
    return SimpleNamespace(
        access_token=token(aal, roles),
        refresh_token="refresh-test-token",
        expires_in=3600,
        expires_at=2_000_000_000,
    )


class FakeMFA:
    def __init__(self, owner):
        self.owner = owner

    def list_factors(self):
        return {"totp": [{"id": "factor-1", "factor_type": "totp", "status": "verified"}], "phone": []}

    def enroll(self, payload):
        assert payload["factor_type"] == "totp"
        return {"id": "factor-new", "factor_type": "totp", "status": "unverified", "totp": {"qr_code": "data:image/svg+xml,test", "secret": "TESTSECRET"}}

    def challenge(self, payload):
        assert payload["factor_id"]
        return {"id": "challenge-1"}

    def verify(self, payload):
        assert payload["factor_id"] and payload["challenge_id"] and payload["code"] == "123456"
        self.owner.current = session("aal2")
        return SimpleNamespace(session=self.owner.current)


class FakeAuth:
    def __init__(self):
        self.current = session("aal1")
        self.mfa = FakeMFA(self)
        self.signed_out = False

    def sign_in_with_password(self, payload):
        assert payload["email"] == "owner@example.test"
        assert payload["password"] == "correct-password"
        self.current = session("aal1")
        return SimpleNamespace(session=self.current)

    def set_session(self, access_token, refresh_token):
        assert access_token and refresh_token
        # Keep the currently promoted session after MFA verification; before that,
        # restore the session represented by the provided cookie.
        if self.current.access_token != access_token and jwt.decode(access_token, options={"verify_signature": False}).get("aal") == "aal2":
            self.current = session("aal2")
        return SimpleNamespace(session=self.current)

    def get_session(self):
        return self.current

    def refresh_session(self, _refresh_token=None):
        return SimpleNamespace(session=self.current)

    def sign_out(self):
        self.signed_out = True


class FakeSupabase:
    def __init__(self):
        self.auth = FakeAuth()


def make_client(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(identity_auth, "_new_client", lambda: fake)
    app = FastAPI()
    app.include_router(identity_auth.build_identity_router())
    return TestClient(app), fake


def test_sign_in_keeps_tokens_http_only_and_out_of_json(monkeypatch):
    client, _fake = make_client(monkeypatch)
    response = client.post("/api/v1/auth/sign-in", json={"email": "owner@example.test", "password": "correct-password"})
    assert response.status_code == 200
    body = response.json()
    assert body["authenticated"] is True
    assert body["aal"] == "aal1"
    assert body["office_roles"] == ["OWNER"]
    assert "access_token" not in response.text
    assert "refresh-test-token" not in response.text
    cookies = "\n".join(response.headers.get_list("set-cookie")).lower()
    assert "httponly" in cookies
    assert "samesite=strict" in cookies
    assert identity_auth.ACCESS_COOKIE in client.cookies
    assert identity_auth.REFRESH_COOKIE in client.cookies


def test_mfa_verify_promotes_session_to_aal2(monkeypatch):
    client, _fake = make_client(monkeypatch)
    signed_in = client.post("/api/v1/auth/sign-in", json={"email": "owner@example.test", "password": "correct-password"})
    assert signed_in.status_code == 200
    verified = client.post(
        "/api/v1/auth/mfa/verify",
        json={"factor_id": "factor-1", "challenge_id": "challenge-1", "code": "123456"},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["aal"] == "aal2"
    assert verified.json()["mfa_verified"] is True
    assert verified.json()["office_roles"] == ["OWNER"]


def test_auth_readiness_discloses_no_key(monkeypatch):
    client, _fake = make_client(monkeypatch)
    response = client.get("/api/v1/auth/readiness")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert body["mfa_policy"] == "AAL2_REQUIRED"
    assert "publishable" not in response.text.lower()
    assert "test-publishable-key" not in response.text
