"""No-network Brevo readiness tests: keys and private account data never logged."""
import json

import httpx
import pytest

from backend import brevo_readiness


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "synthetic-test-secret-never-log")
    monkeypatch.setenv("BREVO_SENDER_EMAIL", "hello@kraviaprivatelimited.com")
    monkeypatch.setenv("BREVO_SENDER_NAME", "KRAVIA")
    monkeypatch.setenv("BREVO_API_TIMEOUT_SECONDS", "10")


def test_preflight_is_no_send_and_no_network_by_default():
    result = brevo_readiness.inspect_brevo()
    assert result["network_probe_requested"] is False
    assert result["key_configured"] is True
    assert result["provider_configuration_verified"] is False
    assert result["mailbox_delivery_verified"] is False
    assert "synthetic-test-secret" not in json.dumps(result)


def test_missing_key_fails_closed_without_attempted_network(monkeypatch):
    monkeypatch.delenv("BREVO_API_KEY")
    result = brevo_readiness.inspect_brevo(probe=True)
    assert result["failure_codes"] == ["MISSING_API_KEY"]
    assert not result["provider_authenticated"]


def test_unapproved_sender_domain_is_rejected_before_api_call(monkeypatch):
    monkeypatch.setenv("BREVO_SENDER_EMAIL", "hello@unapproved.example")
    result = brevo_readiness.inspect_brevo(probe=True)
    assert "UNAPPROVED_SENDER_DOMAIN" in result["failure_codes"]
    assert not result["provider_authenticated"]


def test_read_only_provider_confirmation_uses_only_get_and_no_sensitive_output():
    requests = []
    def reply(request):
        requests.append(request)
        assert request.method == "GET"
        assert request.headers["api-key"] == "synthetic-test-secret-never-log"
        if request.url.path == "/v3/account":
            return httpx.Response(200, json={"companyName": "KRAVIA", "email": "private-account@other.example"})
        if request.url.path == "/v3/senders":
            return httpx.Response(200, json={"senders": [{"email": "hello@kraviaprivatelimited.com", "active": True}]})
        if request.url.path == "/v3/senders/domains/kraviaprivatelimited.com":
            return httpx.Response(200, json={"domain": "kraviaprivatelimited.com", "verified": True, "authenticated": True})
        return httpx.Response(404)

    result = brevo_readiness.inspect_brevo(probe=True, transport=httpx.MockTransport(reply))
    assert result["provider_configuration_verified"] is True
    assert result["provider_authenticated"] is True
    assert result["sender_active"] is True
    assert result["domain_verified"] is True
    assert result["domain_authenticated"] is True
    assert result["mailbox_delivery_verified"] is False
    assert [r.url.path for r in requests] == [
        "/v3/account", "/v3/senders", "/v3/senders/domains/kraviaprivatelimited.com"
    ]
    payload = json.dumps(result)
    assert "synthetic-test-secret" not in payload
    assert "private-account@other.example" not in payload


def test_sender_inactive_stays_unverified():
    def reply(request):
        if request.url.path == "/v3/account":
            return httpx.Response(200, json={"companyName": "KRAVIA"})
        if request.url.path == "/v3/senders":
            return httpx.Response(200, json={"senders": [{"email": "hello@kraviaprivatelimited.com", "active": False}]})
        return httpx.Response(200, json={"verified": True, "authenticated": True})

    result = brevo_readiness.inspect_brevo(probe=True, transport=httpx.MockTransport(reply))
    assert not result["provider_configuration_verified"]
    assert "SENDER_NOT_ACTIVE" in result["failure_codes"]


def test_provider_401_and_transport_error_are_sanitized():
    denied = brevo_readiness.inspect_brevo(
        probe=True, transport=httpx.MockTransport(lambda _: httpx.Response(401, text="DO-NOT-EXPOSE-SECRET"))
    )
    assert "ACCOUNT_BREVO_HTTP_401" in denied["failure_codes"]
    assert "DO-NOT-EXPOSE-SECRET" not in json.dumps(denied)

    def fail(request):
        raise httpx.ReadTimeout("DO-NOT-EXPOSE-SECRET", request=request)

    failed = brevo_readiness.inspect_brevo(probe=True, transport=httpx.MockTransport(fail))
    assert "ACCOUNT_BREVO_TRANSPORT_FAILURE" in failed["failure_codes"]
    assert "DO-NOT-EXPOSE-SECRET" not in json.dumps(failed)


def test_missing_dns_authentication_is_blocked():
    def reply(request):
        if request.url.path == "/v3/account":
            return httpx.Response(200, json={})
        if request.url.path == "/v3/senders":
            return httpx.Response(200, json={"senders": [{"email": "hello@kraviaprivatelimited.com", "active": True}]})
        return httpx.Response(200, json={"verified": True, "authenticated": False})

    result = brevo_readiness.inspect_brevo(probe=True, transport=httpx.MockTransport(reply))
    assert result["domain_verified"] is True
    assert result["domain_authenticated"] is False
    assert result["provider_configuration_verified"] is False
    assert "DOMAIN_NOT_AUTHENTICATED" in result["failure_codes"]
