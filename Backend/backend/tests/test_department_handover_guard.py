"""Real guard-behaviour tests for permanent Finance handover at the FastAPI boundary."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.main import require_roles, require_approval_department_write


class FakeDatabase:
    def __init__(self, verdict="DENY"):
        self.verdict = verdict
        self.calls = 0

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

    def execute(self, statement, parameters):
        self.calls += 1
        assert "office_department_permission_verdict" in str(statement)
        assert "." in parameters["permission"]
        return SimpleNamespace(scalar_one=lambda: self.verdict)


def request(method="POST", path="/api/v1/invoices"):
    return Request({"type": "http", "method": method, "path": path,
                    "query_string": b"", "headers": [], "scheme": "https",
                    "server": ("kravia.test", 443)})


def actor():
    return {"roles": {"OWNER"}, "auth_mode": "first_party",
            "user_id": "cfb1065b-56ba-4a19-81b3-b63cd32e53e3"}


@pytest.mark.parametrize("endpoint", [
    "/api/v1/invoices", "/api/v1/banking/accounts",
    "/api/v1/finance/expenses", "/api/v1/ownership/share-classes",
    "/api/v1/payments/example/refunds",
    "/api/v1/products", "/api/v1/customers",
    "/api/v1/commercial/plans", "/api/v1/people",
])
def test_former_owner_cannot_write_direct_to_finance_api(endpoint):
    db = FakeDatabase()
    with pytest.raises(HTTPException) as caught:
        require_roles("OWNER")(request("POST", endpoint), actor(), db)
    assert caught.value.status_code == 403
    assert db.calls == 1


@pytest.mark.parametrize("verdict", ["DEFAULT", "DEPARTMENT_OWNER"])
def test_permitted_finance_actor_passes_existing_role_check(verdict):
    db = FakeDatabase(verdict)
    user = actor()
    assert require_roles("OWNER")(request(), user, db) is user


def test_former_owner_can_still_read_finance_records():
    db = FakeDatabase("DENY")
    user = actor()
    assert require_roles("OWNER")(request("GET"), user, db) is user
    assert db.calls == 0


def test_other_workspace_mutations_not_blocked_by_finance_handover():
    db = FakeDatabase("DENY")
    user = actor()
    assert require_roles("OWNER")(request("POST", "/api/v1/approvals"), user, db) is user
    assert db.calls == 0


def test_unknown_permission_verdict_fails_closed():
    db = FakeDatabase("UNKNOWN")
    with pytest.raises(HTTPException) as caught:
        require_roles("OWNER")(request(), actor(), db)
    assert caught.value.status_code == 503

@pytest.mark.parametrize("kind", [
    "funding_policy", "expense", "payment_instruction", "share_change",
    "share_transfer", "salary_batch", "payroll_run", "compensation",
])
def test_generic_approval_cannot_restore_transferred_finance_rights(kind):
    db = FakeDatabase("DENY")
    with pytest.raises(HTTPException) as caught:
        require_approval_department_write(actor(), db, kind)
    assert caught.value.status_code == 403
    assert db.calls == 1


def test_unrelated_approval_keeps_original_maker_checker_rules():
    db = FakeDatabase("DENY")
    require_approval_department_write(actor(), db, "company_policy")
    assert db.calls == 0


@pytest.mark.parametrize("auth_mode", ["oidc", "bootstrap"])
def test_alternate_auth_modes_cannot_skip_postgres_handover(auth_mode):
    db = FakeDatabase("DEFAULT")
    external = {**actor(), "auth_mode": auth_mode}
    with pytest.raises(HTTPException) as caught:
        require_roles("OWNER")(request("POST", "/api/v1/invoices"), external, db)
    assert caught.value.status_code == 403
    assert db.calls == 0
