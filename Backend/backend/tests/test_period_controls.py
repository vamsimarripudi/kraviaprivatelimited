import os
import tempfile
from datetime import datetime, timezone

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"
os.environ["FINANCE_EXECUTION_MODE"] = "sandbox"

from fastapi.testclient import TestClient
from backend.app import app


def h(role="OWNER", actor="Period Maker", idem=None):
    headers = {"X-Office-Actor": actor, "X-Office-Role": role}
    if idem:
        headers["Idempotency-Key"] = idem
    return headers


def approve_unlock(client, approval_id):
    response = client.post(
        f"/api/v1/approvals/{approval_id}/approve",
        headers=h("CA", "Independent Period Checker"),
        json={"reason": "Independent close-control approval"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "APPROVED"


def unlock(client, lock_id):
    requested = client.post(
        f"/api/v1/accounting/period-locks/{lock_id}/unlock-request",
        headers=h("FINANCE", "Period Reopen Maker"),
        json={"reason": "Controlled correction requires reopening"},
    )
    assert requested.status_code == 201, requested.text
    approval_id = requested.json()["approval_id"]
    approve_unlock(client, approval_id)
    opened = client.post(
        f"/api/v1/accounting/period-locks/{lock_id}/unlock",
        headers=h("FINANCE", "Period Reopen Operator"),
        json={"approval_id": approval_id},
    )
    assert opened.status_code == 200, opened.text
    assert opened.json()["status"] == "OPEN"


def test_accounting_lock_blocks_backdated_payment_until_independently_unlocked():
    with TestClient(app) as client:
        product = next(x for x in client.get("/api/v1/products", headers=h()).json() if x["code"] == "VL")
        customer = client.post(
            "/api/v1/customers",
            headers=h(idem="period-customer"),
            json={"legal_name": "Period Control Test Customer", "state": "Andhra Pradesh", "state_code": "37"},
        ).json()
        invoice = client.post(
            "/api/v1/invoices",
            headers=h("FINANCE", "Invoice Maker", "period-invoice"),
            json={"customer_id": customer["id"], "product_id": product["id"], "description": "Period control test", "taxable_value": "1000", "gst_rate": "18"},
        )
        assert invoice.status_code == 201, invoice.text
        invoice_id = invoice.json()["id"]

        lock = client.post(
            "/api/v1/accounting/period-locks",
            headers=h("FINANCE", "Close Maker"),
            json={"period_start": "2020-01-01", "period_end": "2020-01-31", "lock_type": "ACCOUNTING", "reason": "Closed historical accounting period"},
        )
        assert lock.status_code == 201, lock.text
        lock_id = lock.json()["id"]

        blocked = client.post(
            f"/api/v1/invoices/{invoice_id}/payments",
            headers=h("FINANCE", "Payment Maker", "period-payment-blocked"),
            json={"amount": "100", "method": "Bank Transfer", "external_reference": "PERIOD-LOCK-UTR-1", "received_date": "2020-01-15"},
        )
        assert blocked.status_code == 409, blocked.text
        assert blocked.json()["domain"] == "ACCOUNTING"

        unlock(client, lock_id)
        accepted = client.post(
            f"/api/v1/invoices/{invoice_id}/payments",
            headers=h("FINANCE", "Payment Maker", "period-payment-accepted"),
            json={"amount": "100", "method": "Bank Transfer", "external_reference": "PERIOD-LOCK-UTR-2", "received_date": "2020-01-15"},
        )
        assert accepted.status_code == 201, accepted.text


def test_tax_lock_blocks_new_tax_document_but_not_after_approved_reopen():
    today = datetime.now(timezone.utc).date().isoformat()
    with TestClient(app) as client:
        product = next(x for x in client.get("/api/v1/products", headers=h()).json() if x["code"] == "VF")
        customer = client.post(
            "/api/v1/customers",
            headers=h(idem="tax-period-customer"),
            json={"legal_name": "Tax Period Test Customer", "state": "Andhra Pradesh", "state_code": "37"},
        ).json()
        lock = client.post(
            "/api/v1/accounting/period-locks",
            headers=h("CA", "Tax Close Maker"),
            json={"period_start": today, "period_end": today, "lock_type": "TAX", "reason": "Tax day closed for filing control"},
        )
        assert lock.status_code == 201, lock.text
        lock_id = lock.json()["id"]

        blocked = client.post(
            "/api/v1/invoices",
            headers=h("FINANCE", "Tax Invoice Maker", "tax-lock-invoice-blocked"),
            json={"customer_id": customer["id"], "product_id": product["id"], "description": "Tax lock test", "taxable_value": "500", "gst_rate": "18"},
        )
        assert blocked.status_code == 409, blocked.text
        assert blocked.json()["domain"] == "TAX"

        unlock(client, lock_id)
        accepted = client.post(
            "/api/v1/invoices",
            headers=h("FINANCE", "Tax Invoice Maker", "tax-lock-invoice-accepted"),
            json={"customer_id": customer["id"], "product_id": product["id"], "description": "Tax lock test", "taxable_value": "500", "gst_rate": "18"},
        )
        assert accepted.status_code == 201, accepted.text
