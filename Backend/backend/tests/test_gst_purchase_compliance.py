import json
import os
import tempfile

import httpx

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"

from fastapi.testclient import TestClient

from backend.app import app
from backend.gst_compliance import (
    IRIS_DATA_STATUS_PATH,
    IRIS_PURCHASE_DOWNLOAD_PATH,
    IrisVasClient,
    IrisVasConfig,
)


def h(role="FINANCE", actor=None):
    return {
        "X-Office-Actor": actor or f"{role} GST Compliance Test",
        "X-Office-Role": role,
    }


def sample_purchase():
    return {
        "Irn": "b" * 64,
        "Status": "ACT",
        "SellerDtls": {
            "Gstin": "29ABCDE1234F1Z5",
            "LglNm": "Example Cloud Vendor Private Limited",
        },
        "BuyerDtls": {
            "Gstin": "37AANCK0043M1ZA",
            "LglNm": "KRAVIA PRIVATE LIMITED",
            "Pos": "37",
        },
        "DocDtls": {
            "Typ": "INV",
            "No": "AWS-SEP-001",
            "Dt": "20/09/2026",
        },
        "ValDtls": {
            "AssVal": 1000,
            "CgstVal": 90,
            "SgstVal": 90,
            "IgstVal": 0,
            "CesVal": 0,
            "TotInvVal": 1180,
        },
        "ItemList": [
            {
                "SlNo": "1",
                "PrdDesc": "Cloud services",
                "IsServc": "Y",
                "HsnCd": "998315",
                "AssAmt": 1000,
                "GstRt": 18,
                "CgstAmt": 90,
                "SgstAmt": 90,
            }
        ],
    }


def test_purchase_import_reconcile_and_return_working():
    with TestClient(app) as client:
        vendor = client.post(
            "/api/v1/vendors",
            headers=h(),
            json={
                "legal_name": "Example Cloud Vendor Private Limited",
                "category": "Cloud infrastructure",
                "gstin": "29ABCDE1234F1Z5",
                "risk": "LOW",
                "product_codes": [],
            },
        )
        assert vendor.status_code == 201

        bank = client.post(
            "/api/v1/banking/accounts",
            headers=h("OWNER"),
            json={
                "bank_name": "HDFC Bank",
                "account_name": "KRAVIA PRIVATE LIMITED",
                "masked_account": "XXXXXXXX8782",
                "ifsc": "HDFC0000001",
                "purpose": "Current Account",
            },
        )
        assert bank.status_code == 201

        bank_tx = client.post(
            "/api/v1/banking/transactions",
            headers=h(),
            json={
                "bank_account_id": bank.json()["id"],
                "transaction_date": "2026-09-20",
                "amount": "1180",
                "direction": "DEBIT",
                "reference": "AWS-SEP-001",
                "description": "Cloud invoice AWS-SEP-001",
                "source": "TEST_BANK_FEED",
            },
        )
        assert bank_tx.status_code == 201

        imported = client.post(
            "/api/v1/tax/gst/purchases/import",
            headers=h(),
            json={"payload": {"invoices": [sample_purchase()]}},
        )
        assert imported.status_code == 201
        assert imported.json() == {"imported": 1, "duplicate": 0, "invalid": 0, "seen": 1}

        duplicate = client.post(
            "/api/v1/tax/gst/purchases/import",
            headers=h(),
            json={"payload": sample_purchase()},
        )
        assert duplicate.status_code == 201
        assert duplicate.json()["duplicate"] == 1

        reconciliation = client.post("/api/v1/tax/gst/purchases/reconcile", headers=h())
        assert reconciliation.status_code == 200
        assert reconciliation.json()["statuses"]["BANK_MATCHED"] == 1

        purchases = client.get("/api/v1/tax/gst/purchases", headers=h()).json()
        assert len(purchases) == 1
        purchase = purchases[0]
        assert purchase["document_date"] == "2026-09-20"
        assert purchase["reconciliation_status"] == "BANK_MATCHED"
        assert purchase["vendor_id"] == vendor.json()["id"]
        assert purchase["bank_transaction_id"] == bank_tx.json()["id"]
        assert purchase["itc_review_status"] == "REVIEW_REQUIRED"

        summary = client.get("/api/v1/tax/gst/purchases/summary", headers=h()).json()
        assert summary["invoice_count"] == 1
        assert summary["taxable"] == "1000.00"
        assert summary["cgst"] == "90.00"
        assert summary["sgst"] == "90.00"
        assert summary["total"] == "1180.00"
        assert summary["itc_review_required"] == 1
        assert "No ITC eligibility" in summary["note"]

        working = client.post(
            "/api/v1/tax/gst/returns/build",
            headers=h(),
            json={"form_type": "GSTR3B", "period": "2026-09"},
        )
        assert working.status_code == 200
        body = working.json()
        assert body["status"] == "DRAFT"
        assert body["summary"]["inward_gst_observed"]["cgst"] == 9000
        assert body["summary"]["inward_gst_observed"]["sgst"] == 9000
        assert body["summary"]["itc_claim"] is None

        denied = client.post(
            f"/api/v1/tax/gst/returns/{body['id']}/review",
            headers=h("FINANCE"),
            json={"decision": "APPROVE", "note": "Reviewed"},
        )
        assert denied.status_code == 403

        itc_review = client.post(
            f"/api/v1/tax/gst/gsp/returns/{body['id']}/itc-review",
            headers=h("CA"),
            json={
                "igst": "0",
                "cgst": "0",
                "sgst": "0",
                "cess": "0",
                "evidence_ref": "CA/ITC/2026-09",
                "note": "No ITC claimed in this test working.",
            },
        )
        assert itc_review.status_code == 200

        reviewed = client.post(
            f"/api/v1/tax/gst/returns/{body['id']}/review",
            headers=h("CA"),
            json={"decision": "APPROVE", "note": "CA working reviewed against current books and inward evidence."},
        )
        assert reviewed.status_code == 200
        assert reviewed.json()["status"] == "APPROVED_FOR_FILING"

        filed = client.post(
            f"/api/v1/tax/gst/returns/{body['id']}/filing-evidence",
            headers=h("OWNER"),
            json={
                "provider": "GSTN GSP TEST EVIDENCE",
                "arn": "AA370926000001X",
                "evidence_ref": "TEST/RETURN/2026-09/GSTR3B",
            },
        )
        assert filed.status_code == 200
        assert filed.json()["status"] == "FILED_EVIDENCE_RECORDED"
        assert filed.json()["filing_arn"] == "AA370926000001X"


