import json
import os
import tempfile
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"

from fastapi.testclient import TestClient
from backend.app import app
from backend.gst_gsp_fynamics import (
    AUTHTOKEN_PATH,
    AUTH_PATH,
    FILE_CONTRACT,
    REQUEST_OTP_PATH,
    FynamicsClient,
    FynamicsConfig,
    build_gstr1_payload,
)


def h(role="FINANCE", actor=None):
    return {"X-Office-Actor": actor or f"{role} Fynamics Test", "X-Office-Role": role}


def config():
    return FynamicsConfig(
        environment="sandbox",
        base_url="https://fyn.example.test/api",
        client_id="client",
        client_secret="secret",
        username="gst-user",
        gstin="37AANCK0043M1ZA",
        state_code="37",
        ip_usr="203.0.113.10",
        timeout_seconds=2,
        filing_contract=FILE_CONTRACT,
        prev_year_turnover="0",
        current_year_turnover="0",
    )


def test_fynamics_gateway_and_taxpayer_auth_are_memory_only():
    seen = []
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, dict(request.headers), request.content))
        if request.url.path == "/api" + AUTH_PATH:
            assert request.headers["clientid"] == "client"
            assert request.headers["clientsecret"] == "secret"
            return httpx.Response(200, json={"access_token": "gateway-token", "expires_in": 3600})
        if request.url.path == "/api" + REQUEST_OTP_PATH:
            assert request.headers["authorization"] == "Bearer gateway-token"
            assert request.headers["ip-usr"] == "203.0.113.10"
            assert json.loads(request.content) == {"action": "OTPREQUEST", "username": "gst-user"}
            return httpx.Response(200, json={"status_cd": "1", "message": "OTP sent"})
        if request.url.path == "/api" + AUTHTOKEN_PATH:
            assert json.loads(request.content)["otp"] == "123456"
            return httpx.Response(200, json={
                "status_cd": "1",
                "data": {"authtoken": "tax-token", "sek": "sek-value", "app_key": "app-key-value"},
            })
        return httpx.Response(404)

    client = FynamicsClient(config(), transport=httpx.MockTransport(handler))
    try:
        client.request_taxpayer_otp()
        client.authorize_taxpayer("123456")
        session = client.taxpayer_session()
        assert session.authtoken == "tax-token"
        assert session.sek == "sek-value"
        assert session.app_key == "app-key-value"
    finally:
        client.close()
    assert [item[1] for item in seen] == ["/api" + AUTH_PATH, "/api" + REQUEST_OTP_PATH, "/api" + AUTHTOKEN_PATH]


def test_gstr1_builder_separates_b2b_b2cl_and_b2cs():
    registered = SimpleNamespace(id="C1", gstin="29ABCDE1234F1Z5", state_code="29")
    b2cl_customer = SimpleNamespace(id="C2", gstin=None, state_code="29")
    b2cs_customer = SimpleNamespace(id="C3", gstin=None, state_code="37")
    product = SimpleNamespace(id="P1", name="VidyaLuma")
    issued = datetime(2026, 9, 20, tzinfo=timezone.utc)
    def inv(i, customer, total, igst, cgst=0, sgst=0):
        return SimpleNamespace(
            id=f"I{i}", invoice_no=f"VL/2627/00000{i}", customer_id=customer.id,
            product_id="P1", status="ISSUED", issued_at=issued, sac="998319",
            description="Hosted SaaS", qty_milli=1000, net_taxable_paise=100000,
            total_paise=total, gst_rate_bps=1800, igst_paise=igst,
            cgst_paise=cgst, sgst_paise=sgst,
        )
    invoices = [
        inv(1, registered, 118000, 18000),
        inv(2, b2cl_customer, 12000000, 18000),
        inv(3, b2cs_customer, 118000, 0, 9000, 9000),
    ]
    class Scalars:
        def __init__(self, values): self.values=values
        def all(self): return self.values
    class Result:
        def __init__(self, values): self.values=values
        def scalars(self): return Scalars(self.values)
    class DB:
        calls=0
        def execute(self, _stmt):
            self.calls += 1
            return Result([invoices, [registered,b2cl_customer,b2cs_customer], [product]][self.calls-1])
    payload = build_gstr1_payload(DB(), SimpleNamespace(period="2026-09"), config())
    assert payload["fp"] == "092026"
    assert payload["b2b"][0]["ctin"] == registered.gstin
    assert payload["b2cl"][0]["pos"] == "29"
    assert payload["b2cs"][0]["sply_ty"] == "INTRA"
    assert payload["hsn"]["data"][0]["hsn_sc"] == "998319"
    assert payload["doc_issue"]["doc_det"][0]["docs"][0]["net_issue"] == 3


