"""Unit-level security and schema contract tests for public visitor email routing."""
import hashlib
import hmac
import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.public_access_email import _validate_signature, _fingerprint, PublicAccessMail
from backend.email_templates import public_access_mail_template


@pytest.fixture
def configured_secret(monkeypatch):
    key="local-test-public-intake-hmac-secret-1234567890"
    monkeypatch.setenv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", key)
    return key


def make_request(body: bytes, headers: dict[str,str]) -> Request:
    encoded=[(k.lower().encode("ascii"),v.encode("ascii")) for k,v in headers.items()]
    scope={"type":"http","http_version":"1.1","method":"POST","path":"/api/v1/public-access/email",
        "scheme":"https","query_string":b"","headers":encoded,"server":("test",443),"client":("test",0)}
    return Request(scope,receive=lambda:None)


def test_valid_signed_email_uses_separate_domain(configured_secret):
    body=b'{"kind":"ACCOUNT_CODE","event_id":"public-code:12345"}'
    timestamp=str(int(time.time()))
    signature=hmac.new(configured_secret.encode(),b"public-access-v1."+timestamp.encode()+b"."+body,hashlib.sha256).hexdigest()
    request=make_request(body,{"x-kravia-public-timestamp":timestamp,"x-kravia-public-signature":"v1="+signature})
    assert _validate_signature(request,body)==configured_secret
    assert _fingerprint(configured_secret,"sample@example.com")!=_fingerprint(configured_secret,"other@example.com")
    with pytest.raises(HTTPException) as error:
        _validate_signature(request,body+b"!")
    assert error.value.status_code==403


def test_mail_model_forbids_arbitrary_content():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        PublicAccessMail.model_validate({"kind":"ACCOUNT_CODE","event_id":"public-code:1234",
            "recipient_email":"sample@example.com","recipient_name":"Sample Person","html":"<script>x</script>"})
    html=public_access_mail_template(kind="ACCOUNT_WELCOME",recipient_name="Sample Person").html_content
    assert "/brand/email/linkedin-v2.png" in html
    assert "public account is separate from KRAVIA Office" in html