def test_vas_status_is_fail_closed_without_credentials():
    for name in (
        "GST_IRP_VAS_BASE_URL",
        "GST_IRP_VAS_PORTAL_ID",
        "GST_IRP_VAS_USER_ID",
        "GST_IRP_VAS_AUTH_TOKEN",
    ):
        os.environ.pop(name, None)

    with TestClient(app) as client:
        status = client.get("/api/v1/tax/gst/vas/status", headers=h())
        assert status.status_code == 200
        body = status.json()
        assert body["data_api_configured"] is False
        assert body["consent_required"] is True
        assert body["recipient_download_path"] == IRIS_PURCHASE_DOWNLOAD_PATH
        assert body["gsp"]["filing_enabled"] is False

        request = client.post(
            "/api/v1/tax/gst/vas/purchases/request",
            headers=h(),
            json={"provider_payload": {"from": "2026-09-01", "to": "2026-09-30"}},
        )
        assert request.status_code == 409
        assert "not configured" in request.json()["detail"]


def test_vas_client_uses_exact_official_recipient_and_status_paths(monkeypatch):
    monkeypatch.setenv("GST_IRP_VAS_BASE_URL", "https://vas.example.test")
    monkeypatch.setenv("GST_IRP_VAS_PORTAL_ID", "portal-test")
    monkeypatch.setenv("GST_IRP_VAS_USER_ID", "finance@kraviaprivatelimited.com")
    monkeypatch.setenv("GST_IRP_VAS_AUTH_TOKEN", "vas-auth-token")
    monkeypatch.setenv("GST_IRP_VAS_PORTAL_ID_HEADER", "portalid")
    monkeypatch.setenv("GST_IRP_VAS_USER_ID_HEADER", "user_id")
    monkeypatch.setenv("GST_IRP_VAS_AUTH_TOKEN_HEADER", "auth-token")

    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, dict(request.headers)))
        assert request.headers["portalid"] == "portal-test"
        assert request.headers["user_id"] == "finance@kraviaprivatelimited.com"
        assert request.headers["auth-token"] == "vas-auth-token"
        if request.url.path == IRIS_PURCHASE_DOWNLOAD_PATH:
            assert json.loads(request.content)["merged"] is True
            return httpx.Response(200, json={"status": "SUCCESS", "requestId": "REQ-1"})
        if request.url.path == IRIS_DATA_STATUS_PATH:
            assert request.url.params["requestId"] == "REQ-1"
            return httpx.Response(200, json={"status": "IN_PROGRESS", "requestId": "REQ-1"})
        return httpx.Response(404)

    client = IrisVasClient(IrisVasConfig(), transport=httpx.MockTransport(handler))
    try:
        request, digest = client.request_purchase_download({"merged": True})
        assert request["requestId"] == "REQ-1"
        assert len(digest) == 64
        status, digest = client.get_download_status({"requestId": "REQ-1"})
        assert status["status"] == "IN_PROGRESS"
        assert len(digest) == 64
    finally:
        client.close()

    assert [item[1] for item in seen] == [
        "/portal/download/buyer/view/file",
        "/portal/download/view/file/status",
    ]
