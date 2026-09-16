"""Finance & Ownership bounded domain for KRAVIA Office.

Ownership is statutory/evidence-backed state. Funding, mandates and payments are
separate operational state and can never mutate the cap table. High-risk writes
use the Office maker-checker primitive already implemented in backend.main.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Callable, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .finance_models import (
    ContributionAllocation,
    ContributionCall,
    ExpenseObligation,
    FinanceProviderEvent,
    FundingPolicy,
    PaymentAttempt,
    PaymentInstruction,
    PaymentMandate,
    ShareChangeRequest,
    ShareClass,
    ShareLedgerEntry,
    ShareTransferRequest,
    Shareholder,
)
from .models import ApprovalRequest, IntegrationRecord, Vendor
from .services import ENTITY_ID, audit, emit_event, now_utc, paise, rupees, uid

FINAL_INSTRUCTION_STATES = {"SUCCEEDED", "FAILED", "CANCELLED"}


class ShareClassCreate(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9_-]{1,24}$")
    name: str = Field(min_length=2, max_length=120)
    face_value: Decimal = Field(gt=0)
    authorised_shares: int = Field(ge=0)
    voting_rights_per_share: int = Field(default=1, ge=0)
    source_document_ref: Optional[str] = None


class ShareholderCreate(BaseModel):
    shareholder_no: str = Field(min_length=1, max_length=50)
    legal_name: str = Field(min_length=2, max_length=200)
    folio_no: Optional[str] = Field(default=None, max_length=80)
    email: Optional[str] = Field(default=None, max_length=320)
    source_document_ref: Optional[str] = None


class ShareChangeCreate(BaseModel):
    shareholder_id: str
    share_class_id: str
    entry_type: Literal["ISSUE", "CANCEL", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]
    quantity_delta: int
    instrument_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    source_document_ref: str = Field(min_length=2)
    certificate_no: Optional[str] = Field(default=None, max_length=80)
    counterparty_ref: Optional[str] = Field(default=None, max_length=160)
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_sign(self):
        if self.quantity_delta == 0:
            raise ValueError("quantity_delta must be non-zero")
        if self.entry_type in {"ISSUE", "ADJUSTMENT_IN"} and self.quantity_delta < 0:
            raise ValueError("inbound share changes require a positive quantity_delta")
        if self.entry_type in {"CANCEL", "ADJUSTMENT_OUT"} and self.quantity_delta > 0:
            raise ValueError("outbound share changes require a negative quantity_delta")
        return self


class ShareTransferCreate(BaseModel):
    from_shareholder_id: str
    to_shareholder_id: str
    share_class_id: str
    quantity: int = Field(gt=0)
    instrument_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    source_document_ref: str = Field(min_length=2)
    note: Optional[str] = None


class FundingPolicyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    allocation_basis: Literal["OWNERSHIP", "CUSTOM_WEIGHTS"]
    custom_weights: dict[str, int] = Field(default_factory=dict)
    frequency: str = Field(default="AS_NEEDED", max_length=30)
    max_call: Optional[Decimal] = Field(default=None, gt=0)
    source_document_ref: str = Field(min_length=2)

    @model_validator(mode="after")
    def validate_weights(self):
        if self.allocation_basis == "CUSTOM_WEIGHTS":
            if not self.custom_weights or sum(self.custom_weights.values()) != 10000:
                raise ValueError("custom weights must contain exactly 10,000 basis points")
            if any(v < 0 or v > 10000 for v in self.custom_weights.values()):
                raise ValueError("custom weight must be between 0 and 10,000 basis points")
        elif self.custom_weights:
            raise ValueError("custom_weights are only valid for CUSTOM_WEIGHTS")
        return self


class ExpenseCreate(BaseModel):
    vendor_id: Optional[str] = None
    reference: str = Field(min_length=2, max_length=100)
    title: str = Field(min_length=2, max_length=240)
    category: str = Field(min_length=2, max_length=120)
    amount: Decimal = Field(gt=0)
    due_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    funding_mode: Literal["COMPANY_FUNDS", "SHAREHOLDER_CONTRIBUTION"] = "COMPANY_FUNDS"
    funding_policy_id: Optional[str] = None
    source_document_ref: str = Field(min_length=2)
    note: Optional[str] = None

    @model_validator(mode="after")
    def validate_funding(self):
        if self.funding_mode == "SHAREHOLDER_CONTRIBUTION" and not self.funding_policy_id:
            raise ValueError("funding_policy_id is required for shareholder-funded expenses")
        return self


class MandateCreate(BaseModel):
    shareholder_id: str
    provider: str = Field(min_length=2, max_length=50)
    purpose: str = Field(min_length=3, max_length=240)
    max_amount: Decimal = Field(gt=0)
    frequency: str = Field(min_length=2, max_length=30)
    valid_from: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    valid_until: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    provider_customer_ref: Optional[str] = Field(default=None, max_length=160)
    provider_mandate_ref: Optional[str] = Field(default=None, max_length=160)
    authorisation_url: Optional[str] = None
    source_document_ref: Optional[str] = None


class MandateActivation(BaseModel):
    provider_mandate_ref: Optional[str] = Field(default=None, max_length=160)
    provider_customer_ref: Optional[str] = Field(default=None, max_length=160)


class ContributionCallCreate(BaseModel):
    expense_id: str
    due_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class ScheduleCollection(BaseModel):
    mandate_id: str
    scheduled_for: Optional[datetime] = None


class PayoutCreate(BaseModel):
    expense_id: str
    provider: str = Field(default="RAZORPAYX", max_length=50)
    provider_destination_ref: str = Field(min_length=2, max_length=200)
    amount: Optional[Decimal] = Field(default=None, gt=0)
    scheduled_for: Optional[datetime] = None


class DecisionNote(BaseModel):
    reason: Optional[str] = None


def _json_hash(value: object) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def _mode() -> str:
    mode = os.getenv("FINANCE_EXECUTION_MODE", "disabled").strip().lower()
    return mode if mode in {"disabled", "sandbox", "live"} else "disabled"


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _approval(db: Session, actor: str, action: str, entity_type: str, entity_id: str, role: str = "DIRECTOR") -> ApprovalRequest:
    row = ApprovalRequest(
        id=uid("APR"), action_type=action, entity_type=entity_type, entity_id=entity_id,
        requested_by=actor, required_role=role, status="PENDING",
        reason=f"Controlled {action.lower().replace('_', ' ')}",
    )
    db.add(row)
    return row


def _require_approved(db: Session, approval_id: Optional[str]) -> ApprovalRequest:
    row = db.get(ApprovalRequest, approval_id) if approval_id else None
    if not row or row.status != "APPROVED":
        raise HTTPException(409, "Independent maker-checker approval is required")
    return row


def _share_balance(db: Session, holder_id: str, class_id: str) -> int:
    value = db.scalar(select(func.coalesce(func.sum(ShareLedgerEntry.quantity_delta), 0)).where(
        ShareLedgerEntry.shareholder_id == holder_id,
        ShareLedgerEntry.share_class_id == class_id,
    ))
    return int(value or 0)


def _issued_total(db: Session, class_id: str) -> int:
    value = db.scalar(select(func.coalesce(func.sum(ShareLedgerEntry.quantity_delta), 0)).where(ShareLedgerEntry.share_class_id == class_id))
    return int(value or 0)


def _holder_json(x: Shareholder) -> dict:
    return {"id": x.id, "shareholder_no": x.shareholder_no, "legal_name": x.legal_name, "folio_no": x.folio_no, "email": x.email, "status": x.status, "source_document_ref": x.source_document_ref}


def _class_json(x: ShareClass) -> dict:
    return {"id": x.id, "code": x.code, "name": x.name, "face_value": rupees(x.face_value_paise), "authorised_shares": x.authorised_shares, "voting_rights_per_share": x.voting_rights_per_share, "status": x.status, "source_document_ref": x.source_document_ref}


def _instruction_json(x: PaymentInstruction) -> dict:
    return {
        "id": x.id, "direction": x.direction, "expense_id": x.expense_id, "allocation_id": x.allocation_id,
        "vendor_id": x.vendor_id, "mandate_id": x.mandate_id, "amount": rupees(x.amount_paise),
        "provider": x.provider, "provider_destination_ref": x.provider_destination_ref, "status": x.status,
        "scheduled_for": x.scheduled_for.isoformat() if x.scheduled_for else None, "requested_by": x.requested_by,
        "approved_by": x.approved_by, "provider_reference": x.provider_reference,
        "executed_at": x.executed_at.isoformat() if x.executed_at else None, "last_error": x.last_error,
    }


def _refresh_call(db: Session, call: ContributionCall) -> None:
    rows = db.execute(select(ContributionAllocation).where(ContributionAllocation.call_id == call.id)).scalars().all()
    if rows and all(x.collected_paise >= x.amount_paise for x in rows):
        call.status = "FUNDED"
    elif any(x.collected_paise > 0 for x in rows):
        call.status = "PARTIALLY_FUNDED"


def _integration_ready(db: Session, provider: str) -> bool:
    rows = db.execute(select(IntegrationRecord).where(IntegrationRecord.provider == provider)).scalars().all()
    return any(str(x.status).upper() in {"ACTIVE", "READY", "CONNECTED", "VERIFIED"} for x in rows)


def _validate_mandate(mandate: PaymentMandate, amount_paise: int, shareholder_id: str) -> None:
    if mandate.status != "ACTIVE":
        raise HTTPException(409, "Mandate is not active")
    if mandate.shareholder_id != shareholder_id:
        raise HTTPException(409, "Mandate does not belong to this shareholder")
    if amount_paise > mandate.max_amount_paise:
        raise HTTPException(409, "Collection amount exceeds mandate maximum")
    today = now_utc().date().isoformat()
    if mandate.valid_from and today < mandate.valid_from:
        raise HTTPException(409, "Mandate is not yet valid")
    if mandate.valid_until and today > mandate.valid_until:
        raise HTTPException(409, "Mandate has expired")


def _mark_success(db: Session, instruction: PaymentInstruction) -> None:
    instruction.status = "SUCCEEDED"
    instruction.executed_at = now_utc()
    instruction.last_error = None
    if instruction.direction == "COLLECTION" and instruction.allocation_id:
        allocation = db.get(ContributionAllocation, instruction.allocation_id)
        if allocation:
            allocation.collected_paise = min(allocation.amount_paise, allocation.collected_paise + instruction.amount_paise)
            allocation.status = "COLLECTED" if allocation.collected_paise >= allocation.amount_paise else "PARTIAL"
            call = db.get(ContributionCall, allocation.call_id)
            if call:
                _refresh_call(db, call)
    if instruction.direction == "PAYOUT" and instruction.expense_id:
        expense = db.get(ExpenseObligation, instruction.expense_id)
        if expense and instruction.amount_paise >= expense.amount_paise:
            expense.status = "PAID"
            expense.paid_at = now_utc()


def build_finance_ownership_router(get_db: Callable, require_roles: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/v1", tags=["finance-ownership"])

    @router.get("/ownership/share-classes")
    def list_share_classes(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS", "FINANCE", "CA", "AUDITOR"))):
        return [_class_json(x) for x in db.execute(select(ShareClass).order_by(ShareClass.code)).scalars()]

    @router.post("/ownership/share-classes", status_code=201)
    def create_share_class(payload: ShareClassCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS"))):
        if db.execute(select(ShareClass).where(ShareClass.legal_entity_id == ENTITY_ID, ShareClass.code == payload.code)).scalar_one_or_none():
            raise HTTPException(409, "Share class already exists")
        row = ShareClass(id=uid("SHC"), legal_entity_id=ENTITY_ID, code=payload.code, name=payload.name, face_value_paise=paise(payload.face_value), authorised_shares=payload.authorised_shares, voting_rights_per_share=payload.voting_rights_per_share, source_document_ref=payload.source_document_ref)
        db.add(row); audit(db, ctx["actor"], ctx["role"], "ownership.share_class.created", "share_class", row.id, {"code": row.code}, "CONTROL"); db.commit()
        return _class_json(row)

    @router.get("/ownership/shareholders")
    def list_shareholders(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS", "FINANCE", "CA", "AUDITOR"))):
        return [_holder_json(x) for x in db.execute(select(Shareholder).order_by(Shareholder.shareholder_no)).scalars()]

    @router.post("/ownership/shareholders", status_code=201)
    def create_shareholder(payload: ShareholderCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS"))):
        if db.execute(select(Shareholder).where(Shareholder.legal_entity_id == ENTITY_ID, Shareholder.shareholder_no == payload.shareholder_no)).scalar_one_or_none():
            raise HTTPException(409, "Shareholder number already exists")
        row = Shareholder(id=uid("SHR"), legal_entity_id=ENTITY_ID, shareholder_no=payload.shareholder_no, legal_name=payload.legal_name, folio_no=payload.folio_no or None, email=payload.email, source_document_ref=payload.source_document_ref)
        db.add(row); audit(db, ctx["actor"], ctx["role"], "ownership.shareholder.created", "shareholder", row.id, {"shareholder_no": row.shareholder_no}, "CONTROL"); db.commit()
        return _holder_json(row)

    @router.get("/ownership/ledger")
    def ownership_ledger(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS", "FINANCE", "CA", "AUDITOR"))):
        rows = db.execute(select(ShareLedgerEntry).order_by(ShareLedgerEntry.created_at.desc())).scalars()
        return [{"id": x.id, "shareholder_id": x.shareholder_id, "share_class_id": x.share_class_id, "entry_type": x.entry_type, "quantity_delta": x.quantity_delta, "instrument_date": x.instrument_date, "certificate_no": x.certificate_no, "counterparty_ref": x.counterparty_ref, "source_document_ref": x.source_document_ref, "posted_by": x.posted_by} for x in rows]

    @router.get("/ownership/summary")
    def ownership_summary(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS", "FINANCE", "CA", "AUDITOR"))):
        holders = db.execute(select(Shareholder).where(Shareholder.status == "ACTIVE").order_by(Shareholder.shareholder_no)).scalars().all()
        classes = db.execute(select(ShareClass).where(ShareClass.status == "ACTIVE").order_by(ShareClass.code)).scalars().all()
        totals = {c.id: _issued_total(db, c.id) for c in classes}
        total_all = sum(totals.values())
        cap = []
        for h in holders:
            by_class = {c.id: _share_balance(db, h.id, c.id) for c in classes}
            held = sum(by_class.values())
            cap.append({"shareholder": _holder_json(h), "shares": held, "ownership_percent": f"{(Decimal(held) * Decimal(100) / Decimal(total_all)):.4f}" if total_all else "0.0000", "by_class": by_class})
        return {"total_issued_shares": total_all, "classes": [{**_class_json(c), "issued_shares": totals[c.id]} for c in classes], "cap_table": cap, "source": "append-only share ledger"}

    @router.get("/ownership/share-changes")
    def list_share_changes(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS", "AUDITOR"))):
        rows = db.execute(select(ShareChangeRequest).order_by(ShareChangeRequest.created_at.desc())).scalars()
        return [{"id": x.id, "shareholder_id": x.shareholder_id, "share_class_id": x.share_class_id, "entry_type": x.entry_type, "quantity_delta": x.quantity_delta, "instrument_date": x.instrument_date, "status": x.status, "approval_request_id": x.approval_request_id, "posted_ledger_entry_id": x.posted_ledger_entry_id} for x in rows]

    @router.post("/ownership/share-changes", status_code=201)
    def stage_share_change(payload: ShareChangeCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS")), idempotency_key: str = Header(alias="Idempotency-Key")):
        digest = _json_hash(payload.model_dump())
        existing = db.execute(select(ShareChangeRequest).where(ShareChangeRequest.idempotency_key == idempotency_key)).scalar_one_or_none()
        if existing:
            if existing.payload_hash != digest: raise HTTPException(409, "Idempotency key reused with different share-change input")
            return {"id": existing.id, "status": existing.status, "approval_request_id": existing.approval_request_id}
        holder = db.get(Shareholder, payload.shareholder_id); share_class = db.get(ShareClass, payload.share_class_id)
        if not holder or not share_class: raise HTTPException(404, "Shareholder or share class not found")
        row = ShareChangeRequest(id=uid("SCR"), legal_entity_id=ENTITY_ID, shareholder_id=holder.id, share_class_id=share_class.id, entry_type=payload.entry_type, quantity_delta=payload.quantity_delta, instrument_date=payload.instrument_date, certificate_no=payload.certificate_no, counterparty_ref=payload.counterparty_ref, source_document_ref=payload.source_document_ref, note=payload.note, idempotency_key=idempotency_key, payload_hash=digest, requested_by=ctx["actor"])
        db.add(row); db.flush(); approval = _approval(db, ctx["actor"], "SHARE_CHANGE_POST", "share_change", row.id, "DIRECTOR"); row.approval_request_id = approval.id
        audit(db, ctx["actor"], ctx["role"], "ownership.share_change.staged", "share_change", row.id, {"entry_type": row.entry_type, "quantity_delta": row.quantity_delta}, "CONTROL"); db.commit()
        return {"id": row.id, "status": row.status, "approval_request_id": row.approval_request_id}

    @router.post("/ownership/share-changes/{change_id}/post")
    def post_share_change(change_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS"))):
        row = db.get(ShareChangeRequest, change_id)
        if not row: raise HTTPException(404, "Share change not found")
        if row.status == "POSTED": return {"id": row.id, "status": row.status, "ledger_entry_id": row.posted_ledger_entry_id}
        approval = _require_approved(db, row.approval_request_id)
        share_class = db.get(ShareClass, row.share_class_id)
        if _share_balance(db, row.shareholder_id, row.share_class_id) + row.quantity_delta < 0: raise HTTPException(409, "Share change would create a negative holding")
        if _issued_total(db, row.share_class_id) + row.quantity_delta > share_class.authorised_shares: raise HTTPException(409, "Share change exceeds authorised shares")
        ledger = ShareLedgerEntry(id=uid("SLE"), legal_entity_id=ENTITY_ID, shareholder_id=row.shareholder_id, share_class_id=row.share_class_id, entry_type=row.entry_type, quantity_delta=row.quantity_delta, instrument_date=row.instrument_date, certificate_no=row.certificate_no, counterparty_ref=row.counterparty_ref, idempotency_key=f"{row.idempotency_key}:POST", source_document_ref=row.source_document_ref, note=row.note, posted_by=ctx["actor"])
        db.add(ledger); db.flush(); row.status = "POSTED"; row.posted_ledger_entry_id = ledger.id; row.posted_at = now_utc()
        audit(db, ctx["actor"], ctx["role"], "ownership.share_change.posted", "share_change", row.id, {"ledger_entry_id": ledger.id, "approved_by": approval.decided_by}, "CONTROL"); emit_event(db, "ownership.share_change.posted", "share_change", row.id, {"ledger_entry_id": ledger.id}); db.commit()
        return {"id": row.id, "status": row.status, "ledger_entry_id": ledger.id}

    @router.get("/ownership/transfers")
    def list_transfers(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS", "AUDITOR"))):
        rows = db.execute(select(ShareTransferRequest).order_by(ShareTransferRequest.created_at.desc())).scalars()
        return [{"id": x.id, "from_shareholder_id": x.from_shareholder_id, "to_shareholder_id": x.to_shareholder_id, "share_class_id": x.share_class_id, "quantity": x.quantity, "instrument_date": x.instrument_date, "status": x.status, "approval_request_id": x.approval_request_id, "out_ledger_entry_id": x.out_ledger_entry_id, "in_ledger_entry_id": x.in_ledger_entry_id} for x in rows]

    @router.post("/ownership/transfers", status_code=201)
    def stage_transfer(payload: ShareTransferCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS")), idempotency_key: str = Header(alias="Idempotency-Key")):
        if payload.from_shareholder_id == payload.to_shareholder_id: raise HTTPException(422, "Source and destination shareholder must differ")
        digest = _json_hash(payload.model_dump())
        existing = db.execute(select(ShareTransferRequest).where(ShareTransferRequest.idempotency_key == idempotency_key)).scalar_one_or_none()
        if existing:
            if existing.payload_hash != digest: raise HTTPException(409, "Idempotency key reused with different transfer input")
            return {"id": existing.id, "status": existing.status, "approval_request_id": existing.approval_request_id}
        if not db.get(Shareholder, payload.from_shareholder_id) or not db.get(Shareholder, payload.to_shareholder_id) or not db.get(ShareClass, payload.share_class_id): raise HTTPException(404, "Shareholder or share class not found")
        if _share_balance(db, payload.from_shareholder_id, payload.share_class_id) < payload.quantity: raise HTTPException(409, "Source shareholder has insufficient shares")
        row = ShareTransferRequest(id=uid("STR"), legal_entity_id=ENTITY_ID, from_shareholder_id=payload.from_shareholder_id, to_shareholder_id=payload.to_shareholder_id, share_class_id=payload.share_class_id, quantity=payload.quantity, instrument_date=payload.instrument_date, source_document_ref=payload.source_document_ref, note=payload.note, idempotency_key=idempotency_key, payload_hash=digest, requested_by=ctx["actor"])
        db.add(row); db.flush(); approval = _approval(db, ctx["actor"], "SHARE_TRANSFER_POST", "share_transfer", row.id, "DIRECTOR"); row.approval_request_id = approval.id
        audit(db, ctx["actor"], ctx["role"], "ownership.transfer.staged", "share_transfer", row.id, {"quantity": row.quantity}, "CONTROL"); db.commit()
        return {"id": row.id, "status": row.status, "approval_request_id": row.approval_request_id}

    @router.post("/ownership/transfers/{transfer_id}/post")
    def post_transfer(transfer_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "CS"))):
        row = db.get(ShareTransferRequest, transfer_id)
        if not row: raise HTTPException(404, "Transfer not found")
        if row.status == "POSTED": return {"id": row.id, "status": row.status, "out_ledger_entry_id": row.out_ledger_entry_id, "in_ledger_entry_id": row.in_ledger_entry_id}
        approval = _require_approved(db, row.approval_request_id)
        if _share_balance(db, row.from_shareholder_id, row.share_class_id) < row.quantity: raise HTTPException(409, "Source shareholder no longer has sufficient shares")
        out_row = ShareLedgerEntry(id=uid("SLE"), legal_entity_id=ENTITY_ID, shareholder_id=row.from_shareholder_id, share_class_id=row.share_class_id, entry_type="TRANSFER_OUT", quantity_delta=-row.quantity, instrument_date=row.instrument_date, counterparty_ref=row.to_shareholder_id, idempotency_key=f"{row.idempotency_key}:OUT", source_document_ref=row.source_document_ref, note=row.note, posted_by=ctx["actor"])
        in_row = ShareLedgerEntry(id=uid("SLE"), legal_entity_id=ENTITY_ID, shareholder_id=row.to_shareholder_id, share_class_id=row.share_class_id, entry_type="TRANSFER_IN", quantity_delta=row.quantity, instrument_date=row.instrument_date, counterparty_ref=row.from_shareholder_id, idempotency_key=f"{row.idempotency_key}:IN", source_document_ref=row.source_document_ref, note=row.note, posted_by=ctx["actor"])
        db.add_all([out_row, in_row]); db.flush(); row.status = "POSTED"; row.out_ledger_entry_id = out_row.id; row.in_ledger_entry_id = in_row.id; row.posted_at = now_utc()
        audit(db, ctx["actor"], ctx["role"], "ownership.transfer.posted", "share_transfer", row.id, {"out": out_row.id, "in": in_row.id, "approved_by": approval.decided_by}, "CONTROL"); emit_event(db, "ownership.transfer.posted", "share_transfer", row.id, {"out": out_row.id, "in": in_row.id}); db.commit()
        return {"id": row.id, "status": row.status, "out_ledger_entry_id": out_row.id, "in_ledger_entry_id": in_row.id}

    @router.get("/finance/funding-policies")
    def list_policies(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"))):
        rows = db.execute(select(FundingPolicy).order_by(FundingPolicy.created_at.desc())).scalars()
        return [{"id": x.id, "name": x.name, "allocation_basis": x.allocation_basis, "custom_weights": json.loads(x.custom_weights_json or "{}"), "frequency": x.frequency, "max_call": rupees(x.max_call_paise) if x.max_call_paise else None, "status": x.status, "source_document_ref": x.source_document_ref, "approved_by": x.approved_by} for x in rows]

    @router.post("/finance/funding-policies", status_code=201)
    def create_policy(payload: FundingPolicyCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        for holder_id in payload.custom_weights:
            if not db.get(Shareholder, holder_id): raise HTTPException(422, f"Unknown shareholder in custom weights: {holder_id}")
        row = FundingPolicy(id=uid("FDP"), legal_entity_id=ENTITY_ID, name=payload.name, allocation_basis=payload.allocation_basis, custom_weights_json=json.dumps(payload.custom_weights, sort_keys=True), frequency=payload.frequency, max_call_paise=paise(payload.max_call) if payload.max_call is not None else None, source_document_ref=payload.source_document_ref, created_by=ctx["actor"])
        db.add(row); db.flush(); approval = _approval(db, ctx["actor"], "FUNDING_POLICY_ACTIVATE", "funding_policy", row.id, "DIRECTOR")
        audit(db, ctx["actor"], ctx["role"], "finance.funding_policy.created", "funding_policy", row.id, {"basis": row.allocation_basis, "approval_request_id": approval.id}, "CONTROL"); db.commit()
        return {"id": row.id, "status": row.status, "approval_request_id": approval.id}

    @router.post("/finance/funding-policies/{policy_id}/activate")
    def activate_policy(policy_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        row = db.get(FundingPolicy, policy_id)
        if not row: raise HTTPException(404, "Funding policy not found")
        approval = db.execute(select(ApprovalRequest).where(ApprovalRequest.entity_type == "funding_policy", ApprovalRequest.entity_id == row.id, ApprovalRequest.action_type == "FUNDING_POLICY_ACTIVATE").order_by(ApprovalRequest.created_at.desc())).scalars().first()
        approval = _require_approved(db, approval.id if approval else None)
        row.status = "ACTIVE"; row.approved_by = approval.decided_by; row.approved_at = now_utc(); audit(db, ctx["actor"], ctx["role"], "finance.funding_policy.activated", "funding_policy", row.id, {"approved_by": row.approved_by}, "CONTROL"); db.commit()
        return {"id": row.id, "status": row.status, "approved_by": row.approved_by}

    @router.get("/finance/expenses")
    def list_expenses(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"))):
        rows = db.execute(select(ExpenseObligation).order_by(ExpenseObligation.created_at.desc())).scalars()
        return [{"id": x.id, "vendor_id": x.vendor_id, "reference": x.reference, "title": x.title, "category": x.category, "amount": rupees(x.amount_paise), "due_date": x.due_date, "funding_mode": x.funding_mode, "funding_policy_id": x.funding_policy_id, "status": x.status, "approval_request_id": x.approval_request_id, "approved_by": x.approved_by} for x in rows]

    @router.post("/finance/expenses", status_code=201)
    def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE")), idempotency_key: str = Header(alias="Idempotency-Key")):
        digest = _json_hash(payload.model_dump())
        existing = db.execute(select(ExpenseObligation).where(ExpenseObligation.idempotency_key == idempotency_key)).scalar_one_or_none()
        if existing:
            if existing.payload_hash != digest: raise HTTPException(409, "Idempotency key reused with different expense input")
            return {"id": existing.id, "status": existing.status, "approval_request_id": existing.approval_request_id}
        if payload.vendor_id and not db.get(Vendor, payload.vendor_id): raise HTTPException(404, "Vendor not found")
        if payload.funding_policy_id and not db.get(FundingPolicy, payload.funding_policy_id): raise HTTPException(404, "Funding policy not found")
        row = ExpenseObligation(id=uid("EXP"), legal_entity_id=ENTITY_ID, vendor_id=payload.vendor_id, reference=payload.reference, title=payload.title, category=payload.category, amount_paise=paise(payload.amount), due_date=payload.due_date, funding_mode=payload.funding_mode, funding_policy_id=payload.funding_policy_id, source_document_ref=payload.source_document_ref, note=payload.note, idempotency_key=idempotency_key, payload_hash=digest, requested_by=ctx["actor"])
        db.add(row); db.flush(); approval = _approval(db, ctx["actor"], "EXPENSE_APPROVE", "expense", row.id, "DIRECTOR"); row.approval_request_id = approval.id
        audit(db, ctx["actor"], ctx["role"], "finance.expense.created", "expense", row.id, {"amount_paise": row.amount_paise, "funding_mode": row.funding_mode}, "FINANCIAL"); db.commit()
        return {"id": row.id, "status": row.status, "approval_request_id": row.approval_request_id}

    @router.post("/finance/expenses/{expense_id}/approve")
    def approve_expense(expense_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        row = db.get(ExpenseObligation, expense_id)
        if not row: raise HTTPException(404, "Expense not found")
        approval = _require_approved(db, row.approval_request_id)
        row.status = "APPROVED"; row.approved_by = approval.decided_by; row.approved_at = now_utc(); audit(db, ctx["actor"], ctx["role"], "finance.expense.approved", "expense", row.id, {"approved_by": row.approved_by}, "FINANCIAL"); db.commit()
        return {"id": row.id, "status": row.status, "approved_by": row.approved_by}

    @router.get("/finance/mandates")
    def list_mandates(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"))):
        rows = db.execute(select(PaymentMandate).order_by(PaymentMandate.created_at.desc())).scalars()
        return [{"id": x.id, "shareholder_id": x.shareholder_id, "provider": x.provider, "purpose": x.purpose, "status": x.status, "max_amount": rupees(x.max_amount_paise), "frequency": x.frequency, "provider_mandate_ref": x.provider_mandate_ref, "valid_from": x.valid_from, "valid_until": x.valid_until, "consented_at": x.consented_at.isoformat() if x.consented_at else None} for x in rows]

    @router.post("/finance/mandates", status_code=201)
    def create_mandate(payload: MandateCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        if not db.get(Shareholder, payload.shareholder_id): raise HTTPException(404, "Shareholder not found")
        row = PaymentMandate(id=uid("MAN"), legal_entity_id=ENTITY_ID, shareholder_id=payload.shareholder_id, provider=payload.provider.upper(), purpose=payload.purpose, max_amount_paise=paise(payload.max_amount), frequency=payload.frequency, provider_customer_ref=payload.provider_customer_ref, provider_mandate_ref=payload.provider_mandate_ref, authorisation_url=payload.authorisation_url, valid_from=payload.valid_from, valid_until=payload.valid_until, source_document_ref=payload.source_document_ref, created_by=ctx["actor"])
        db.add(row); audit(db, ctx["actor"], ctx["role"], "finance.mandate.created", "payment_mandate", row.id, {"provider": row.provider, "max_amount_paise": row.max_amount_paise}, "FINANCIAL"); db.commit()
        return {"id": row.id, "status": row.status}

    @router.post("/finance/mandates/{mandate_id}/activate")
    def activate_mandate(mandate_id: str, payload: MandateActivation, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        row = db.get(PaymentMandate, mandate_id)
        if not row: raise HTTPException(404, "Mandate not found")
        if row.status == "CANCELLED": raise HTTPException(409, "Cancelled mandate cannot be reactivated")
        if payload.provider_mandate_ref: row.provider_mandate_ref = payload.provider_mandate_ref
        if payload.provider_customer_ref: row.provider_customer_ref = payload.provider_customer_ref
        if _mode() == "live" and row.provider != "SANDBOX" and not row.provider_mandate_ref: raise HTTPException(409, "Provider mandate reference is required before live activation")
        row.status = "ACTIVE"; row.consented_at = now_utc(); audit(db, ctx["actor"], ctx["role"], "finance.mandate.activated", "payment_mandate", row.id, {"provider": row.provider}, "FINANCIAL"); db.commit()
        return {"id": row.id, "status": row.status, "consented_at": row.consented_at.isoformat()}

    @router.post("/finance/mandates/{mandate_id}/cancel")
    def cancel_mandate(mandate_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        row = db.get(PaymentMandate, mandate_id)
        if not row: raise HTTPException(404, "Mandate not found")
        row.status = "CANCELLED"; row.cancelled_at = now_utc(); audit(db, ctx["actor"], ctx["role"], "finance.mandate.cancelled", "payment_mandate", row.id, {}, "FINANCIAL"); db.commit(); return {"id": row.id, "status": row.status}

    @router.get("/finance/contribution-calls")
    def list_calls(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"))):
        calls = db.execute(select(ContributionCall).order_by(ContributionCall.created_at.desc())).scalars().all()
        result = []
        for call in calls:
            allocations = db.execute(select(ContributionAllocation).where(ContributionAllocation.call_id == call.id).order_by(ContributionAllocation.shareholder_id)).scalars().all()
            result.append({"id": call.id, "expense_id": call.expense_id, "funding_policy_id": call.funding_policy_id, "total": rupees(call.total_paise), "due_date": call.due_date, "status": call.status, "allocations": [{"id": x.id, "shareholder_id": x.shareholder_id, "amount": rupees(x.amount_paise), "weight_bps": x.weight_bps, "collected": rupees(x.collected_paise), "mandate_id": x.mandate_id, "status": x.status} for x in allocations]})
        return result

    @router.post("/finance/contribution-calls", status_code=201)
    def create_call(payload: ContributionCallCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        existing = db.execute(select(ContributionCall).where(ContributionCall.expense_id == payload.expense_id)).scalar_one_or_none()
        if existing: return {"id": existing.id, "status": existing.status}
        expense = db.get(ExpenseObligation, payload.expense_id)
        if not expense: raise HTTPException(404, "Expense not found")
        if expense.status != "APPROVED": raise HTTPException(409, "Expense must be approved before a contribution call")
        if expense.funding_mode != "SHAREHOLDER_CONTRIBUTION": raise HTTPException(409, "Expense is not configured for shareholder contribution funding")
        policy = db.get(FundingPolicy, expense.funding_policy_id)
        if not policy or policy.status != "ACTIVE": raise HTTPException(409, "Active funding policy required")
        if policy.max_call_paise and expense.amount_paise > policy.max_call_paise: raise HTTPException(409, "Expense exceeds funding policy maximum call")
        holders = db.execute(select(Shareholder).where(Shareholder.status == "ACTIVE").order_by(Shareholder.id)).scalars().all()
        if policy.allocation_basis == "CUSTOM_WEIGHTS":
            weights = {str(k): int(v) for k, v in json.loads(policy.custom_weights_json or "{}").items() if int(v) > 0}
            denominator = 10000
        else:
            weights = {h.id: sum(_share_balance(db, h.id, c.id) for c in db.execute(select(ShareClass).where(ShareClass.status == "ACTIVE")).scalars().all()) for h in holders}
            weights = {k: v for k, v in weights.items() if v > 0}; denominator = sum(weights.values())
        if not weights or denominator <= 0: raise HTTPException(409, "Funding policy has no positive allocation weights")
        if any(not db.get(Shareholder, holder_id) for holder_id in weights): raise HTTPException(409, "Funding policy references an unavailable shareholder")
        pieces = []
        assigned = 0
        for holder_id, weight in weights.items():
            raw = expense.amount_paise * weight
            amount, remainder = divmod(raw, denominator)
            pieces.append([holder_id, weight, amount, remainder]); assigned += amount
        residue = expense.amount_paise - assigned
        pieces.sort(key=lambda x: (-x[3], x[0]))
        for i in range(residue): pieces[i % len(pieces)][2] += 1
        call = ContributionCall(id=uid("CALL"), legal_entity_id=ENTITY_ID, expense_id=expense.id, funding_policy_id=policy.id, total_paise=expense.amount_paise, due_date=payload.due_date or expense.due_date, created_by=ctx["actor"])
        db.add(call); db.flush()
        for holder_id, weight, amount, _ in pieces:
            bps = int(round(weight * 10000 / denominator))
            db.add(ContributionAllocation(id=uid("ALL"), call_id=call.id, shareholder_id=holder_id, amount_paise=amount, weight_bps=min(10000, max(0, bps))))
        audit(db, ctx["actor"], ctx["role"], "finance.contribution_call.issued", "contribution_call", call.id, {"expense_id": expense.id, "total_paise": call.total_paise}, "FINANCIAL"); emit_event(db, "finance.contribution_call.issued", "contribution_call", call.id, {"expense_id": expense.id}); db.commit()
        return {"id": call.id, "status": call.status, "total": rupees(call.total_paise)}

    @router.post("/finance/contribution-allocations/{allocation_id}/schedule", status_code=201)
    def schedule_collection(allocation_id: str, payload: ScheduleCollection, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE")), idempotency_key: str = Header(alias="Idempotency-Key")):
        allocation = db.get(ContributionAllocation, allocation_id); mandate = db.get(PaymentMandate, payload.mandate_id)
        if not allocation or not mandate: raise HTTPException(404, "Allocation or mandate not found")
        digest = _json_hash({"allocation_id": allocation_id, **payload.model_dump()})
        existing = db.execute(select(PaymentInstruction).where(PaymentInstruction.idempotency_key == idempotency_key)).scalar_one_or_none()
        if existing:
            if existing.payload_hash != digest: raise HTTPException(409, "Idempotency key reused with different collection input")
            return _instruction_json(existing)
        _validate_mandate(mandate, allocation.amount_paise - allocation.collected_paise, allocation.shareholder_id)
        remaining = allocation.amount_paise - allocation.collected_paise
        if remaining <= 0: raise HTTPException(409, "Allocation is already collected")
        row = PaymentInstruction(id=uid("PIN"), legal_entity_id=ENTITY_ID, direction="COLLECTION", allocation_id=allocation.id, mandate_id=mandate.id, amount_paise=remaining, provider=mandate.provider, provider_destination_ref=mandate.provider_mandate_ref, idempotency_key=idempotency_key, payload_hash=digest, scheduled_for=payload.scheduled_for, requested_by=ctx["actor"])
        db.add(row); db.flush(); approval = _approval(db, ctx["actor"], "PAYMENT_INSTRUCTION_APPROVE", "payment_instruction", row.id, "DIRECTOR"); allocation.mandate_id = mandate.id; allocation.status = "SCHEDULED"
        audit(db, ctx["actor"], ctx["role"], "finance.collection.scheduled", "payment_instruction", row.id, {"amount_paise": remaining, "approval_request_id": approval.id}, "FINANCIAL"); db.commit()
        return {**_instruction_json(row), "approval_request_id": approval.id}

    @router.post("/finance/payouts", status_code=201)
    def create_payout(payload: PayoutCreate, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE")), idempotency_key: str = Header(alias="Idempotency-Key")):
        digest = _json_hash(payload.model_dump())
        existing = db.execute(select(PaymentInstruction).where(PaymentInstruction.idempotency_key == idempotency_key)).scalar_one_or_none()
        if existing:
            if existing.payload_hash != digest: raise HTTPException(409, "Idempotency key reused with different payout input")
            return _instruction_json(existing)
        expense = db.get(ExpenseObligation, payload.expense_id)
        if not expense: raise HTTPException(404, "Expense not found")
        if expense.status != "APPROVED": raise HTTPException(409, "Expense must be approved before payout")
        if not expense.vendor_id: raise HTTPException(409, "Payout expense must have a vendor")
        amount_paise = paise(payload.amount) if payload.amount is not None else expense.amount_paise
        if amount_paise > expense.amount_paise: raise HTTPException(409, "Payout cannot exceed approved expense")
        row = PaymentInstruction(id=uid("PIN"), legal_entity_id=ENTITY_ID, direction="PAYOUT", expense_id=expense.id, vendor_id=expense.vendor_id, amount_paise=amount_paise, provider=payload.provider.upper(), provider_destination_ref=payload.provider_destination_ref, idempotency_key=idempotency_key, payload_hash=digest, scheduled_for=payload.scheduled_for, requested_by=ctx["actor"])
        db.add(row); db.flush(); approval = _approval(db, ctx["actor"], "PAYMENT_INSTRUCTION_APPROVE", "payment_instruction", row.id, "DIRECTOR")
        audit(db, ctx["actor"], ctx["role"], "finance.payout.staged", "payment_instruction", row.id, {"amount_paise": amount_paise, "approval_request_id": approval.id}, "FINANCIAL"); db.commit()
        return {**_instruction_json(row), "approval_request_id": approval.id}

    @router.get("/finance/payment-instructions")
    def list_instructions(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"))):
        return [_instruction_json(x) for x in db.execute(select(PaymentInstruction).order_by(PaymentInstruction.created_at.desc())).scalars()]

    @router.post("/finance/payment-instructions/{instruction_id}/approve")
    def approve_instruction(instruction_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        row = db.get(PaymentInstruction, instruction_id)
        if not row: raise HTTPException(404, "Payment instruction not found")
        if row.status in FINAL_INSTRUCTION_STATES: return _instruction_json(row)
        approval = db.execute(select(ApprovalRequest).where(ApprovalRequest.entity_type == "payment_instruction", ApprovalRequest.entity_id == row.id, ApprovalRequest.action_type == "PAYMENT_INSTRUCTION_APPROVE").order_by(ApprovalRequest.created_at.desc())).scalars().first()
        approval = _require_approved(db, approval.id if approval else None)
        row.status = "APPROVED"; row.approved_by = approval.decided_by; audit(db, ctx["actor"], ctx["role"], "finance.payment_instruction.approved", "payment_instruction", row.id, {"approved_by": row.approved_by}, "FINANCIAL"); db.commit(); return _instruction_json(row)

    def execute_one(db: Session, row: PaymentInstruction, ctx: dict) -> dict:
        if row.status in FINAL_INSTRUCTION_STATES: return _instruction_json(row)
        if row.status != "APPROVED": raise HTTPException(409, "Payment instruction must be approved before execution")
        if row.scheduled_for and _as_utc(row.scheduled_for) > now_utc(): raise HTTPException(409, "Payment instruction is scheduled for a future time")
        if row.direction == "COLLECTION":
            allocation = db.get(ContributionAllocation, row.allocation_id); mandate = db.get(PaymentMandate, row.mandate_id)
            if not allocation or not mandate: raise HTTPException(409, "Collection allocation or mandate is unavailable")
            _validate_mandate(mandate, row.amount_paise, allocation.shareholder_id)
        mode = _mode()
        if mode == "disabled": raise HTTPException(409, "Payment execution is disabled")
        attempt_no = (db.scalar(select(func.count()).select_from(PaymentAttempt).where(PaymentAttempt.instruction_id == row.id)) or 0) + 1
        attempt = PaymentAttempt(id=uid("PAT"), instruction_id=row.id, attempt_no=int(attempt_no), provider=row.provider, request_digest=_json_hash({"instruction_id": row.id, "amount_paise": row.amount_paise, "direction": row.direction}), status="STARTED")
        db.add(attempt); row.status = "PROCESSING"; db.flush()
        if mode == "sandbox":
            ref = f"sandbox_{row.id.lower()}_{attempt.attempt_no}"
            attempt.status = "SUCCEEDED"; attempt.provider_reference = ref; attempt.http_status = 200; row.provider_reference = ref; _mark_success(db, row)
        elif row.direction == "PAYOUT" and row.provider == "RAZORPAYX":
            if not _integration_ready(db, "RAZORPAYX"): raise HTTPException(409, "RazorpayX integration registry is not READY")
            key = os.getenv("RAZORPAYX_KEY_ID", ""); secret = os.getenv("RAZORPAYX_KEY_SECRET", ""); account = os.getenv("RAZORPAYX_ACCOUNT_NUMBER", "")
            if not (key and secret and account): raise HTTPException(409, "RazorpayX live credentials are not configured")
            body = {"account_number": account, "fund_account_id": row.provider_destination_ref, "amount": row.amount_paise, "currency": "INR", "mode": "IMPS", "purpose": "vendor_bill", "queue_if_low_balance": True, "reference_id": row.id, "notes": {"instruction_id": row.id, "expense_id": row.expense_id or ""}}
            try:
                with httpx.Client(timeout=20.0) as client:
                    response = client.post("https://api.razorpay.com/v1/payouts", auth=(key, secret), headers={"X-Payout-Idempotency": row.idempotency_key}, json=body)
                attempt.http_status = response.status_code
                payload = response.json() if "json" in response.headers.get("content-type", "") else {}
                if response.status_code >= 400:
                    attempt.status = "FAILED"; attempt.failure_code = str(payload.get("error", {}).get("code") or response.status_code); row.status = "FAILED"; row.last_error = "Provider rejected payout request"
                else:
                    provider_ref = str(payload.get("id") or ""); row.provider_reference = provider_ref or None; attempt.provider_reference = provider_ref or None
                    status = str(payload.get("status") or "processing").lower()
                    if status == "processed": attempt.status = "SUCCEEDED"; _mark_success(db, row)
                    elif status in {"failed", "reversed", "cancelled", "rejected"}: attempt.status = "FAILED"; row.status = "FAILED"; row.last_error = f"Provider status: {status}"
                    else: attempt.status = "PROCESSING"; row.status = "PROCESSING"
            except httpx.HTTPError:
                attempt.status = "FAILED"; attempt.failure_code = "NETWORK_ERROR"; row.status = "FAILED"; row.last_error = "Provider network request failed"
        elif row.direction == "COLLECTION":
            attempt.status = "FAILED"; attempt.failure_code = "ADAPTER_NOT_APPROVED"; row.status = "FAILED"; row.last_error = "Live variable recurring collection adapter is not approved/configured"
        else:
            attempt.status = "FAILED"; attempt.failure_code = "UNSUPPORTED_PROVIDER"; row.status = "FAILED"; row.last_error = "Live provider/direction combination is not implemented"
        audit(db, ctx["actor"], ctx["role"], "finance.payment_instruction.executed", "payment_instruction", row.id, {"status": row.status, "mode": mode, "attempt_no": attempt.attempt_no}, "FINANCIAL"); emit_event(db, "finance.payment_instruction.updated", "payment_instruction", row.id, {"status": row.status}); db.commit(); return _instruction_json(row)

    @router.post("/finance/payment-instructions/{instruction_id}/execute")
    def execute_instruction(instruction_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE"))):
        row = db.get(PaymentInstruction, instruction_id)
        if not row: raise HTTPException(404, "Payment instruction not found")
        return execute_one(db, row, ctx)

    @router.post("/finance/payment-instructions/run-due")
    def run_due(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE"))):
        now = now_utc(); rows = db.execute(select(PaymentInstruction).where(PaymentInstruction.status == "APPROVED", PaymentInstruction.scheduled_for.is_not(None), PaymentInstruction.scheduled_for <= now).order_by(PaymentInstruction.scheduled_for)).scalars().all(); results = []
        for row in rows:
            try: results.append({"id": row.id, "result": execute_one(db, row, ctx)})
            except HTTPException as exc: results.append({"id": row.id, "status": "ERROR", "http_status": exc.status_code, "detail": str(exc.detail)})
        return {"processed": len(results), "run_at": now.isoformat(), "results": results}

    @router.get("/finance/readiness")
    def readiness(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "DIRECTOR", "FINANCE", "CA", "AUDITOR"))):
        mode = _mode(); razorpayx_credentials = bool(os.getenv("RAZORPAYX_KEY_ID") and os.getenv("RAZORPAYX_KEY_SECRET") and os.getenv("RAZORPAYX_ACCOUNT_NUMBER")); webhook = bool(os.getenv("RAZORPAY_WEBHOOK_SECRET"))
        return {"execution_mode": mode, "sandbox_ready": mode == "sandbox", "live_payout_credentials_configured": razorpayx_credentials, "live_payout_registry_ready": _integration_ready(db, "RAZORPAYX"), "webhook_secret_configured": webhook, "live_variable_collection": "PROVIDER_APPROVAL_REQUIRED", "secrets_exposed": False}

    @router.post("/finance/webhooks/razorpay")
    async def razorpay_webhook(request: Request, x_razorpay_signature: Optional[str] = Header(default=None), x_razorpay_event_id: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
        secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
        if not secret: raise HTTPException(503, "Razorpay webhook secret is not configured")
        body = await request.body(); expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not x_razorpay_signature or not hmac.compare_digest(expected, x_razorpay_signature): raise HTTPException(401, "Invalid Razorpay webhook signature")
        try: payload = json.loads(body.decode("utf-8"))
        except Exception as exc: raise HTTPException(400, "Invalid webhook JSON") from exc
        event_type = str(payload.get("event") or "unknown"); event_id = x_razorpay_event_id or hashlib.sha256(body).hexdigest()
        existing = db.execute(select(FinanceProviderEvent).where(FinanceProviderEvent.provider == "RAZORPAY", FinanceProviderEvent.provider_event_id == event_id)).scalar_one_or_none()
        if existing: return {"accepted": True, "duplicate": True, "event_id": existing.id}
        event = FinanceProviderEvent(id=uid("FPE"), provider="RAZORPAY", provider_event_id=event_id, event_type=event_type, signature_verified=True, payload_digest=hashlib.sha256(body).hexdigest())
        db.add(event)
        envelope = payload.get("payload") if isinstance(payload.get("payload"), dict) else {}
        entity = {}
        for key in ("payout", "payment", "subscription"):
            candidate = envelope.get(key) if isinstance(envelope, dict) else None
            if isinstance(candidate, dict) and isinstance(candidate.get("entity"), dict): entity = candidate["entity"]; break
        provider_ref = str(entity.get("id") or ""); notes = entity.get("notes") if isinstance(entity.get("notes"), dict) else {}
        instruction_id = notes.get("instruction_id")
        instruction = db.get(PaymentInstruction, instruction_id) if instruction_id else None
        if not instruction and provider_ref:
            instruction = db.execute(select(PaymentInstruction).where(PaymentInstruction.provider_reference == provider_ref)).scalar_one_or_none()
        if instruction:
            instruction.provider_reference = provider_ref or instruction.provider_reference
            if event_type in {"payout.processed", "payment.captured", "subscription.charged"}: _mark_success(db, instruction)
            elif event_type in {"payout.failed", "payout.reversed", "payout.cancelled", "payment.failed", "subscription.halted"}: instruction.status = "FAILED"; instruction.last_error = event_type
            else: instruction.status = "PROCESSING" if instruction.status not in FINAL_INSTRUCTION_STATES else instruction.status
            event.processing_status = "PROCESSED"
        else:
            event.processing_status = "REVIEW_REQUIRED"
        event.processed_at = now_utc(); audit(db, "Razorpay Webhook", "OPERATIONS", "finance.provider_event.received", "finance_provider_event", event.id, {"event_type": event_type, "processing_status": event.processing_status, "instruction_id": instruction.id if instruction else None}, "FINANCIAL"); db.commit()
        return {"accepted": True, "duplicate": False, "event_id": event.id, "processing_status": event.processing_status}

    return router
