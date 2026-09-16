import os
import tempfile

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"
os.environ["FINANCE_EXECUTION_MODE"] = "sandbox"

from fastapi.testclient import TestClient
from backend.app import app


def h(role="OWNER", actor="Finance Maker", idem=None):
    headers = {"X-Office-Actor": actor, "X-Office-Role": role}
    if idem:
        headers["Idempotency-Key"] = idem
    return headers


def approve(c, approval_id):
    response = c.post(
        f"/api/v1/approvals/{approval_id}/approve",
        headers=h("DIRECTOR", "Independent Checker"),
        json={"reason": "Independent approval for automated test"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "APPROVED"


def create_cap_table(c):
    share_class = c.post(
        "/api/v1/ownership/share-classes",
        headers=h(),
        json={"code": "EQ", "name": "Equity", "face_value": "10", "authorised_shares": 10000, "source_document_ref": "controlled-test-evidence"},
    ).json()
    a = c.post(
        "/api/v1/ownership/shareholders",
        headers=h(),
        json={"shareholder_no": "T-001", "legal_name": "Test Holder A", "source_document_ref": "controlled-test-evidence"},
    ).json()
    b = c.post(
        "/api/v1/ownership/shareholders",
        headers=h(),
        json={"shareholder_no": "T-002", "legal_name": "Test Holder B", "source_document_ref": "controlled-test-evidence"},
    ).json()
    for holder, qty, key in [(a, 8000, "issue-a"), (b, 2000, "issue-b")]:
        staged = c.post(
            "/api/v1/ownership/share-changes",
            headers=h(idem=key),
            json={"shareholder_id": holder["id"], "share_class_id": share_class["id"], "entry_type": "ISSUE", "quantity_delta": qty, "instrument_date": "2026-09-15", "source_document_ref": "controlled-test-evidence"},
        )
        assert staged.status_code == 201, staged.text
        approve(c, staged.json()["approval_request_id"])
        posted = c.post(f"/api/v1/ownership/share-changes/{staged.json()['id']}/post", headers=h("CS", "Registry Poster"))
        assert posted.status_code == 200, posted.text
    return share_class, a, b


def test_ownership_funding_collection_and_transfer_are_separate():
    with TestClient(app) as c:
        share_class, a, b = create_cap_table(c)
        summary = c.get("/api/v1/ownership/summary", headers=h()).json()
        assert summary["total_issued_shares"] == 10000
        percentages = {x["shareholder"]["id"]: x["ownership_percent"] for x in summary["cap_table"]}
        assert percentages[a["id"]] == "80.0000"
        assert percentages[b["id"]] == "20.0000"

        policy = c.post(
            "/api/v1/finance/funding-policies",
            headers=h("FINANCE", "Finance Maker"),
            json={"name": "Ownership-based expense funding", "allocation_basis": "OWNERSHIP", "source_document_ref": "controlled-test-evidence"},
        )
        assert policy.status_code == 201, policy.text
        approve(c, policy.json()["approval_request_id"])
        activated = c.post(f"/api/v1/finance/funding-policies/{policy.json()['id']}/activate", headers=h("FINANCE", "Finance Operator"))
        assert activated.status_code == 200, activated.text

        expense = c.post(
            "/api/v1/finance/expenses",
            headers=h("FINANCE", "Finance Maker", "expense-shareholder-funded"),
            json={"reference": "TEST-EXP-001", "title": "Controlled shared expense", "category": "Cloud", "amount": "1000", "funding_mode": "SHAREHOLDER_CONTRIBUTION", "funding_policy_id": policy.json()["id"], "source_document_ref": "controlled-test-evidence"},
        )
        assert expense.status_code == 201, expense.text
        approve(c, expense.json()["approval_request_id"])
        approved = c.post(f"/api/v1/finance/expenses/{expense.json()['id']}/approve", headers=h("FINANCE", "Finance Operator"))
        assert approved.status_code == 200, approved.text

        call = c.post("/api/v1/finance/contribution-calls", headers=h("FINANCE", "Finance Operator"), json={"expense_id": expense.json()["id"]})
        assert call.status_code == 201, call.text
        calls = c.get("/api/v1/finance/contribution-calls", headers=h()).json()
        allocations = next(x for x in calls if x["id"] == call.json()["id"])["allocations"]
        by_holder = {x["shareholder_id"]: x for x in allocations}
        assert by_holder[a["id"]]["amount"] == "800.00"
        assert by_holder[b["id"]]["amount"] == "200.00"

        mandates = {}
        for holder, limit in [(a, "1000"), (b, "500")]:
            mandate = c.post(
                "/api/v1/finance/mandates",
                headers=h("FINANCE", "Finance Operator"),
                json={"shareholder_id": holder["id"], "provider": "SANDBOX", "purpose": "Approved KRAVIA expense contribution", "max_amount": limit, "frequency": "AS_NEEDED", "source_document_ref": "controlled-test-evidence"},
            )
            assert mandate.status_code == 201, mandate.text
            active = c.post(f"/api/v1/finance/mandates/{mandate.json()['id']}/activate", headers=h("FINANCE", "Finance Operator"), json={"provider_mandate_ref": f"sandbox-{holder['id']}"})
            assert active.status_code == 200, active.text
            mandates[holder["id"]] = mandate.json()["id"]

        for allocation in allocations:
            scheduled = c.post(
                f"/api/v1/finance/contribution-allocations/{allocation['id']}/schedule",
                headers=h("FINANCE", "Collection Maker", f"collect-{allocation['id']}"),
                json={"mandate_id": mandates[allocation["shareholder_id"]]},
            )
            assert scheduled.status_code == 201, scheduled.text
            approve(c, scheduled.json()["approval_request_id"])
            ready = c.post(f"/api/v1/finance/payment-instructions/{scheduled.json()['id']}/approve", headers=h("FINANCE", "Payment Operator"))
            assert ready.status_code == 200, ready.text
            executed = c.post(f"/api/v1/finance/payment-instructions/{scheduled.json()['id']}/execute", headers=h("FINANCE", "Payment Operator"))
            assert executed.status_code == 200, executed.text
            assert executed.json()["status"] == "SUCCEEDED"

        funded = next(x for x in c.get("/api/v1/finance/contribution-calls", headers=h()).json() if x["id"] == call.json()["id"])
        assert funded["status"] == "FUNDED"
        unchanged = c.get("/api/v1/ownership/summary", headers=h()).json()
        unchanged_percentages = {x["shareholder"]["id"]: x["ownership_percent"] for x in unchanged["cap_table"]}
        assert unchanged_percentages == percentages

        transfer = c.post(
            "/api/v1/ownership/transfers",
            headers=h("CS", "Transfer Maker", "transfer-a-b"),
            json={"from_shareholder_id": a["id"], "to_shareholder_id": b["id"], "share_class_id": share_class["id"], "quantity": 250, "instrument_date": "2026-09-15", "source_document_ref": "controlled-transfer-evidence"},
        )
        assert transfer.status_code == 201, transfer.text
        blocked = c.post(f"/api/v1/ownership/transfers/{transfer.json()['id']}/post", headers=h("CS", "Transfer Maker"))
        assert blocked.status_code == 409
        approve(c, transfer.json()["approval_request_id"])
        posted = c.post(f"/api/v1/ownership/transfers/{transfer.json()['id']}/post", headers=h("CS", "Registry Poster"))
        assert posted.status_code == 200, posted.text
        after_transfer = c.get("/api/v1/ownership/summary", headers=h()).json()
        balances = {x["shareholder"]["id"]: x["shares"] for x in after_transfer["cap_table"]}
        assert balances[a["id"]] == 7750
        assert balances[b["id"]] == 2250
        assert after_transfer["total_issued_shares"] == 10000


def test_vendor_payout_idempotency_and_maker_checker():
    with TestClient(app) as c:
        vendor = c.post("/api/v1/vendors", headers=h("FINANCE", "Finance Maker"), json={"legal_name": "Test Vendor", "category": "Infrastructure", "risk": "LOW", "product_codes": []})
        assert vendor.status_code == 201, vendor.text
        expense_payload = {"vendor_id": vendor.json()["id"], "reference": "TEST-EXP-PAYOUT", "title": "Approved vendor expense", "category": "Infrastructure", "amount": "500", "funding_mode": "COMPANY_FUNDS", "source_document_ref": "controlled-test-evidence"}
        expense = c.post("/api/v1/finance/expenses", headers=h("FINANCE", "Finance Maker", "expense-payout"), json=expense_payload)
        assert expense.status_code == 201, expense.text
        mismatch = c.post("/api/v1/finance/expenses", headers=h("FINANCE", "Finance Maker", "expense-payout"), json={**expense_payload, "amount": "501"})
        assert mismatch.status_code == 409
        approve(c, expense.json()["approval_request_id"])
        c.post(f"/api/v1/finance/expenses/{expense.json()['id']}/approve", headers=h("FINANCE", "Finance Operator"))
        payout = c.post("/api/v1/finance/payouts", headers=h("FINANCE", "Payout Maker", "payout-test"), json={"expense_id": expense.json()["id"], "provider": "SANDBOX", "provider_destination_ref": "sandbox-fund-account"})
        assert payout.status_code == 201, payout.text
        self_approval = c.post(f"/api/v1/approvals/{payout.json()['approval_request_id']}/approve", headers=h("DIRECTOR", "Payout Maker"), json={"reason": "must fail"})
        assert self_approval.status_code == 409
        approve(c, payout.json()["approval_request_id"])
        ready = c.post(f"/api/v1/finance/payment-instructions/{payout.json()['id']}/approve", headers=h("FINANCE", "Payment Operator"))
        assert ready.status_code == 200, ready.text
        executed = c.post(f"/api/v1/finance/payment-instructions/{payout.json()['id']}/execute", headers=h("FINANCE", "Payment Operator"))
        assert executed.status_code == 200, executed.text
        assert executed.json()["status"] == "SUCCEEDED"
        readiness = c.get("/api/v1/finance/readiness", headers=h()).json()
        assert readiness["sandbox_ready"] is True
        assert readiness["secrets_exposed"] is False
