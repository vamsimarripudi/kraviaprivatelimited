"""Synthetic, provider-free tests for canonical lifecycle mail orchestration."""
from __future__ import annotations

from uuid import UUID

import pytest

from backend import office_lifecycle_mail_worker as mail
from backend.email_delivery import EmailDeliveryRejected, EmailDeliveryUnknown


class _Rows:
    def __init__(self, rows):
        self.rows = rows
    def mappings(self):
        return self
    def all(self):
        return list(self.rows)


class _Session:
    def __init__(self, factory):
        self.factory = factory
    def __enter__(self):
        return self
    def __exit__(self, *_):
        return False
    def execute(self, statement, params):
        statement = str(statement)
        self.factory.queries.append((statement,dict(params)))
        if "office_lifecycle_mail_claim" in statement:
            return _Rows(self.factory.claims)
        if "office_lifecycle_mail_finish" in statement:
            return _Rows([])
        raise AssertionError("Unexpected Office mail SQL")
    def commit(self):
        self.factory.commits += 1


class _Factory:
    def __init__(self, claims):
        self.claims = claims
        self.commits = 0
        self.queries = []
    def __call__(self):
        return _Session(self)


def _synthetic_claim():
    return [{
        "outbox_id":UUID("11000000-0000-4000-8000-000000000001"),
        "claim_token":UUID("22000000-0000-4000-8000-000000000001"),
        "event_code":"ONB-05",
        "recipient_email":"synthetic.staff@kraviaprivatelimited.com",
        "recipient_name":"Synthetic Staff",
        "source_reference":"office_employee_intake_events:401",
        "pay_period":None,
    }]


def test_lifecycle_dispatch_is_off_without_explicit_worker_settings(monkeypatch):
    monkeypatch.delenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED",raising=False)
    monkeypatch.delenv("BREVO_API_KEY",raising=False)
    assert mail.process_office_lifecycle_mail_outbox() == {"status":"DISABLED","claimed":0}
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED","true")
    assert mail.process_office_lifecycle_mail_outbox() == {"status":"PROVIDER_NOT_CONFIGURED","claimed":0}
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED","unexpected")
    with pytest.raises(RuntimeError):
        mail.process_office_lifecycle_mail_outbox()


@pytest.mark.parametrize("provider_result,outcome,count_field",[
    ("ci-provider-id","SENT","accepted"),
    (EmailDeliveryRejected("Rejected"),"REJECTED","rejected"),
    (EmailDeliveryUnknown("Unknown"),"UNKNOWN","unknown"),
])
def test_claim_commit_precedes_provider_and_unknown_is_not_retried(
    monkeypatch, provider_result, outcome, count_field,
):
    monkeypatch.setenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED","true")
    monkeypatch.setenv("BREVO_API_KEY","synthetic-ci-key-not-used")
    db=_Factory(_synthetic_claim())
    monkeypatch.setattr(mail,"SessionLocal",db)
    deliveries=[]

    def fake_send(**kwargs):
        assert db.commits==1, "Provider submission must start after a committed claim"
        deliveries.append(kwargs)
        if isinstance(provider_result,Exception):
            raise provider_result
        return provider_result

    monkeypatch.setattr(mail,"send_office_lifecycle_notification",fake_send)
    result=mail.process_office_lifecycle_mail_outbox(3)
    assert result["status"]=="PROCESSED"
    assert result["claimed"]==1
    assert result[count_field]==1
    assert result["finalization_failures"]==0
    assert db.commits==2
    assert len(deliveries)==1
    assert deliveries[0]["delivery_id"]=="11000000-0000-4000-8000-000000000001"
    assert deliveries[0]["event_code"]=="ONB-05"
    assert len(db.queries)==2
    assert db.queries[1][1]["outcome"]==outcome
    assert "synthetic.staff@" not in str(result)


@pytest.mark.parametrize("changed",[
    {"recipient_email":"outside@example.com"},
    {"event_code":"UNKNOWN-99"},
    {"recipient_name":"Bad\r\nBcc:mail@example.com"},
    {"source_reference":"https://untrusted.example.com"},
])
def test_worker_rejects_unverified_recipient_and_event_claims(changed):
    candidate=dict(_synthetic_claim()[0],**changed)
    with pytest.raises(RuntimeError):
        mail._validate_claim(candidate)


def test_locked_salary_slip_claim_requires_real_payroll_period():
    claim=dict(_synthetic_claim()[0],event_code="PAY-06",
               source_reference="office_payroll_events:42",pay_period="2026-11")
    result=mail._validate_claim(claim)
    assert result.pay_period=="2026-11"
    with pytest.raises(RuntimeError):
        mail._validate_claim(dict(claim,pay_period=None))


def test_full_verified_bank_credit_requires_real_period_in_worker_claim():
    claim=dict(_synthetic_claim()[0],event_code="PAY-08",
               source_reference="office_payroll_events:170",pay_period="2026-11")
    assert mail._validate_claim(claim).pay_period=="2026-11"
    with pytest.raises(RuntimeError):
        mail._validate_claim(dict(claim,pay_period=None))


def test_verified_partial_wage_claim_requires_real_pay_period():
    claim = dict(_synthetic_claim()[0], event_code="PAY-09",
                 source_reference="office_payroll_events:43", pay_period="2026-11")
    assert mail._validate_claim(claim).pay_period == "2026-11"
    with pytest.raises(RuntimeError):
        mail._validate_claim(dict(claim,pay_period=None))


def test_private_immutable_source_references_are_accepted_and_arbitrary_tables_rejected():
    from backend import office_lifecycle_mail_worker as worker

    for table in (
        "office_auth_events", "office_worktime_events", "office_asset_events",
        "office_access_audit", "office_lifecycle_auth_signals",
        "office_lifecycle_aux_proofs",
    ):
        assert worker.REFERENCE.fullmatch(f"{table}:123"), table

    for table in (
        "office_identity_users", "office_auth_users", "office_lifecycle_mail_outbox",
        "public.office_access_audit", "office_lifecycle_aux_proofs;DROP TABLE",
    ):
        assert worker.REFERENCE.fullmatch(f"{table}:123") is None, table
