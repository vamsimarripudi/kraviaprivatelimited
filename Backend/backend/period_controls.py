"""Accounting/tax close controls for KRAVIA Office.

Period locks are corporate controls, not provider integrations. They prevent
financial postings into closed accounting/tax periods and require maker-checker
approval before a lock can be reopened.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from .database import Base
from .models import ApprovalRequest

ENTITY_ID = "LE-KRAVIA-IN"
VALID_LOCK_TYPES = {"ACCOUNTING", "TAX", "BOTH"}


class AccountingPeriodLock(Base):
    __tablename__ = "accounting_period_locks"

    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    period_start = Column(String(10), nullable=False)
    period_end = Column(String(10), nullable=False)
    lock_type = Column(String(20), nullable=False, default="BOTH")
    status = Column(String(20), nullable=False, default="LOCKED")
    reason = Column(Text, nullable=False)
    locked_by = Column(String(200), nullable=False)
    locked_at = Column(DateTime(timezone=True), nullable=False)
    unlock_approval_id = Column(String, ForeignKey("approval_requests.id"), nullable=True)
    unlocked_by = Column(String(200), nullable=True)
    unlocked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PeriodLockedError(ValueError):
    def __init__(self, lock: AccountingPeriodLock, domain: str, entry_date: str):
        self.lock_id = lock.id
        self.domain = domain
        self.entry_date = entry_date
        super().__init__(
            f"{domain} period is locked for {entry_date} "
            f"({lock.period_start} to {lock.period_end}; lock {lock.id})"
        )


class PeriodLockCreate(BaseModel):
    period_start: str = Field(min_length=10, max_length=10)
    period_end: str = Field(min_length=10, max_length=10)
    lock_type: str = "BOTH"
    reason: str = Field(min_length=3, max_length=2000)


class UnlockRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)


class UnlockExecute(BaseModel):
    approval_id: str = Field(min_length=1, max_length=160)


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16].upper()}"


def _iso_day(value: str | date | datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError as exc:
        raise ValueError("Financial entry date must be ISO YYYY-MM-DD") from exc


def _validate_range(period_start: str, period_end: str) -> tuple[str, str]:
    start = _iso_day(period_start)
    end = _iso_day(period_end)
    if start > end:
        raise ValueError("period_start must be on or before period_end")
    return start, end


def _scope_conflicts(existing: str, proposed: str) -> bool:
    return existing == "BOTH" or proposed == "BOTH" or existing == proposed


def active_period_lock(db: Session, entry_date: str | date | datetime | None, domain: str) -> AccountingPeriodLock | None:
    day = _iso_day(entry_date)
    scope = domain.upper()
    if scope not in {"ACCOUNTING", "TAX"}:
        raise ValueError("Period-lock domain must be ACCOUNTING or TAX")
    rows = db.execute(
        select(AccountingPeriodLock).where(
            AccountingPeriodLock.legal_entity_id == ENTITY_ID,
            AccountingPeriodLock.status == "LOCKED",
            AccountingPeriodLock.period_start <= day,
            AccountingPeriodLock.period_end >= day,
        )
    ).scalars().all()
    return next((row for row in rows if row.lock_type in {scope, "BOTH"}), None)


def assert_period_open(db: Session, entry_date: str | date | datetime | None, domain: str = "ACCOUNTING") -> None:
    day = _iso_day(entry_date)
    lock = active_period_lock(db, day, domain)
    if lock:
        raise PeriodLockedError(lock, domain.upper(), day)


def _serialize(row: AccountingPeriodLock) -> dict:
    return {
        "id": row.id,
        "period_start": row.period_start,
        "period_end": row.period_end,
        "lock_type": row.lock_type,
        "status": row.status,
        "reason": row.reason,
        "locked_by": row.locked_by,
        "locked_at": row.locked_at.isoformat() if row.locked_at else None,
        "unlock_approval_id": row.unlock_approval_id,
        "unlocked_by": row.unlocked_by,
        "unlocked_at": row.unlocked_at.isoformat() if row.unlocked_at else None,
    }


def build_period_control_router(get_db: Callable, require_roles: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/v1/accounting/period-locks", tags=["period-locks"])

    @router.get("")
    def list_locks(
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR")),
    ):
        rows = db.execute(
            select(AccountingPeriodLock).order_by(AccountingPeriodLock.period_start.desc(), AccountingPeriodLock.created_at.desc())
        ).scalars()
        return [_serialize(row) for row in rows]

    @router.post("", status_code=201)
    def create_lock(
        payload: PeriodLockCreate,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "FINANCE", "CA")),
    ):
        from .services import audit, emit_event

        try:
            start, end = _validate_range(payload.period_start, payload.period_end)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        lock_type = payload.lock_type.upper()
        if lock_type not in VALID_LOCK_TYPES:
            raise HTTPException(422, "lock_type must be ACCOUNTING, TAX or BOTH")
        overlapping = db.execute(
            select(AccountingPeriodLock).where(
                AccountingPeriodLock.legal_entity_id == ENTITY_ID,
                AccountingPeriodLock.status == "LOCKED",
                AccountingPeriodLock.period_start <= end,
                AccountingPeriodLock.period_end >= start,
            )
        ).scalars().all()
        if any(_scope_conflicts(row.lock_type, lock_type) for row in overlapping):
            raise HTTPException(409, "An overlapping active period lock already covers this control scope")
        row = AccountingPeriodLock(
            id=_uid("LOCK"),
            legal_entity_id=ENTITY_ID,
            period_start=start,
            period_end=end,
            lock_type=lock_type,
            status="LOCKED",
            reason=payload.reason.strip(),
            locked_by=ctx["actor"],
            locked_at=datetime.now(timezone.utc),
        )
        db.add(row)
        emit_event(db, "accounting.period.locked", "accounting_period_lock", row.id, {
            "period_start": start, "period_end": end, "lock_type": lock_type,
        })
        audit(db, ctx["actor"], ctx["role"], "accounting.period.locked", "accounting_period_lock", row.id, {
            "period_start": start, "period_end": end, "lock_type": lock_type, "reason": row.reason,
        }, "FINANCIAL")
        db.commit()
        return _serialize(row)

    @router.post("/{lock_id}/unlock-request", status_code=201)
    def request_unlock(
        lock_id: str,
        payload: UnlockRequest,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "FINANCE", "CA")),
    ):
        from .services import audit, emit_event

        lock = db.get(AccountingPeriodLock, lock_id)
        if not lock:
            raise HTTPException(404, "Period lock not found")
        if lock.status != "LOCKED":
            raise HTTPException(409, "Period is already open")
        existing = db.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.action_type == "ACCOUNTING_PERIOD_UNLOCK",
                ApprovalRequest.entity_type == "accounting_period_lock",
                ApprovalRequest.entity_id == lock.id,
                ApprovalRequest.status == "PENDING",
            )
        ).scalar_one_or_none()
        if existing:
            return {"approval_id": existing.id, "status": existing.status, "required_role": existing.required_role}
        approval = ApprovalRequest(
            id=_uid("APR"),
            action_type="ACCOUNTING_PERIOD_UNLOCK",
            entity_type="accounting_period_lock",
            entity_id=lock.id,
            requested_by=ctx["actor"],
            required_role="CA",
            status="PENDING",
            reason=payload.reason.strip(),
        )
        db.add(approval)
        emit_event(db, "accounting.period.unlock.requested", "accounting_period_lock", lock.id, {"approval_id": approval.id})
        audit(db, ctx["actor"], ctx["role"], "accounting.period.unlock.requested", "accounting_period_lock", lock.id, {
            "approval_id": approval.id, "reason": approval.reason,
        }, "FINANCIAL")
        db.commit()
        return {"approval_id": approval.id, "status": approval.status, "required_role": approval.required_role}

    @router.post("/{lock_id}/unlock")
    def execute_unlock(
        lock_id: str,
        payload: UnlockExecute,
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "FINANCE", "CA")),
    ):
        from .services import audit, emit_event

        lock = db.get(AccountingPeriodLock, lock_id)
        if not lock:
            raise HTTPException(404, "Period lock not found")
        if lock.status != "LOCKED":
            raise HTTPException(409, "Period is already open")
        approval = db.get(ApprovalRequest, payload.approval_id)
        if not approval or approval.status != "APPROVED":
            raise HTTPException(409, "An approved maker-checker unlock request is required")
        if approval.action_type != "ACCOUNTING_PERIOD_UNLOCK" or approval.entity_type != "accounting_period_lock" or approval.entity_id != lock.id:
            raise HTTPException(409, "Approval does not authorize this period unlock")
        lock.status = "OPEN"
        lock.unlock_approval_id = approval.id
        lock.unlocked_by = ctx["actor"]
        lock.unlocked_at = datetime.now(timezone.utc)
        emit_event(db, "accounting.period.unlocked", "accounting_period_lock", lock.id, {"approval_id": approval.id})
        audit(db, ctx["actor"], ctx["role"], "accounting.period.unlocked", "accounting_period_lock", lock.id, {
            "approval_id": approval.id, "approved_by": approval.decided_by,
        }, "FINANCIAL")
        db.commit()
        return _serialize(lock)

    return router