def test_gsp_status_is_fail_closed_without_credentials(monkeypatch):
    for name in (
        "GST_GSP_CLIENT_ID","GST_GSP_CLIENT_SECRET","GST_GSP_USERNAME",
        "KRAVIA_GSTIN","GST_GSP_STATE_CODE","GST_GSP_IP_USR","GST_GSP_FILING_CONTRACT",
    ):
        monkeypatch.delenv(name, raising=False)
    with TestClient(app) as client:
        status = client.get("/api/v1/tax/gst/gsp/status", headers=h())
        assert status.status_code == 200
        body = status.json()
        assert body["provider"] == "FYNAMICS"
        assert body["configured"] is False
        assert body["filing_contract_ready"] is False
        otp = client.post("/api/v1/tax/gst/gsp/taxpayer/request-otp", headers=h())
        assert otp.status_code == 409


def test_gstr3b_requires_ca_itc_review_before_approval():
    with TestClient(app) as client:
        working = client.post(
            "/api/v1/tax/gst/returns/build",
            headers=h(),
            json={"form_type": "GSTR3B", "period": "2026-09"},
        )
        assert working.status_code == 200
        return_id = working.json()["id"]
        blocked = client.post(
            f"/api/v1/tax/gst/returns/{return_id}/review",
            headers=h("CA"),
            json={"decision": "APPROVE", "note": "Review complete"},
        )
        assert blocked.status_code == 409
        itc = client.post(
            f"/api/v1/tax/gst/gsp/returns/{return_id}/itc-review",
            headers=h("CA"),
            json={"igst": "0", "cgst": "0", "sgst": "0", "cess": "0", "evidence_ref": "CA/ITC/SEP-2026", "note": "No ITC claimed pending 2B evidence."},
        )
        assert itc.status_code == 200
        approved = client.post(
            f"/api/v1/tax/gst/returns/{return_id}/review",
            headers=h("CA"),
            json={"decision": "APPROVE", "note": "Approved with zero ITC claim."},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "APPROVED_FOR_FILING"


def test_final_file_requires_explicit_acceptance_tested_contract(monkeypatch):
    monkeypatch.setenv("GST_GSP_BASE_URL", "https://fyn.example.test/api")
    monkeypatch.setenv("GST_GSP_CLIENT_ID", "client")
    monkeypatch.setenv("GST_GSP_CLIENT_SECRET", "secret")
    monkeypatch.setenv("GST_GSP_USERNAME", "gst-user")
    monkeypatch.setenv("KRAVIA_GSTIN", "37AANCK0043M1ZA")
    monkeypatch.setenv("GST_GSP_STATE_CODE", "37")
    monkeypatch.setenv("GST_GSP_IP_USR", "203.0.113.10")
    monkeypatch.delenv("GST_GSP_FILING_CONTRACT", raising=False)
    client = FynamicsClient(FynamicsConfig.from_env(), transport=httpx.MockTransport(lambda request: httpx.Response(500)))
    try:
        with pytest.raises(Exception, match="Final EVC filing is disabled"):
            client.file_return("GSTR3B", "092026", "ABCDE1234F", "123456")
    finally:
        client.close()
