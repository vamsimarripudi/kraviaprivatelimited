"""Verified Office employee-ID outbox delivery through the existing Brevo service.

This worker does not process candidate, welcome, payroll or other proposed
lifecycle notifications. Those require their own committed event mappings.

No email can be sent merely by installing this module:
- KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED defaults to false.
- BREVO_API_KEY must exist on the worker.
- The restricted SQL claim RPC enforces Owner's effective-dated approval,
  independently VERIFIED onboarding, active employment and exact registered
  recipient. The claim is committed before any external provider call.
- Provider timeouts/uncertain acknowledgments are marked UNKNOWN, never
  automatically retried or fabricated as DELIVERED.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import text

from .database import SessionLocal
from .email_delivery import (
    EmailDeliveryRejected, EmailDeliveryUnknown, EmailDeliveryUnavailable,
    send_office_employee_id_issued_email,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ApprovedMailClaim:
    outbox_id: UUID
    claim_token: UUID
    recipient_email: str
    reference_code: str
    recipient_name: str


def _dispatch_enabled() -> bool:
    value = os.getenv("KRAVIA_EMPLOYEE_MAIL_DISPATCH_ENABLED", "false").strip().lower()
    if value in {"", "0", "false", "off", "no"}:
        return False
    if value in {"1", "true", "on", "yes"}:
        return True
    raise RuntimeError("Invalid employee-mail dispatch feature flag")


def _valid_claim(value: Any) -> ApprovedMailClaim:
    row = dict(value)
    outbox_id, claim_token = UUID(str(row["outbox_id"])), UUID(str(row["claim_token"]))
    email = str(row["recipient_email"]).strip().lower()
    code = str(row["reference_code"]).strip()
    name = str(row["recipient_name"]).strip() or "Colleague"
    if (not email.endswith("@kraviaprivatelimited.com") or
        not email.count("@") == 1 or
        not code.startswith("KRV-E") or
        not 1 <= len(name) <= 160):
        raise RuntimeError("Invalid independently approved employee mail claim")
    return ApprovedMailClaim(outbox_id, claim_token, email, code, name)


def process_employee_mail_outbox(limit: int = 10) -> dict[str, Any]:
    """Process at most 25 real, approved notifications; return PII-free stats."""
    if not _dispatch_enabled():
        return {"status": "DISABLED", "claimed": 0}
    if not os.getenv("BREVO_API_KEY", "").strip():
        return {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0}
    max_batch = max(1, min(int(limit), 25))
    with SessionLocal() as db:
        claims = db.execute(
            text("select outbox_id,claim_token,recipient_email,reference_code,recipient_name "
                 "from public.office_employee_mail_claim(:p_limit)"),
            {"p_limit": max_batch},
        ).mappings().all()
        verified = [_valid_claim(row) for row in claims]
        # A committed claim permanently prevents duplicate delivery by other
        # workers, browser refresh, or parallel cron execution.
        db.commit()

    counts = {"accepted": 0, "rejected": 0, "unknown": 0, "finalization_failures": 0}
    for claim in verified:
        outcome, provider_id = "UNKNOWN", None
        try:
            provider_id = send_office_employee_id_issued_email(
                recipient_email=claim.recipient_email,
                recipient_name=claim.recipient_name,
                employee_reference=claim.reference_code,
                delivery_id=str(claim.outbox_id),
            )
            outcome = "SENT"  # Brevo accepted the message, not mailbox delivery
        except EmailDeliveryRejected:
            outcome = "REJECTED"
        except (EmailDeliveryUnknown, EmailDeliveryUnavailable):
            outcome = "UNKNOWN"
        except Exception as exc:
            # Unknown exceptions must never become automatic retry. They may
            # occur after a provider has accepted a request.
            logger.error("employee-mail delivery unconfirmed error_type=%s", type(exc).__name__)
            outcome = "UNKNOWN"

        try:
            with SessionLocal() as db:
                db.execute(
                    text("select public.office_employee_mail_finish("
                         "cast(:outbox_id as uuid),cast(:claim_token as uuid),"
                         ":outcome,:provider_id)"),
                    {
                        "outbox_id": str(claim.outbox_id),
                        "claim_token": str(claim.claim_token),
                        "outcome": outcome,
                        "provider_id": provider_id,
                    },
                )
                db.commit()
            counts[{"SENT":"accepted","REJECTED":"rejected","UNKNOWN":"unknown"}[outcome]] += 1
        except Exception as exc:
            counts["finalization_failures"] += 1
            # A stale SENDING claim becomes UNKNOWN in SQL. It must not be
            # reacquired or automatically sent a second time.
            logger.error("employee-mail finalization blocked error_type=%s", type(exc).__name__)
    return {
        "status": "PROCESSED" if not counts["finalization_failures"] else "NEEDS_RECONCILIATION",
        "claimed": len(verified),
        **counts,
    }
