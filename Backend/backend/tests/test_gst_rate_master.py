import os, tempfile

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"

from fastapi.testclient import TestClient
from backend.main import app


def h(role="FINANCE"):
    return {"X-Office-Actor": f"{role} GST Test", "X-Office-Role": role}


def create_customer(client, key, state, state_code):
    response = client.post(
        "/api/v1/customers",
        headers=h() | {"Idempotency-Key": key},
        json={"legal_name": f"GST {state} Customer", "state": state, "state_code": state_code},
    )
    assert response.status_code == 201
    return response.json()


def test_gst_master_and_invoice_rate_enforcement():
    with TestClient(app) as client:
        master_response = client.get("/api/v1/tax/gst/master", headers=h())
        assert master_response.status_code == 200
        master = master_response.json()
        assert master["standard_rates"] == ["0", "0.5", "1", "2", "3", "5", "12", "18", "28", "40"]
        assert master["it_services"]["default_rate"] == "18"
        assert any(item["code"] == "998319" for item in master["it_services"]["sacs"])

        product = next(item for item in client.get("/api/v1/products", headers=h()).json() if item["code"] == "VL")
        intra = create_customer(client, "gst-customer-intra", "Andhra Pradesh", "37")
        interstate = create_customer(client, "gst-customer-inter", "Karnataka", "29")

        intra_invoice = client.post(
            "/api/v1/invoices",
            headers=h() | {"Idempotency-Key": "gst-invoice-intra"},
            json={
                "customer_id": intra["id"],
                "product_id": product["id"],
                "description": "IT service",
                "sac": "998319",
                "taxable_value": "1000",
                "gst_rate": "18",
            },
        )
        assert intra_invoice.status_code == 201
        intra_body = intra_invoice.json()
        assert intra_body["cgst"] == "90.00"
        assert intra_body["sgst"] == "90.00"
        assert intra_body["igst"] == "0.00"
        assert intra_body["total"] == "1180.00"

        inter_invoice = client.post(
            "/api/v1/invoices",
            headers=h() | {"Idempotency-Key": "gst-invoice-inter"},
            json={
                "customer_id": interstate["id"],
                "product_id": product["id"],
                "description": "IT service",
                "sac": "998319",
                "taxable_value": "1000",
                "gst_rate": "18",
            },
        )
        assert inter_invoice.status_code == 201
        inter_body = inter_invoice.json()
        assert inter_body["cgst"] == "0.00"
        assert inter_body["sgst"] == "0.00"
        assert inter_body["igst"] == "180.00"
        assert inter_body["total"] == "1180.00"

        invalid = client.post(
            "/api/v1/invoices",
            headers=h() | {"Idempotency-Key": "gst-invoice-invalid"},
            json={
                "customer_id": intra["id"],
                "product_id": product["id"],
                "description": "Invalid rate attempt",
                "sac": "998319",
                "taxable_value": "1000",
                "gst_rate": "7",
            },
        )
        assert invalid.status_code == 422
        assert "GST rate must be one of the GSTN/IRP standard rates" in str(invalid.json())
