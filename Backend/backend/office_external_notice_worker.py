"""Source-verified external lifecycle notices with two independent send gates.

ONB-04 uses the active employee's corporate mailbox, but never emails provider
signing tokens. EXIT-02/04/05/06/07/08 use only independently owner-verified,
unexpired personal consent; revoked corporate mailboxes are never reused.
No automatic retries for provider-unknown outcomes. Disabled by default.
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
    EmailDeliveryRejected,
    EmailDeliveryUnknown,
    EmailDeliveryUnavailable,
    send_office_external_lifecycle_notification,
)

logger = logging.getLogger(__name__)
_CODES = frozenset({
    "ONB-04", "EXIT-02", "EXIT-04", "EXIT-05",
    "EXIT-06", "EXIT-07", "EXIT-08",
})
_SOURCE = {
    "ONB-04": "ONBOARDING_SIGNING",
    "EXIT-02": "EXIT_NOTIFICATION", "EXIT-04": "EXIT_NOTIFICATION",
    "EXIT-05": "EXIT_SETTLEMENT", "EXIT-06": "EXIT_SETTLEMENT",
    "EXIT-07": "EXIT_DOCUMENT", "EXIT-08": "EXIT_COMPLETION",
}
_REF = re.compile(
    r"^(?:ONBOARDING_SIGNING|EXIT_NOTIFICATION|EXIT_SETTLEMENT|"
    r"EXIT_DOCUMENT|EXIT_COMPLETION):[1-9][0-9]{0,17}$"
)
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$")


@dataclass(frozen=True)
class ExternalNoticeClaim:
    outbox_id: UUID
    claim_token: UUID
    event_code: str
    recipient_email: str
    recipient_name: str
    source_reference: str


def _flag(name: str) -> bool:
    raw = os.getenv(name, "false").strip().lower()
    if raw in ("", "0", "false", "off", "no"):
        return False
    if raw in ("1", "true", "on", "yes"):
        return True
    raise RuntimeError("Invalid boolean external lifecycle flag")


def external_notice_enabled() -> bool:
    # Employee lifecycle dispatch alone is insufficient to contact former
    # employees or signatories: the external boundary needs a second opt-in.
    return (_flag("KRAVIA_LIFECYCLE_MAIL_DISPATCH_ENABLED")
            and _flag("KRAVIA_EXTERNAL_LIFECYCLE_MAIL_DISPATCH_ENABLED"))


def validate_external_claim(row: Any) -> ExternalNoticeClaim:
    item = dict(row)
    code = str(item["event_code"])
    address = str(item["recipient_email"]).strip().lower()
    name = str(item["recipient_name"]).strip()
    reference = str(item["source_reference"])
    domain = address.rpartition("@")[2]
    if (code not in _CODES
            or len(address) > 320 or not _EMAIL.fullmatch(address)
            or not 1 <= len(name) <= 160
            or any(ord(ch) < 32 or ord(ch) == 127 for ch in name)
            or not _REF.fullmatch(reference)
            or not reference.startswith(_SOURCE.get(code, "INVALID") + ":")
            or (code == "ONB-04" and domain != "kraviaprivatelimited.com")
            or (code.startswith("EXIT-") and domain == "kraviaprivatelimited.com")):
        raise RuntimeError("Unverified external lifecycle notice claim")
    return ExternalNoticeClaim(
        outbox_id=UUID(str(item["outbox_id"])),
        claim_token=UUID(str(item["claim_token"])),
        event_code=code,
        recipient_email=address,
        recipient_name=name,
        source_reference=reference,
    )


def process_external_notice_outbox(limit: int = 10) -> dict[str, Any]:
    if not external_notice_enabled():
        return {"status": "DISABLED", "claimed": 0}
    if not os.getenv("BREVO_API_KEY", "").strip():
        return {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0}
    maximum = max(1, min(int(limit), 25))
    with SessionLocal() as db:
        rows = db.execute(
            text("SELECT outbox_id,claim_token,event_code,recipient_email,"
                 "recipient_name,source_reference "
                 "FROM public.office_external_notice_claim(:p_limit)"),
            {"p_limit": maximum},
        ).mappings().all()
        claims = [validate_external_claim(row) for row in rows]
        db.commit()  # durable SENDING before any network I/O

    totals = {"accepted": 0, "rejected": 0, "unknown": 0, "finalization_failures": 0}
    for claim in claims:
        outcome, provider_id = "UNKNOWN", None
        try:
            # A consent revocation between claim and submission must block mail.
            with SessionLocal() as db:
                is_allowed = bool(db.execute(
                    text("SELECT public.office_external_notice_can_send("
                         "cast(:p_id AS uuid),cast(:p_token AS uuid))"),
                    {"p_id": str(claim.outbox_id), "p_token": str(claim.claim_token)},
                ).scalar_one())
                db.rollback()
            if not is_allowed:
                outcome = "REJECTED"
            else:
                provider_id = send_office_external_lifecycle_notification(
                    recipient_email=claim.recipient_email,
                    recipient_name=claim.recipient_name,
                    event_code=claim.event_code,
                    event_reference=claim.source_reference,
                    delivery_id=str(claim.outbox_id),
                )
                outcome = "SENT"  # provider acceptance, not mailbox delivery
        except EmailDeliveryRejected:
            outcome = "REJECTED"
        except (EmailDeliveryUnknown, EmailDeliveryUnavailable):
            outcome = "UNKNOWN"
        except Exception as exc:
            logger.error("external_notice_unknown error_type=%s", type(exc).__name__)
            outcome = "UNKNOWN"

        try:
            with SessionLocal() as db:
                db.execute(
                    text("SELECT public.office_external_notice_finish("
                         "cast(:p_id AS uuid),cast(:p_token AS uuid),"
                         ":p_status,:p_provider)"),
                    {
                        "p_id": str(claim.outbox_id),
                        "p_token": str(claim.claim_token),
                        "p_status": outcome,
                        "p_provider": provider_id,
                    },
                )
                db.commit()
            totals[{"SENT": "accepted", "REJECTED": "rejected", "UNKNOWN": "unknown"}[outcome]] += 1
        except Exception as exc:
            totals["finalization_failures"] += 1
            logger.error("external_notice_finalize_failed error_type=%s", type(exc).__name__)
    return {
        "status": "PROCESSED" if not totals["finalization_failures"] else "NEEDS_RECONCILIATION",
        "claimed": len(claims),
        **totals,
    }
