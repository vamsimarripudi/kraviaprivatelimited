"""Opt-in, once-only KRAVIA invitation reminder and expiry notifications.

Invitation token hashes are never rendered or recovered. The original
invitation already has its own transactional sender. This module sends only
a tokenless reminder or expiry update after opt-in and an explicit worker flag.
A provider timeout is UNKNOWN and is NEVER automatically retried.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import os
from uuid import uuid4

from sqlalchemy import select

from .auth_models import OfficeAuthInvite, OfficeAuthUser, OfficeInvitationNoticeDelivery
from .database import SessionLocal
from .email_delivery import (
    EmailDeliveryRejected, EmailDeliveryUnavailable, EmailDeliveryUnknown,
    send_office_invitation_status_notice,
)

logger = logging.getLogger(__name__)
DOMAIN = "@kraviaprivatelimited.com"
REMINDER_WINDOW = timedelta(hours=24)
REMINDER_MINIMUM = timedelta(minutes=15)
STALE_AFTER = timedelta(minutes=20)


def invitation_notices_enabled() -> bool:
    raw = os.getenv("KRAVIA_INVITATION_NOTICES_ENABLED", "false").strip().lower()
    if raw not in {"0", "1", "false", "true"}:
        raise RuntimeError("KRAVIA_INVITATION_NOTICES_ENABLED must be true or false")
    return raw in {"true", "1"}


def _corp(email: str) -> bool:
    value = email.strip().lower()
    return value.endswith(DOMAIN) and value.count("@") == 1


def _aware(at: datetime) -> datetime:
    return at if at.tzinfo is not None else at.replace(tzinfo=timezone.utc)


def _reservation(
    db, invite: OfficeAuthInvite, *, kind: str, recipient_kind: str,
    recipient_email: str, recipient_name: str, now: datetime,
) -> OfficeInvitationNoticeDelivery | None:
    if not _corp(recipient_email):
        return None
    existing = db.execute(
        select(OfficeInvitationNoticeDelivery.id).where(
            OfficeInvitationNoticeDelivery.invite_id == invite.id,
            OfficeInvitationNoticeDelivery.kind == kind,
            OfficeInvitationNoticeDelivery.recipient_kind == recipient_kind,
        )
    ).first()
    if existing:
        return None
    row = OfficeInvitationNoticeDelivery(
        id=str(uuid4()),
        invite_id=invite.id,
        kind=kind,
        recipient_kind=recipient_kind,
        recipient_email=recipient_email.strip().lower(),
        recipient_name=(recipient_name.strip() or "Colleague")[:160],
        status="SENDING",
        claim_token=str(uuid4()),
        claimed_at=now,
    )
    db.add(row)
    return row


def _is_current(db, invite: OfficeAuthInvite, *, kind: str, now: datetime) -> bool:
    if not invite.notice_opt_in or invite.revoked_at is not None:
        return False
    expires_at = _aware(invite.expires_at)
    if kind == "REMINDER":
        return invite.status == "PENDING" and now + REMINDER_MINIMUM < expires_at <= now + REMINDER_WINDOW
    if kind == "EXPIRED":
        newer = db.execute(
            select(OfficeAuthInvite.id).where(
                OfficeAuthInvite.email == invite.email,
                OfficeAuthInvite.id != invite.id,
                OfficeAuthInvite.created_at > invite.created_at,
                OfficeAuthInvite.status.in_(("PENDING", "ACCEPTED")),
            ).limit(1)
        ).first()
        return invite.status == "EXPIRED" and expires_at <= now and not newer
    return False


def _reserve_batch(limit: int, now: datetime) -> list[dict[str, str]]:
    claimed: list[dict[str, str]] = []
    with SessionLocal() as db:
        # If provider submission or finalisation previously failed, an
        # ambiguous submission is quarantined, not submitted again.
        stale = db.execute(
            select(OfficeInvitationNoticeDelivery)
            .where(
                OfficeInvitationNoticeDelivery.status == "SENDING",
                OfficeInvitationNoticeDelivery.claimed_at < now - STALE_AFTER,
            )
            .with_for_update(skip_locked=True)
        ).scalars().all()
        for row in stale:
            row.status = "UNKNOWN"
            row.finalized_at = now

        candidates = db.execute(
            select(OfficeAuthInvite).where(
                OfficeAuthInvite.notice_opt_in.is_(True),
                OfficeAuthInvite.status == "PENDING",
                OfficeAuthInvite.revoked_at.is_(None),
                OfficeAuthInvite.expires_at <= now + REMINDER_WINDOW,
            )
            .order_by(OfficeAuthInvite.expires_at, OfficeAuthInvite.id)
            .limit(max(1, min(limit, 25)))
            .with_for_update(skip_locked=True)
        ).scalars().all()

        for invite in candidates:
            if not _corp(invite.email):
                continue
            if _aware(invite.expires_at) <= now:
                # Expiry is recorded before any tokenless notification. The
                # registration endpoint independently checks expires_at too.
                invite.status = "EXPIRED"
                if not _is_current(db, invite, kind="EXPIRED", now=now):
                    continue
                people: list[tuple[str, str, str]] = [
                    ("INVITEE", invite.email, invite.display_name or "Colleague")
                ]
                inviter = db.get(OfficeAuthUser, invite.created_by)
                if inviter and inviter.status == "ACTIVE" and _corp(inviter.email):
                    people.append(("INVITER", inviter.email, inviter.display_name))
                for recipient_kind, email, name in people:
                    row = _reservation(
                        db, invite, kind="EXPIRED", recipient_kind=recipient_kind,
                        recipient_email=email, recipient_name=name, now=now,
                    )
                    if row:
                        claimed.append({
                            "id": row.id, "token": row.claim_token,
                            "kind": row.kind, "recipient_kind": row.recipient_kind,
                        })
            elif _is_current(db, invite, kind="REMINDER", now=now):
                row = _reservation(
                    db, invite, kind="REMINDER", recipient_kind="INVITEE",
                    recipient_email=invite.email,
                    recipient_name=invite.display_name or "Colleague", now=now,
                )
                if row:
                    claimed.append({
                        "id": row.id, "token": row.claim_token,
                        "kind": row.kind, "recipient_kind": row.recipient_kind,
                    })
        db.commit()  # Required before any provider submission.
    return claimed[:limit]


def _verify_claim(claim: dict[str, str], now: datetime) -> dict[str, object] | None:
    with SessionLocal() as db:
        row = db.get(OfficeInvitationNoticeDelivery, claim["id"])
        if not row or row.status != "SENDING" or row.claim_token != claim["token"]:
            return None
        invite = db.get(OfficeAuthInvite, row.invite_id)
        if not invite or not _is_current(db, invite, kind=row.kind, now=now):
            return None
        if row.recipient_kind == "INVITEE":
            if row.recipient_email != invite.email:
                return None
        elif row.recipient_kind == "INVITER":
            inviter = db.get(OfficeAuthUser, invite.created_by)
            if not inviter or inviter.status != "ACTIVE" or row.recipient_email != inviter.email:
                return None
        else:
            return None
        return {
            "recipient_email": row.recipient_email,
            "recipient_name": row.recipient_name,
            "invitee_name": invite.display_name or "Colleague",
            "kind": row.kind,
            "recipient_kind": row.recipient_kind,
            "hours_left": max(0, min(48, int((_aware(invite.expires_at) - now).total_seconds() / 3600))),
        }


def _finalize(claim: dict[str, str], status: str, provider_id: str | None) -> None:
    with SessionLocal() as db:
        row = db.get(OfficeInvitationNoticeDelivery, claim["id"])
        if not row or row.status != "SENDING" or row.claim_token != claim["token"]:
            raise RuntimeError("Invitation notice claim is no longer active")
        row.status = status
        row.provider_message_id = provider_id if status == "SENT" else None
        row.finalized_at = datetime.now(timezone.utc)
        db.commit()


def process_invitation_notices(limit: int = 10) -> dict[str, object]:
    if not invitation_notices_enabled():
        return {"status": "DISABLED", "claimed": 0}
    maximum = max(1, min(int(limit), 25))
    claims = _reserve_batch(maximum, datetime.now(timezone.utc))
    totals = {"accepted": 0, "rejected": 0, "unknown": 0, "skipped": 0, "finalization_failures": 0}
    for claim in claims:
        now = datetime.now(timezone.utc)
        details = _verify_claim(claim, now)
        if details is None:
            outcome, provider_id = "SKIPPED", None
        else:
            outcome, provider_id = "UNKNOWN", None
            try:
                provider_id = send_office_invitation_status_notice(
                    **details, delivery_id="office-invite-notice:" + claim["id"]
                )
                outcome = "SENT"
            except EmailDeliveryRejected:
                outcome = "REJECTED"
            except (EmailDeliveryUnavailable, EmailDeliveryUnknown):
                outcome = "UNKNOWN"
            except Exception as exc:
                logger.error("invitation notice provider outcome unknown error_type=%s", type(exc).__name__)
                outcome = "UNKNOWN"
        try:
            _finalize(claim, outcome, provider_id)
            totals[{"SENT":"accepted","REJECTED":"rejected","UNKNOWN":"unknown","SKIPPED":"skipped"}[outcome]] += 1
        except Exception as exc:
            totals["finalization_failures"] += 1
            logger.error("invitation notice finalisation blocked error_type=%s", type(exc).__name__)
    return {
        "status": "PROCESSED" if not totals["finalization_failures"] else "NEEDS_RECONCILIATION",
        "claimed": len(claims),
        **totals,
    }
