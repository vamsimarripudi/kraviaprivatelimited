"""Controlled company/bootstrap loader for KRAVIA Office.

This module imports company master and opening shareholding from an operator-owned,
git-ignored JSON file. It never embeds legal identity/shareholder data in source.
"""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .finance_models import ShareClass, ShareLedgerEntry, Shareholder
from .models import LegalEntity
from .services import ENTITY_ID, audit, now_utc, paise, uid

PLACEHOLDER_CINS = {"", "CONTROLLED_NOT_CONFIGURED"}


def _date(value: str, field: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} must use YYYY-MM-DD") from exc
    return value


def _positive_decimal(value: Any, field: str) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be a decimal") from exc
    if parsed <= 0:
        raise ValueError(f"{field} must be greater than zero")
    return parsed


def load_controlled_config(path: str | Path) -> dict[str, Any]:
    target = Path(path)
    if not target.exists():
        raise FileNotFoundError(f"Controlled bootstrap file not found: {target}")
    data = json.loads(target.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Controlled bootstrap JSON must be an object")
    return validate_controlled_config(data)


def validate_controlled_config(data: dict[str, Any]) -> dict[str, Any]:
    entity = data.get("legal_entity") or {}
    for field in ("legal_name", "cin", "registered_office", "state_code", "source_ref"):
        if not str(entity.get(field) or "").strip():
            raise ValueError(f"legal_entity.{field} is required")
    if len(str(entity["state_code"])) != 2 or not str(entity["state_code"]).isdigit():
        raise ValueError("legal_entity.state_code must be a two-digit code")

    classes = data.get("share_classes") or []
    holders = data.get("shareholders") or []
    allocations = data.get("initial_allocations") or []
    if not classes or not holders:
        raise ValueError("At least one share class and one shareholder are required")

    class_map: dict[str, dict[str, Any]] = {}
    for item in classes:
        code = str(item.get("code") or "").strip().upper()
        if not code or code in class_map:
            raise ValueError("Share class codes must be non-empty and unique")
        authorised = int(item.get("authorised_shares") or 0)
        if authorised < 0:
            raise ValueError(f"share class {code} authorised_shares cannot be negative")
        _positive_decimal(item.get("face_value"), f"share class {code} face_value")
        if not str(item.get("name") or "").strip():
            raise ValueError(f"share class {code} name is required")
        if not str(item.get("evidence_ref") or "").strip():
            raise ValueError(f"share class {code} evidence_ref is required")
        class_map[code] = item

    holder_map: dict[str, dict[str, Any]] = {}
    for item in holders:
        number = str(item.get("shareholder_no") or "").strip()
        if not number or number in holder_map:
            raise ValueError("shareholder_no values must be non-empty and unique")
        if not str(item.get("legal_name") or "").strip():
            raise ValueError(f"shareholder {number} legal_name is required")
        if not str(item.get("evidence_ref") or "").strip():
            raise ValueError(f"shareholder {number} evidence_ref is required")
        holder_map[number] = item

    totals: dict[str, int] = defaultdict(int)
    for item in allocations:
        holder_no = str(item.get("shareholder_no") or "").strip()
        class_code = str(item.get("share_class_code") or "").strip().upper()
        if holder_no not in holder_map:
            raise ValueError(f"Unknown shareholder in initial allocation: {holder_no}")
        if class_code not in class_map:
            raise ValueError(f"Unknown share class in initial allocation: {class_code}")
        quantity = int(item.get("quantity") or 0)
        if quantity <= 0:
            raise ValueError("Initial allocation quantity must be greater than zero")
        _date(str(item.get("instrument_date") or ""), "initial_allocations.instrument_date")
        if not str(item.get("evidence_ref") or "").strip():
            raise ValueError("Every initial allocation requires evidence_ref")
        totals[class_code] += quantity

    for code, total in totals.items():
        if total > int(class_map[code]["authorised_shares"]):
            raise ValueError(f"Initial allocation exceeds authorised shares for {code}")

    normalized = json.loads(json.dumps(data))
    normalized["legal_entity"]["state_code"] = str(entity["state_code"])
    return normalized


def _ledger_key(cin: str, holder_no: str, class_code: str, item: dict[str, Any]) -> str:
    evidence_digest = hashlib.sha256(str(item["evidence_ref"]).encode()).hexdigest()[:16]
    return f"bootstrap:{cin}:{holder_no}:{class_code}:{item['instrument_date']}:{int(item['quantity'])}:{evidence_digest}"


def apply_controlled_config(db: Session, config: dict[str, Any], actor: str = "Controlled Bootstrap") -> dict[str, int]:
    config = validate_controlled_config(config)
    entity_data = config["legal_entity"]
    entity = db.get(LegalEntity, ENTITY_ID)
    if entity is None:
        entity = LegalEntity(
            id=ENTITY_ID,
            legal_name=entity_data["legal_name"].strip(),
            cin=entity_data["cin"].strip(),
            registered_office=entity_data["registered_office"].strip(),
            state_code=entity_data["state_code"],
            status="CONTROLLED_SOURCE_LOADED",
            source_ref=entity_data["source_ref"].strip(),
            verified_at=None,
        )
        db.add(entity)
    else:
        if entity.cin not in PLACEHOLDER_CINS and entity.cin != entity_data["cin"].strip():
            raise ValueError("Refusing to replace an already configured CIN")
        entity.legal_name = entity_data["legal_name"].strip()
        entity.cin = entity_data["cin"].strip()
        entity.registered_office = entity_data["registered_office"].strip()
        entity.state_code = entity_data["state_code"]
        entity.status = "CONTROLLED_SOURCE_LOADED"
        entity.source_ref = entity_data["source_ref"].strip()
    db.flush()

    class_ids: dict[str, str] = {}
    created_classes = 0
    for item in config["share_classes"]:
        code = item["code"].strip().upper()
        row = db.execute(select(ShareClass).where(ShareClass.legal_entity_id == ENTITY_ID, ShareClass.code == code)).scalar_one_or_none()
        face_value_paise = paise(_positive_decimal(item["face_value"], f"share class {code} face_value"))
        authorised = int(item["authorised_shares"])
        votes = int(item.get("voting_rights_per_share", 1))
        if row:
            if row.face_value_paise != face_value_paise or row.authorised_shares != authorised or row.name != item["name"].strip():
                raise ValueError(f"Existing share class {code} conflicts with controlled bootstrap")
        else:
            row = ShareClass(
                id=uid("SHC"), legal_entity_id=ENTITY_ID, code=code, name=item["name"].strip(),
                face_value_paise=face_value_paise, authorised_shares=authorised,
                voting_rights_per_share=votes, source_document_ref=item["evidence_ref"].strip(),
            )
            db.add(row); db.flush(); created_classes += 1
        class_ids[code] = row.id

    holder_ids: dict[str, str] = {}
    created_holders = 0
    for item in config["shareholders"]:
        number = item["shareholder_no"].strip()
        row = db.execute(select(Shareholder).where(Shareholder.legal_entity_id == ENTITY_ID, Shareholder.shareholder_no == number)).scalar_one_or_none()
        if row:
            if row.legal_name != item["legal_name"].strip():
                raise ValueError(f"Existing shareholder {number} conflicts with controlled bootstrap")
        else:
            row = Shareholder(
                id=uid("SHR"), legal_entity_id=ENTITY_ID, shareholder_no=number,
                legal_name=item["legal_name"].strip(), folio_no=(item.get("folio_no") or None),
                email=(item.get("email") or None), source_document_ref=item["evidence_ref"].strip(),
            )
            db.add(row); db.flush(); created_holders += 1
        holder_ids[number] = row.id

    posted_allocations = 0
    skipped_allocations = 0
    for item in config.get("initial_allocations", []):
        holder_no = item["shareholder_no"].strip()
        class_code = item["share_class_code"].strip().upper()
        key = _ledger_key(entity_data["cin"].strip(), holder_no, class_code, item)
        existing = db.execute(select(ShareLedgerEntry).where(ShareLedgerEntry.idempotency_key == key)).scalar_one_or_none()
        if existing:
            skipped_allocations += 1
            continue
        row = ShareLedgerEntry(
            id=uid("SLE"), legal_entity_id=ENTITY_ID, shareholder_id=holder_ids[holder_no],
            share_class_id=class_ids[class_code], entry_type="ISSUE", quantity_delta=int(item["quantity"]),
            instrument_date=_date(item["instrument_date"], "initial_allocations.instrument_date"),
            certificate_no=item.get("certificate_no") or None, counterparty_ref=None,
            idempotency_key=key, source_document_ref=item["evidence_ref"].strip(),
            note=item.get("note") or "Controlled opening shareholding import", posted_by=actor,
        )
        db.add(row); posted_allocations += 1

    audit(db, actor, "OWNER", "controlled.bootstrap.applied", "legal_entity", ENTITY_ID, {
        "share_classes_created": created_classes,
        "shareholders_created": created_holders,
        "allocations_posted": posted_allocations,
        "allocations_skipped": skipped_allocations,
        "source_ref": entity_data["source_ref"],
    }, "CONTROL")
    db.commit()
    return {
        "share_classes_created": created_classes,
        "shareholders_created": created_holders,
        "allocations_posted": posted_allocations,
        "allocations_skipped": skipped_allocations,
    }
