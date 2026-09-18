"""Audit retention and archival-readiness controls for KRAVIA Office.

This module deliberately provides no purge/delete endpoint. The audit chain is
hash-linked; retention therefore stages immutable archive manifests and legal
holds while remaining fail-closed until a verified external archive sink exists.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Callable, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    ApprovalRequest,
    AuditArchiveManifest,
    AuditEvent,
    AuditLegalHold,
    AuditRetentionPolicy,
)
from .services import audit, emit_event, now_utc, uid

HOLD_SCOPES = {"GLOBAL", "ENTITY", "ACTOR", "CORRELATION", "EVENT_TYPE"}


class RetentionPolicyCreate(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    retention_days: int = Field(ge=30, le=36500)
    archive_sink: Optional[str] = Field(default=None, max_length=120)
    archive_sink_reference: Optional[str] = Field(default=None, max_length=500)


class HoldCreate(BaseModel):
    scope_type: Literal["GLOBAL", "ENTITY", "ACTOR", "CORRELATION", "EVENT_TYPE"]
    scope_value: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=3, max_length=2000)


class DecisionNote(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=2000)


def _policy_json(row: AuditRetentionPolicy) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "retention_days": row.retention_days,
        "status": row.status,
        "archive_sink": row.archive_sink,
        "archive_sink_reference": row.archive_sink_reference,
        "archive_sink_verified": bool(row.archive_sink_verified_at),
        "archive_sink_verified_at": row.archive_sink_verified_at.isoformat() if row.archive_sink_verified_at else None,
        "approved_by": row.approved_by,
        "approved_at": row.approved_at.isoformat() if row.approved_at else None,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _hold_json(row: AuditLegalHold) -> dict:
    return {
        "id": row.id,
        "scope_type": row.scope_type,
        "scope_value": row.scope_value,
        "reason": row.reason,
        "status": row.status,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "released_by": row.released_by,
        "released_at": row.released_at.isoformat() if row.released_at else None,
    }


def _manifest_json(row: AuditArchiveManifest) -> dict:
    return {
        "id": row.id,
        "policy_id": row.policy_id,
        "cutoff_at": row.cutoff_at.isoformat(),
        "first_event_id": row.first_event_id,
        "last_event_id": row.last_event_id,
        "event_count": row.event_count,
        "first_event_hash": row.first_event_hash,
        "last_event_hash": row.last_event_hash,
        "manifest_hash": row.manifest_hash,
        "sink_reference": row.sink_reference,
        "status": row.status,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _active_policy(db: Session) -> AuditRetentionPolicy | None:
    return db.execute(
        select(AuditRetentionPolicy)
        .where(AuditRetentionPolicy.status == "ACTIVE")
        .order_by(AuditRetentionPolicy.created_at.desc())
    ).scalars().first()


def _active_holds(db: Session) -> list[AuditLegalHold]:
    return list(
        db.execute(
            select(AuditLegalHold)
            .where(AuditLegalHold.status == "ACTIVE")
            .order_by(AuditLegalHold.created_at.desc())
        ).scalars()
    )


def _held(event: AuditEvent, holds: list[AuditLegalHold]) -> bool:
    for hold in holds:
        scope = hold.scope_type.upper()
        value = hold.scope_value
        if scope == "GLOBAL":
            return True
        if scope == "ACTOR" and event.actor == value:
            return True
        if scope == "CORRELATION" and (event.correlation_id or "") == value:
            return True
        if scope == "EVENT_TYPE" and event.event_type == value:
            return True
        if scope == "ENTITY" and f"{event.entity_type}:{event.entity_id}" == value:
            return True
    return False


def _eligible_events(db: Session, policy: AuditRetentionPolicy) -> tuple[datetime, list[AuditEvent], int]:
    cutoff = now_utc() - timedelta(days=policy.retention_days)
    candidates = list(
        db.execute(
            select(AuditEvent)
            .where(AuditEvent.occurred_at <= cutoff)
            .order_by(AuditEvent.occurred_at.asc(), AuditEvent.id.asc())
        ).scalars()
    )
    holds = _active_holds(db)
    eligible = [event for event in candidates if not _held(event, holds)]
    return cutoff, eligible, len(candidates) - len(eligible)


def _manifest_digest(policy: AuditRetentionPolicy, cutoff: datetime, events: list[AuditEvent]) -> str:
    payload = {
        "policy_id": policy.id,
        "cutoff_at": cutoff.isoformat(),
        "events": [
            {
                "id": event.id,
                "occurred_at": event.occurred_at.isoformat(),
                "event_hash": event.event_hash,
                "previous_hash": event.previous_hash,
            }
            for event in events
        ],
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


def build_audit_retention_router(get_db: Callable, require_roles: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/v1/audit/retention", tags=["audit-retention"])

    @router.get("")
    def retention_status(
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "AUDITOR", "LEGAL")),
    ):
        policy = _active_policy(db)
        policies = list(db.execute(select(AuditRetentionPolicy).order_by(AuditRetentionPolicy.created_at.desc())).scalars())
        holds = _active_holds(db)
        manifests = list(
            db.execute(
                select(AuditArchiveManifest)
                .order_by(AuditArchiveManifest.created_at.desc())
                .limit(50)
            ).scalars()
        )
        if policy:
            cutoff, eligible, held_count = _eligible_events(db, policy)
        else:
            cutoff, eligible, held_count = None, [], 0
        return {
            "active_policy": _policy_json(policy) if policy else None,
            "policies": [_policy_json(row) for row in policies],
            "active_holds": [_hold_json(row) for row in holds],
            "recent_manifests": [_manifest_json(row) for row in manifests],
            "readiness": {
                "cutoff_at": cutoff.isoformat() if cutoff else None,
                "eligible_event_count": len(eligible),
                "held_candidate_count": held_count,
                "archive_sink_verified": bool(policy and policy.archive_sink_verified_at),
                "archive_ready": bool(policy and policy.archive_sink_verified_at and eligible),
                "purge_supported": False,
                "purge_block_reason": "Audit-chain deletion is disabled. Archive verification and continuity design are required before any future destructive retention step.",
            },
        }

    @router.post("/policies", status_code=201)
    def create_policy(
        payload: RetentionPolicyCreate,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "AUDITOR")),
    ):
        existing_active = _active_policy(db)
        row = AuditRetentionPolicy(
            id=uid("ARP"),
            name=payload.name.strip(),
            retention_days=payload.retention_days,
            status="DRAFT",
            archive_sink=payload.archive_sink.strip() if payload.archive_sink else None,
            archive_sink_reference=payload.archive_sink_reference.strip() if payload.archive_sink_reference else None,
            created_by=ctx["actor"],
        )
        db.add(row)
        db.flush()
        approval = ApprovalRequest(
            id=uid("APR"),
            action_type="AUDIT_RETENTION_POLICY_ACTIVATE",
            entity_type="audit_retention_policy",
            entity_id=row.id,
            requested_by=ctx["actor"],
            required_role="AUDITOR",
            status="PENDING",
            reason=f"Activate audit retention policy {row.name}",
        )
        db.add(approval)
        audit(
            db, ctx["actor"], ctx["role"],
            "audit.retention_policy.created", "audit_retention_policy", row.id,
            {"retention_days": row.retention_days, "replaces_active_policy": existing_active.id if existing_active else None},
            "CONTROL",
        )
        db.commit()
        return {**_policy_json(row), "approval_request_id": approval.id}

    @router.post("/policies/{policy_id}/activate")
    def activate_policy(
        policy_id: str,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "AUDITOR")),
    ):
        row = db.get(AuditRetentionPolicy, policy_id)
        if not row:
            raise HTTPException(404, "Audit retention policy not found")
        approval = db.execute(
            select(ApprovalRequest)
            .where(
                ApprovalRequest.action_type == "AUDIT_RETENTION_POLICY_ACTIVATE",
                ApprovalRequest.entity_type == "audit_retention_policy",
                ApprovalRequest.entity_id == row.id,
            )
            .order_by(ApprovalRequest.created_at.desc())
        ).scalars().first()
        if not approval or approval.status != "APPROVED":
            raise HTTPException(409, "Independent approved audit-retention decision is required")
        if approval.requested_by == approval.decided_by:
            raise HTTPException(409, "Maker-checker retention approval is invalid")
        for current in db.execute(
            select(AuditRetentionPolicy).where(
                AuditRetentionPolicy.status == "ACTIVE",
                AuditRetentionPolicy.id != row.id,
            )
        ).scalars():
            current.status = "SUPERSEDED"
        row.status = "ACTIVE"
        row.approved_by = approval.decided_by
        row.approved_at = now_utc()
        audit(
            db, ctx["actor"], ctx["role"],
            "audit.retention_policy.activated", "audit_retention_policy", row.id,
            {"approved_by": row.approved_by, "retention_days": row.retention_days},
            "CONTROL",
        )
        emit_event(db, "audit.retention_policy.activated", "audit_retention_policy", row.id, {"retention_days": row.retention_days})
        db.commit()
        return _policy_json(row)

    @router.post("/holds", status_code=201)
    def create_hold(
        payload: HoldCreate,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "AUDITOR", "LEGAL")),
    ):
        if payload.scope_type not in HOLD_SCOPES:
            raise HTTPException(422, "Unsupported legal-hold scope")
        row = AuditLegalHold(
            id=uid("AHL"),
            scope_type=payload.scope_type,
            scope_value=payload.scope_value.strip(),
            reason=payload.reason.strip(),
            status="ACTIVE",
            created_by=ctx["actor"],
        )
        db.add(row)
        audit(
            db, ctx["actor"], ctx["role"],
            "audit.legal_hold.created", "audit_legal_hold", row.id,
            {"scope_type": row.scope_type, "scope_value": row.scope_value},
            "CONTROL",
        )
        db.commit()
        return _hold_json(row)

    @router.post("/holds/{hold_id}/release")
    def release_hold(
        hold_id: str,
        payload: DecisionNote,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "AUDITOR", "LEGAL")),
    ):
        row = db.get(AuditLegalHold, hold_id)
        if not row:
            raise HTTPException(404, "Audit legal hold not found")
        if row.status != "ACTIVE":
            return _hold_json(row)
        row.status = "RELEASED"
        row.released_by = ctx["actor"]
        row.released_at = now_utc()
        audit(
            db, ctx["actor"], ctx["role"],
            "audit.legal_hold.released", "audit_legal_hold", row.id,
            {"reason": payload.reason},
            "CONTROL",
        )
        db.commit()
        return _hold_json(row)

    @router.post("/archive-manifests", status_code=201)
    def create_archive_manifest(
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "AUDITOR")),
    ):
        policy = _active_policy(db)
        if not policy:
            raise HTTPException(409, "An active audit retention policy is required")
        cutoff, eligible, held_count = _eligible_events(db, policy)
        if not eligible:
            raise HTTPException(409, "No audit events are currently eligible for archive staging")
        digest = _manifest_digest(policy, cutoff, eligible)
        existing = db.execute(
            select(AuditArchiveManifest).where(AuditArchiveManifest.manifest_hash == digest)
        ).scalar_one_or_none()
        if existing:
            return _manifest_json(existing)
        first, last = eligible[0], eligible[-1]
        row = AuditArchiveManifest(
            id=uid("AAM"),
            policy_id=policy.id,
            cutoff_at=cutoff,
            first_event_id=first.id,
            last_event_id=last.id,
            event_count=len(eligible),
            first_event_hash=first.event_hash,
            last_event_hash=last.event_hash,
            manifest_hash=digest,
            sink_reference=policy.archive_sink_reference,
            status="STAGED",
            created_by=ctx["actor"],
        )
        db.add(row)
        audit(
            db, ctx["actor"], ctx["role"],
            "audit.archive_manifest.staged", "audit_archive_manifest", row.id,
            {"event_count": row.event_count, "held_candidate_count": held_count, "manifest_hash": row.manifest_hash},
            "CONTROL",
        )
        db.commit()
        return {
            **_manifest_json(row),
            "archive_sink_verified": bool(policy.archive_sink_verified_at),
            "destructive_retention_performed": False,
        }

    return router
