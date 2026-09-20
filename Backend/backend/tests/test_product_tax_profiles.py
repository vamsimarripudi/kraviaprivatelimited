import os, tempfile

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"
os.environ.pop("KRAVIA_GSTIN", None)
os.environ.pop("TAX_CONFIG_APPROVED", None)

from fastapi.testclient import TestClient
from backend.main import app


def h(role="FINANCE"):
    return {"X-Office-Actor": f"{role} Tax Test", "X-Office-Role": role}


def test_canonical_product_tax_profiles_and_backend_owned_invoice_tax():
    with TestClient(app) as client:
        products = {item["code"]: item for item in client.get("/api/v1/products", headers=h()).json()}
        assert {"VL", "RF", "YK", "VO", "VM", "VF"}.issubset(products)

        profiles = client.get("/api/v1/tax/gst/product-profiles", headers=h()).json()
        by_code = {item["product_code"]: item for item in profiles}
        assert set(by_code) == {"VL", "RF", "YK", "VO", "VM", "VF"}
        assert all(item["sac"] == "998319" and item["gst_rate"] == "18" for item in profiles)
        assert by_code["YK"]["billing_enabled"] is False
        assert by_code["VO"]["billing_enabled"] is False
        assert by_code["VL"]["status"] == "REVIEW_REQUIRED"

        config = client.get("/api/v1/tax/gst/configuration", headers=h()).json()
        assert config["gstin"]["configured"] is False
        assert config["ready_for_production_invoicing"] is False
        assert config["profiles"]["billing_enabled"] == 4
        assert config["profiles"]["pending_billing"] == 4

        customer = client.post(
            "/api/v1/customers",
            headers=h() | {"Idempotency-Key": "tax-profile-customer"},
            json={"legal_name": "Tax Profile School", "state": "Andhra Pradesh", "state_code": "37"},
        ).json()

        plan = client.post(
            "/api/v1/commercial/plans",
            headers=h(),
            json={
                "product_id": products["VL"]["id"],
                "code": "CONTROLLED",
                "name": "Controlled plan",
                "billing_cycle": "MONTHLY",
                "price": "1000",
                "effective_from": "2026-09-20",
            },
        )
        assert plan.status_code == 201
        assert plan.json()["sac"] == "998319"
        assert plan.json()["gst_rate"] == "18"

        invoice = client.post(
            "/api/v1/invoices",
            headers=h() | {"Idempotency-Key": "tax-profile-invoice"},
            json={
                "customer_id": customer["id"],
                "product_id": products["VL"]["id"],
                "description": "VidyaLuma hosted SaaS",
                "taxable_value": "1000",
            },
        )
        assert invoice.status_code == 201
        body = invoice.json()
        assert body["sac"] == "998319"
        assert body["gst_rate"] == "18"
        assert body["cgst"] == "90.00"
        assert body["sgst"] == "90.00"
        assert body["total"] == "1180.00"
        assert body["snapshot"]["product"]["tax_profile"]["id"] == "TAX-VL"

        mismatch = client.post(
            "/api/v1/invoices",
            headers=h() | {"Idempotency-Key": "tax-profile-mismatch"},
            json={
                "customer_id": customer["id"],
                "product_id": products["VL"]["id"],
                "description": "Wrong tax override",
                "sac": "998314",
                "taxable_value": "1000",
            },
        )
        assert mismatch.status_code == 422
        assert "controlled product tax profile" in mismatch.json()["detail"]

        disabled = client.post(
            "/api/v1/invoices",
            headers=h() | {"Idempotency-Key": "tax-profile-disabled"},
            json={
                "customer_id": customer["id"],
                "product_id": products["YK"]["id"],
                "description": "YUKTA pre-launch",
                "taxable_value": "1000",
            },
        )
        assert disabled.status_code == 409
        assert "Billing is disabled" in disabled.json()["detail"]


def test_ca_approval_and_reopen_controls():
    with TestClient(app) as client:
        product = next(item for item in client.get("/api/v1/products", headers=h()).json() if item["code"] == "VL")

        denied = client.post(
            f"/api/v1/tax/gst/product-profiles/{product['id']}/approve",
            headers=h("FINANCE"),
            json={"evidence_ref": "CA/GST/2026/001"},
        )
        assert denied.status_code == 403

        approved = client.post(
            f"/api/v1/tax/gst/product-profiles/{product['id']}/approve",
            headers=h("CA"),
            json={"evidence_ref": "CA/GST/2026/001", "note": "Reviewed against hosted SaaS supply model."},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "APPROVED"
        assert approved.json()["evidence_ref"] == "CA/GST/2026/001"

        blocked_edit = client.put(
            f"/api/v1/tax/gst/product-profiles/{product['id']}",
            headers=h("FINANCE"),
            json={
                "sac": "998319",
                "gst_rate": "18",
                "tax_treatment": "TAXABLE",
                "supply_model": "HOSTED_SAAS",
                "billing_enabled": True,
                "classification_basis": "Hosted SaaS supply with no standard transfer of software ownership or IP rights.",
                "source_ref": "CBIC official service classification and IT/ITES GST guidance",
            },
        )
        assert blocked_edit.status_code == 409

        reopened = client.post(
            f"/api/v1/tax/gst/product-profiles/{product['id']}/reopen",
            headers=h("CA"),
        )
        assert reopened.status_code == 200
        assert reopened.json()["status"] == "REVIEW_REQUIRED"
        assert reopened.json()["approved_by"] is None
