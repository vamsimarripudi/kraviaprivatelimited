"""Restricted, opt-in KRAVIA Office canonical lifecycle notification worker.

The database source triggers are committed with the business event, not
inferred from a later dashboard state. Every event kind starts disabled and
must be approved by the current Owner with an effective date. Missing mapping,
inactive recipients and prior records are filtered by the database.

A provider timeout remains UNKNOWN; it is never automatically resent.
The module has no effect with its default disabled feature flag.
"""
from __future__ import annotations

from dataclasses import dataclass
import logging
import os
import re
from typing import Any
from uuid import UUID

from sqlalchemy import text

from .database import SessionLocal
from .email_delivery import (
    EmailDeliveryRejected, EmailDeliveryUnknown, EmailDeliveryUnavailable,
    send_office_lifecycle_notification,
)

logger = logging.getLogger(__name__)
EVENT_CODE = re.compile(r"^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-[0-9]{2}$")
REFERENCE = re.compile(r"^office_[a-z_]+_events:[0-9]{1,18}$")


@dataclass(frozen=True)
class OfficeLifecycleClaim:
    outbox_id: UUID
    claim_token: UUID
    event_code: str
    recipient_email: str
    recipient_name: str
    source_reference: str


def _enabled() -> bool:
    setting = os.getenv("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED", "false").strip().lower()
    if setting in ("", "0", "false", "off", "no"):
        return False
    if setting in ("1", "true", "on", "yes"):
        return True
    raise RuntimeError("Invalid Office lifecycle mail flag")


def _validate_claim(row: Any) -> OfficeLifecycleClaim:
    data = dict(row)
    outbox = UUID(str(data["outbox_id"]))
    token = UUID(str(data["claim_token"]))
    code = str(data["event_code"])
    email = str(data["recipient_email"]).strip().lower()
    name = str(data["recipient_name"]).strip()
    reference = str(data["source_reference"])
    if (not EVENT_CODE.fullmatch(code)
            or not REFERENCE.fullmatch(reference)
            or not email.endswith("@kraviaprivatelimited.com")
            or email.count("@") != 1
            or not 1 <= len(name) <= 160
            or any(ord(c) < 32 for c in name)):
        raise RuntimeError("Canonical Office lifecycle claim is invalid")
    return OfficeLifecycleClaim(outbox, token, code, email, name, reference)


def process_office_lifecycle_mail_outbox(limit: int = 10) -> dict[str, Any]:
    """No arbitrary messages, retries, secrets or synthetic success metrics."""
    if not _enabled():
        return {"status": "DISABLED", "claimed": 0}
    if not os.getenv("BREVO_API_KEY", "").strip():
        return {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0}
    maximum = max(1, min(int(limit), 25))
    with SessionLocal() as db:
        rows = db.execute(
            text("select outbox_id,claim_token,event_code,recipient_email,"
                 "recipient_name,source_reference from public.office_lifecycle_mail_claim(:p_limit)"),
            {"p_limit": maximum},
        ).mappings().all()
        claims = [_validate_claim(row) for row in rows]
        # Commit locks and the pending -> sending transition before Brevo I/O.
        db.commit()

    counts = {"accepted": 0, "rejected": 0, "unknown": 0, "finalization_failures": 0}
    for claim in claims:
        outcome, message_id = "UNKNOWN", None
        try:
            message_id = send_office_lifecycle_notification(
                recipient_email=claim.recipient_email,
                recipient_name=claim.recipient_name,
                event_code=claim.event_code,
                event_reference=claim.source_reference,
                delivery_id=str(claim.outbox_id),
            )
            outcome = "SENT"  # Provider accepted, not recipient inbox confirmation
        except EmailDeliveryRejected:
            outcome = "REJECTED"
        except (EmailDeliveryUnknown, EmailDeliveryUnavailable):
            outcome = "UNKNOWN"
        except Exception as exc:
            # Generic errors may occur after provider acceptance. Never resend.
            logger.error("lifecycle-mail outcome unknown error_type=%s", type(exc).__name__)
            outcome = "UNKNOWN"

        try:
            with SessionLocal() as db:
                db.execute(
                    text("select public.office_lifecycle_mail_finish("
                         "cast(:outbox_id as uuid),cast(:claim_token as uuid),"
                         ":outcome,:message_id)"),
                    {
                        "outbox_id": str(claim.outbox_id),
                        "claim_token": str(claim.claim_token),
                        "outcome": outcome,
                        "message_id": message_id,
                    },
                )
                db.commit()
            counts[{"SENT": "accepted", "REJECTED": "rejected", "UNKNOWN": "unknown"}[outcome]] += 1
        except Exception as exc:
            # Stale claims are transitioned to UNKNOWN at the next database
            # claim run; neither the worker nor a UI can retry automatically.
            counts["finalization_failures"] += 1
            logger.error("lifecycle-mail finalization failed error_type=%s", type(exc).__name__)
    return {
        "status": "PROCESSED" if not counts["finalization_failures"] else "NEEDS_RECONCILIATION",
        "claimed": len(claims),
        **counts,
    }
