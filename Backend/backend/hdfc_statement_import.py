"""Read-only HDFC ENet CSV statement ingestion for KRAVIA Office.

Bank-approved statement APIs are a separate future integration. This module
never accesses HDFC credentials, signs into online banking, performs transfers,
records balances as verified, or marks BANK_FEED as CONNECTED.
"""
from __future__ import annotations

import csv
import hashlib
import hmac
import io
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import BankAccount, BankTransaction, IdempotencyRecord
from .services import uid, audit, emit_event, rupees

MAX_CSV_CHARACTERS = 750_000
MAX_CSV_ROWS = 200
MAX_ISSUES = 30
MAX_PREVIEW_ROWS = 35
SOURCE = "HDFC_ENET_CSV"

HEADERS = {
    "date": {"date", "transactiondate", "trandate", "txndate"},
    "description": {"narration", "description", "particulars", "transactionremarks",
                    "transactiondescription", "remarks"},
    "reference": {"chqrefno", "chequerefno", "chequereferenceno", "referenceno", "reference",
                  "utr", "utrno", "transactionid", "transactionref", "chqno"},
    "debit": {"withdrawalamt", "withdrawalamount", "withdrawal", "withdrawals",
              "debit", "debitamount", "debitamt"},
    "credit": {"depositamt", "depositamount", "deposit", "deposits",
               "credit", "creditamount", "creditamt"},
}
DATE_FORMATS = ("%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y",
                "%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d", "%d.%m.%Y")


class StatementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bank_account_id: str = Field(min_length=4, max_length=100)
    csv_text: str = Field(min_length=12, max_length=MAX_CSV_CHARACTERS)


class ConfirmRequest(StatementRequest):
    preview_digest: str = Field(pattern=r"^[a-f0-9]{64}$")
    confirm: Literal[True]


def _key(label: str) -> str:
    return re.sub(r"[^a-z0-9]", "", label.strip().lower())


def _columns(headers: list[str]) -> dict[str, int]:
    tokens = [_key(h) for h in headers]
    result: dict[str, int] = {}
    for column, aliases in HEADERS.items():
        index = next((idx for idx, token in enumerate(tokens) if token in aliases), -1)
        if index >= 0:
            result[column] = index
    return result


def _date(value: str) -> str:
    value = value.strip()
    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(value, fmt).date()
            if parsed.year < 2000 or parsed > datetime.now(ZoneInfo("Asia/Kolkata")).date():
                break
            return parsed.isoformat()
        except ValueError:
            continue
    raise ValueError("Invalid or future transaction date")


def _paise(raw: str) -> int:
    value = raw.strip().replace(",", "").replace("₹", "").replace(" ", "")
    if not value or value in {"-", "—"}:
        return 0
    if not re.fullmatch(r"\d+(?:\.\d{1,2})?", value):
        raise ValueError("Unsupported transaction amount")
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("Invalid transaction amount") from exc
    integer = int(amount * 100)
    if integer > 2_147_483_647:
        raise ValueError("Amount exceeds banking record range")
    return integer


def parse_hdfc_statement(source: str) -> tuple[list[dict], list[dict]]:
    """Validate whole file; no partial or silent imports of invalid rows."""
    if len(source) > MAX_CSV_CHARACTERS or "\x00" in source:
        raise HTTPException(413, "HDFC statement is too large or contains binary data")
    if "\ufffd" in source:
        raise HTTPException(422, "Invalid text encoding; download a CSV or delimited statement")
    try:
        reader = csv.reader(io.StringIO(source.lstrip("\ufeff"), newline=""), strict=True)
        records = list(reader)
    except (csv.Error, UnicodeError) as exc:
        raise HTTPException(422, "Could not safely parse the HDFC statement CSV") from exc
    if len(records) > MAX_CSV_ROWS + 35:
        raise HTTPException(413, "Import up to 200 transactions per reviewed batch")
    columns: dict[str, int] = {}
    start = -1
    for offset, candidate in enumerate(records[:25]):
        found = _columns(candidate)
        if {"date", "description", "debit", "credit"} <= found.keys():
            start, columns = offset, found
            break
    if start < 0:
        raise HTTPException(422, "HDFC CSV must include Date, Narration, Withdrawal Amt. and Deposit Amt. columns")
    if "reference" not in columns:
        raise HTTPException(422, "Statement must include Chq./Ref.No. or another bank reference column")

    result: list[dict] = []
    issues: list[dict] = []
    for line_no, values in enumerate(records[start + 1:], start + 2):
        if not values or not any(value.strip() for value in values):
            continue
        if len(result) + len(issues) >= MAX_CSV_ROWS:
            raise HTTPException(413, "Statement exceeds 200 rows; divide it into smaller date ranges")
        def cell(column: str) -> str:
            index = columns.get(column, -1)
            return (values[index] if index >= 0 and index < len(values) else "").strip()
        try:
            posted = _date(cell("date"))
            description = cell("description")[:1800]
            reference = cell("reference")
            if len(reference) < 2 or len(reference) > 200:
                raise ValueError("Missing or invalid bank reference; review this row manually")
            if not description:
                raise ValueError("Missing narration")
            debit, credit = _paise(cell("debit")), _paise(cell("credit"))
            if (debit > 0) == (credit > 0):
                raise ValueError("Exactly one of debit and credit must be positive")
            direction = "DEBIT" if debit else "CREDIT"
            amount = debit or credit
            result.append({"row": line_no, "date": posted,
                           "reference": reference, "description": description,
                           "direction": direction, "amount_paise": amount})
        except ValueError as exc:
            if len(issues) < MAX_ISSUES:
                issues.append({"row": line_no, "reason": str(exc)})
    if not result and not issues:
        raise HTTPException(422, "The HDFC statement contains no transactions")
    return result, issues


