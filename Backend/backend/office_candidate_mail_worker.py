"""Private external-candidate mail worker, isolated from employee notifications.

Candidate email is allowed only when independently verified consent, canonical
hiring-event evidence, current-address matching, and an Owner-enabled per-event
policy all pass inside the database claim function. Disabled by default.
Provider-unknown outcomes must NEVER be retried automatically.
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
    EmailDeliveryRejected,
    EmailDeliveryUnknown,
    EmailDeliveryUnavailable,
    send_office_candidate_lifecycle_notification,
)

logger = logging.getLogger(__name__)
CANDIDATE_CODES = frozenset({
    "HIRE-01", "HIRE-02", "HIRE-03", "HIRE-04", "HIRE-05",
    "HIRE-06", "HIRE-08", "HIRE-09", "HIRE-10",
})
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$")
SOURCE_REFERENCE = re.compile(r"^KR-CAN-[0-9]{7,20}:[1-9][0-9]{0,17}$")


@dataclass(frozen=True)
class CandidateMailClaim:
    outbox_id: UUID
    claim_token: UUID
    event_code: str
    recipient_email: str
    recipient_name: str
    source_reference: str
    interview_time: datetime | None = None


def _flag(name: str) -> bool:
    raw = os.getenv(name, "false").strip().lower()
    if raw in ("", "0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    raise RuntimeError("Invalid boolean flag for candidate mail")


def candidate_mail_enabled() -> bool:
    # Two separate opt-ins: enabling internal employee lifecycle notices must
    # never silently enable communications to external applicants.
    return _flag("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED") and _flag(
        "KRAVIA_CANDIDATE_MAIL_DISPATCH_ENABLED"
    )


def validate_claim(row: Any) -> CandidateMailClaim:
    item = dict(row)
    kind = str(item["event_code"])
    email = str(item["recipient_email"]).strip().lower()
    name = str(item["recipient_name"]).strip()
    source = str(item["source_reference"])
    timing = item.get("interview_time")
    if kind not in CANDIDATE_CODES:
        raise RuntimeError("Unsupported candidate lifecycle event")
    if (len(email) > 320 or not EMAIL.fullmatch(email)
            or len(name) < 2 or len(name) > 220
            or any(ord(c) < 32 for c in name)
            or not SOURCE_REFERENCE.fullmatch(source)):
        raise RuntimeError("Invalid candidate lifecycle claim")
    if timing is not None and (not isinstance(timing, datetime) or timing.tzinfo is None):
        raise RuntimeError("Candidate interview time must include timezone")
    if kind in ("HIRE-02", "HIRE-03") and timing is None:
        raise RuntimeError("Verified interview time missing")
    if kind not in ("HIRE-02", "HIRE-03") and timing is not None:
        raise RuntimeError("Unexpected interview time in candidate notice")
    return CandidateMailClaim(
        outbox_id=UUID(str(item["outbox_id"])),
        claim_token=UUID(str(item["claim_token"])),
        event_code=kind,
        recipient_email=email,
        recipient_name=name,
        source_reference=source,
        interview_time=timing,
    )


def _interview_time_label(when: datetime | None) -> str | None:
    if when is None:
        return None
    return when.astimezone(ZoneInfo("Asia/Kolkata")).strftime(
        "%d %B %Y at %I:%M %p IST"
    )


def process_candidate_mail_outbox(limit: int = 10) -> dict[str, Any]:
    if not candidate_mail_enabled():
        return {"status": "DISABLED", "claimed": 0}
    if not os.getenv("BREVO_API_KEY", "").strip():
        return {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0}
    maximum = max(1, min(int(limit), 25))
    with SessionLocal() as db:
        rows = db.execute(
            text("SELECT outbox_id,claim_token,event_code,recipient_email,"
                 "recipient_name,source_reference,interview_time "
                 "FROM public.office_candidate_mail_claim(:p_limit)"),
            {"p_limit": maximum},
        ).mappings().all()
        claims = [validate_claim(row) for row in rows]
        # Durable claim and SOURCE_VERIFIED -> SENDING transition before I/O.
        db.commit()

    totals = {"accepted": 0, "rejected": 0, "unknown": 0, "finalization_failures": 0}
    for claim in claims:
        outcome, message_id = "UNKNOWN", None
        try:
            message_id = send_office_candidate_lifecycle_notification(
                recipient_email=claim.recipient_email,
                recipient_name=claim.recipient_name,
                event_code=claim.event_code,
                delivery_id=str(claim.outbox_id),
                interview_time=_interview_time_label(claim.interview_time),
            )
            outcome = "SENT"  # Provider accepted; not proof of inbox delivery.
        except EmailDeliveryRejected:
            outcome = "REJECTED"
        except (EmailDeliveryUnknown, EmailDeliveryUnavailable):
            outcome = "UNKNOWN"
        except Exception as exc:
            logger.error("office_candidate_mail_outcome_unknown error_type=%s", type(exc).__name__)
            outcome = "UNKNOWN"

        try:
            with SessionLocal() as db:
                db.execute(
                    text("SELECT public.office_candidate_mail_finish("
                         "cast(:outbox_id AS uuid),cast(:claim_token AS uuid),"
                         ":outcome,:message_id)"),
                    {
                        "outbox_id": str(claim.outbox_id),
                        "claim_token": str(claim.claim_token),
                        "outcome": outcome,
                        "message_id": message_id,
                    },
                )
                db.commit()
            totals[{"SENT": "accepted", "REJECTED": "rejected", "UNKNOWN": "unknown"}[outcome]] += 1
        except Exception as exc:
            totals["finalization_failures"] += 1
            logger.error("office_candidate_mail_finalize_failed error_type=%s", type(exc).__name__)
    return {
        "status": "PROCESSED" if totals["finalization_failures"] == 0 else "NEEDS_RECONCILIATION",
        "claimed": len(claims),
        **totals,
    }
