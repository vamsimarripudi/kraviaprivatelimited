"""Opt-in external candidate notification worker for governed KRAVIA hiring.

Not an employee-mail fallback: candidate recipients require an Owner-attested
candidate-provided address and an independently enabled per-event policy.
No sending without BOTH worker flags. No retries after unknown outcomes.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import logging
import os
import re
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import text

from .database import SessionLocal
from .email_delivery import (
    EmailDeliveryRejected, EmailDeliveryUnknown, EmailDeliveryUnavailable,
    send_office_candidate_lifecycle_notification,
)

logger = logging.getLogger(__name__)

CANDIDATE_CODES = frozenset({
    "HIRE-01", "HIRE-02", "HIRE-03", "HIRE-04",
    "HIRE-05", "HIRE-06", "HIRE-09", "HIRE-10",
})
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$")
SOURCE_REFERENCE = re.compile(r"^office_recruitment_events:[1-9][0-9]{0,17}$")


@dataclass(frozen=True)
class CandidateMailClaim:
    outbox_id: UUID
    claim_token: UUID
    event_code: str
    recipient_email: str
    recipient_name: str
    source_reference: str
    scheduled_at: datetime | None = None


def _flag(name: str) -> bool:
    raw = os.getenv(name, "false").strip().lower()
    if raw in {"false", "0", "no", "off", ""}:
        return False
    if raw in {"true", "1", "yes", "on"}:
        return True
    raise RuntimeError(f"Invalid boolean flag {name}")


def enabled() -> bool:
    # Candidate dispatch never starts simply because the employee lifecycle
    # mail switch was enabled. A separate explicit approval is mandatory.
    return _flag("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED") and _flag(
        "KRAVIA_CANDIDATE_LIFECYCLE_MAIL_DISPATCH_ENABLED"
    )


def validate_candidate_claim(row: Any) -> CandidateMailClaim:
    record = dict(row)
    code = str(record["event_code"])
    email = str(record["recipient_email"]).strip().lower()
    name = str(record["recipient_name"]).strip()
    ref = str(record["source_reference"])
    schedule = record.get("scheduled_at")

    if code not in CANDIDATE_CODES:
        raise RuntimeError("Unapproved candidate event kind")
    if (not 5 <= len(email) <= 320 or not EMAIL.fullmatch(email)
            or len(name) < 2 or len(name) > 220
            or any(ord(x) < 32 for x in name)
            or not SOURCE_REFERENCE.fullmatch(ref)):
        raise RuntimeError("Candidate delivery record is invalid")
    if schedule is not None and (not isinstance(schedule, datetime)
                                 or schedule.tzinfo is None):
        raise RuntimeError("Interview date must be timezone aware")
    if code in {"HIRE-02", "HIRE-03"} and schedule is None:
        raise RuntimeError("Verified interview date is required")

    return CandidateMailClaim(
        outbox_id=UUID(str(record["outbox_id"])),
        claim_token=UUID(str(record["claim_token"])),
        event_code=code,
        recipient_email=email,
        recipient_name=name,
        source_reference=ref,
        scheduled_at=schedule,
    )


def _schedule_label(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(ZoneInfo("Asia/Kolkata")).strftime(
        "%d %B %Y at %I:%M %p IST"
    )


def process_candidate_lifecycle_mail_outbox(limit: int = 10) -> dict[str, Any]:
    if not enabled():
        return {"status": "DISABLED", "claimed": 0}
    if not os.getenv("BREVO_API_KEY", "").strip():
        return {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0}

    maximum = max(1, min(int(limit), 25))
    with SessionLocal() as db:
        rows = db.execute(text(
            "SELECT outbox_id,claim_token,event_code,recipient_email,"
            "recipient_name,source_reference,scheduled_at "
            "FROM public.office_candidate_lifecycle_claim(:p_limit)"
        ), {"p_limit": maximum}).mappings().all()
        claims = [validate_candidate_claim(row) for row in rows]
        db.commit()  # durable claim before provider I/O

    totals = {"accepted": 0, "rejected": 0, "unknown": 0, "finalization_failures": 0}
    for claim in claims:
        result, message_id = "UNKNOWN", None
        try:
            message_id = send_office_candidate_lifecycle_notification(
                recipient_email=claim.recipient_email,
                recipient_name=claim.recipient_name,
                event_code=claim.event_code,
                event_reference=claim.source_reference,
                delivery_id=str(claim.outbox_id),
                interview_time=_schedule_label(claim.scheduled_at),
            )
            result = "SENT"  # provider accepted, inbox receipt not guaranteed
        except EmailDeliveryRejected:
            result = "REJECTED"
        except (EmailDeliveryUnavailable, EmailDeliveryUnknown):
            result = "UNKNOWN"
        except Exception as exc:
            logger.error("candidate_mail_provider_outcome_unknown type=%s", type(exc).__name__)
            result = "UNKNOWN"
        try:
            with SessionLocal() as db:
                db.execute(text(
                    "SELECT public.office_candidate_lifecycle_finish("
                    "cast(:outbox_id as uuid),cast(:claim_token as uuid),"
                    ":result,:message_id)"
                ), {
                    "outbox_id": str(claim.outbox_id),
                    "claim_token": str(claim.claim_token),
                    "result": result,
                    "message_id": message_id,
                })
                db.commit()
            totals[{"SENT": "accepted", "REJECTED": "rejected", "UNKNOWN": "unknown"}[result]] += 1
        except Exception as exc:
            totals["finalization_failures"] += 1
            logger.error("candidate_mail_finalization_error type=%s", type(exc).__name__)
    return {
        "status": "PROCESSED" if not totals["finalization_failures"] else "NEEDS_RECONCILIATION",
        "claimed": len(claims),
        **totals,
    }
