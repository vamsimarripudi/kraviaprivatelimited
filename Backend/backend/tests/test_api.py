import os, tempfile
fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"

from fastapi.testclient import TestClient
from backend.main import app

H={"X-Office-Actor":"Test Owner","X-Office-Role":"OWNER"}

def test_end_to_end_billing_and_tax():
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
        products=c.get("/api/v1/products",headers=H).json()
        vl=next(x for x in products if x["code"]=="VL")
        customer=c.post("/api/v1/customers",headers=H|{"Idempotency-Key":"cust-1"},json={
            "legal_name":"Enterprise Test School","state":"Andhra Pradesh","state_code":"37","country":"India","billing_address":"Test Address"
        }).json()
        inv=c.post("/api/v1/invoices",headers=H|{"Idempotency-Key":"inv-1"},json={
            "customer_id":customer["id"],"product_id":vl["id"],"description":"VidyaLuma annual subscription","sac":"9983","qty":"1","taxable_value":"1000.00","discount":"0","gst_rate":"18"
        }).json()
        assert inv["invoice_no"].startswith("VL/")
        assert inv["cgst"] == "90.00" and inv["sgst"] == "90.00" and inv["igst"] == "0.00"
        pay=c.post(f'/api/v1/invoices/{inv["id"]}/payments',headers=H|{"Idempotency-Key":"pay-1"},json={"amount":"1180.00","method":"Bank Transfer","external_reference":"TEST-UTR-1","received_date":"2026-09-12"}).json()
        assert pay["invoice"]["status"] == "PAID"
        assert pay["invoice"]["balance"] == "0.00"
        gst=c.get("/api/v1/tax/gst/summary",headers=H).json()
        assert gst["net_taxable"] == "1000.00"
        assert gst["total"] == "1180.00"
        audit=c.get("/api/v1/audit",headers=H).json()
        assert any(x["event_type"]=="invoice.issued" for x in audit)
        manifest=c.get("/api/v1/inspection/manifest",headers=H).json()
        assert manifest["records"]["invoice_count"] == 1