def _hdfc_account(db: Session, bank_account_id: str) -> BankAccount:
    account = db.get(BankAccount, bank_account_id)
    if not account or str(account.status).upper() != "ACTIVE" or "hdfc" not in account.bank_name.lower():
        raise HTTPException(422, "Select an active, masked HDFC company account in Office")
    return account


def _prepare(db: Session, request: StatementRequest) -> tuple[dict, list[dict]]:
    account = _hdfc_account(db, request.bank_account_id)
    rows, issues = parse_hdfc_statement(request.csv_text)
    digest = hashlib.sha256((account.id + "\x00" + request.csv_text).encode("utf-8")).hexdigest()
    refs = list({row["reference"] for row in rows})
    existing = db.execute(
        select(BankTransaction).where(
            BankTransaction.bank_account_id == account.id,
            BankTransaction.reference.in_(refs)
        )
    ).scalars().all() if refs else []
    known = {(tx.reference, tx.amount_paise): tx for tx in existing}
    seen: dict[tuple[str, int], dict] = {}
    fresh: list[dict] = []
    duplicate = 0
    conflicts = 0
    display: list[dict] = []
    for row in rows:
        key = (row["reference"], row["amount_paise"])
        prior = known.get(key)
        other = seen.get(key)
        if prior:
            duplicate += 1
            classification = "DUPLICATE" if prior.transaction_date == row["date"] and prior.direction == row["direction"] else "CONFLICT"
        elif other:
            duplicate += 1
            classification = "DUPLICATE" if other["date"] == row["date"] and other["direction"] == row["direction"] else "CONFLICT"
        else:
            classification = "NEW"
            fresh.append(row)
            seen[key] = row
        if classification == "CONFLICT":
            conflicts += 1
            if len(issues) < MAX_ISSUES:
                issues.append({"row": row["row"], "reason": "Bank reference/amount collision; resolve before import"})
        if len(display) < MAX_PREVIEW_ROWS:
            display.append({
                "row": row["row"], "date": row["date"], "direction": row["direction"],
                "amount": rupees(row["amount_paise"]), "reference": row["reference"],
                "description": row["description"][:140], "status": classification
            })
    summary = {"bank": "HDFC Bank", "account_masked": account.masked_account,
               "mode": "MANUAL_STATEMENT_EVIDENCE", "live_bank_feed": False,
               "digest": digest, "rows_total": len(rows) + len(issues),
               "new_rows": len(fresh), "duplicates": duplicate,
               "conflicts": conflicts, "issues": issues, "preview_rows": display}
    return summary, fresh


def build_hdfc_statement_router(get_db, require_roles) -> APIRouter:
    router = APIRouter(prefix="/api/v1/banking/hdfc", tags=["hdfc-statements"])
    finance = require_roles("OWNER", "FINANCE", "CA")

    @router.post("/statement/preview", include_in_schema=False)
    def preview(payload: StatementRequest, db: Session = Depends(get_db), ctx=Depends(finance)):
        summary, _ = _prepare(db, payload)
        return summary

    @router.post("/statement/confirm", include_in_schema=False)
    def confirm(payload: ConfirmRequest, db: Session = Depends(get_db), ctx=Depends(finance)):
        # Parse and verify again, never trust rows previously returned to the browser.
        summary, fresh = _prepare(db, payload)
        if not hmac.compare_digest(summary["digest"], payload.preview_digest):
            raise HTTPException(409, "Statement changed after preview; review it again")
        if summary["issues"]:
            raise HTTPException(409, "Resolve invalid or conflicting statement rows before confirming")
        idempotency = f"hdfc-statement-{summary['digest']}"
        existing_record = db.execute(
            select(IdempotencyRecord).where(IdempotencyRecord.operation == "hdfc.statement.import",
                                            IdempotencyRecord.idempotency_key == idempotency)
        ).scalar_one_or_none()
        if existing_record:
            import json
            return json.loads(existing_record.response_json)
        # Only recognized, active HDFC accounts are accepted, with no payment
        # execution, bank credential access, or false bank API connection state.
        for row in fresh:
            tx = BankTransaction(
                id=uid("BTX"), bank_account_id=payload.bank_account_id,
                transaction_date=row["date"], amount_paise=row["amount_paise"],
                direction=row["direction"], reference=row["reference"],
                description=row["description"], source=SOURCE,
                match_status="UNMATCHED"
            )
            db.add(tx)
            emit_event(db, "bank.transaction.imported", "bank_transaction", tx.id,
                       {"direction": tx.direction, "amount_paise": tx.amount_paise,
                        "source": SOURCE})
        result = {"status": "RECORDED", "source": SOURCE, "live_bank_feed": False,
                  "imported": len(fresh), "duplicates_skipped": summary["duplicates"],
                  "digest": summary["digest"]}
        import json
        db.add(IdempotencyRecord(idempotency_key=idempotency,
                                 operation="hdfc.statement.import",
                                 response_json=json.dumps(result)))
        audit(db, ctx["actor"], ctx["role"], "bank.statement.import_confirmed",
              "bank_account", payload.bank_account_id,
              {"source": SOURCE, "digest": summary["digest"],
               "imported": len(fresh), "duplicates": summary["duplicates"]}, "FINANCIAL")
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            # Database enforces the canonical account/reference/amount uniqueness.
            raise HTTPException(409, "Concurrent statement import or bank-reference conflict; refresh and preview again") from exc
        return result

    return router
