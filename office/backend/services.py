import json, uuid, hashlib
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .models import InvoiceSequence, ControlledSequence, AuditEvent, WorkflowRun, DomainEvent, JournalEntry, JournalLine

ENTITY_ID = "LE-KRAVIA-IN"

def uid(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:16].upper()}"

def now_utc():
    return datetime.now(timezone.utc)

def paise(value: Decimal | str | int | float) -> int:
    d = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int((d * 100).to_integral_value(rounding=ROUND_HALF_UP))

def rupees(paise_value: int) -> str:
    return f"{Decimal(paise_value) / Decimal(100):.2f}"

def financial_year(dt=None):
    dt = dt or datetime.now(timezone.utc)
    start = dt.year if dt.month >= 4 else dt.year - 1
    return f"{str(start)[-2:]}{str(start+1)[-2:]}"

def allocate_invoice_no(db, product_code: str):
    fy = financial_year()
    code = product_code.upper()[:5]
    for _ in range(3):
        seq = db.execute(select(InvoiceSequence).where(
            InvoiceSequence.legal_entity_id == ENTITY_ID,
            InvoiceSequence.product_code == code,
            InvoiceSequence.financial_year == fy
        ).with_for_update()).scalar_one_or_none()
        if seq is None:
            seq = InvoiceSequence(legal_entity_id=ENTITY_ID, product_code=code, financial_year=fy, current_value=0)
            db.add(seq)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                continue
        seq.current_value += 1
        db.flush()
        number = f"{code}/{fy}/{seq.current_value:06d}"
        if len(number) > 16:
            raise ValueError("Configured invoice sequence exceeds 16 characters")
        return number
    raise RuntimeError("Unable to allocate invoice sequence safely")

def audit(db, actor, role, event_type, entity_type, entity_id, detail, severity="INFO", correlation_id=None):
    detail_json=json.dumps(detail, sort_keys=True, default=str)
    previous=db.execute(select(AuditEvent).order_by(AuditEvent.occurred_at.desc(),AuditEvent.id.desc())).scalars().first()
    previous_hash=(previous.event_hash if previous else None)
    event_id=uid("AUD")
    payload={"id":event_id,"actor":actor,"actor_role":role,"event_type":event_type,"entity_type":entity_type,"entity_id":entity_id,"correlation_id":correlation_id,"detail_json":detail_json,"severity":severity,"previous_hash":previous_hash}
    event_hash=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
    ev = AuditEvent(
        id=event_id, occurred_at=now_utc(), actor=actor, actor_role=role, event_type=event_type,
        entity_type=entity_type, entity_id=entity_id, correlation_id=correlation_id,
        detail_json=detail_json, severity=severity, previous_hash=previous_hash, event_hash=event_hash
    )
    db.add(ev)
    return ev

def workflow(db, code, source_entity, source_id, steps, status="SUCCESS"):
    run = WorkflowRun(id=uid("RUN"), workflow_code=code, source_entity=source_entity,
                      source_id=source_id, status=status, steps_json=json.dumps(steps), completed_at=now_utc())
    db.add(run)
    return run


def emit_event(db, event_type, aggregate_type, aggregate_id, payload, correlation_id=None):
    ev=DomainEvent(id=uid("EVT"),event_type=event_type,aggregate_type=aggregate_type,aggregate_id=aggregate_id,payload_json=json.dumps(payload,sort_keys=True,default=str),correlation_id=correlation_id,status="PENDING")
    db.add(ev)
    return ev

def post_journal(db, source_type, source_id, memo, lines, entry_date=None, correlation_id=None):
    if sum(int(x.get("debit_paise",0)) for x in lines) != sum(int(x.get("credit_paise",0)) for x in lines):
        raise ValueError("Journal entry is not balanced")
    entry=JournalEntry(id=uid("JE"),entry_date=entry_date or now_utc().date().isoformat(),memo=memo,source_type=source_type,source_id=source_id,correlation_id=correlation_id,status="POSTED")
    db.add(entry); db.flush()
    for x in lines:
        db.add(JournalLine(journal_entry_id=entry.id,account_code=x["account_code"],debit_paise=int(x.get("debit_paise",0)),credit_paise=int(x.get("credit_paise",0)),customer_id=x.get("customer_id"),product_id=x.get("product_id"),memo=x.get("memo")))
    return entry


def allocate_controlled_no(db, document_type: str, prefix: str):
    fy=financial_year()
    prefix=prefix.upper()[:5]
    for _ in range(3):
        seq=db.execute(select(ControlledSequence).where(
            ControlledSequence.legal_entity_id==ENTITY_ID,
            ControlledSequence.document_type==document_type,
            ControlledSequence.prefix==prefix,
            ControlledSequence.financial_year==fy
        ).with_for_update()).scalar_one_or_none()
        if seq is None:
            seq=ControlledSequence(legal_entity_id=ENTITY_ID,document_type=document_type,prefix=prefix,financial_year=fy,current_value=0)
            db.add(seq)
            try:
                db.flush()
            except IntegrityError:
                db.rollback(); continue
        seq.current_value += 1
        db.flush()
        number=f"{prefix}/{fy}/{seq.current_value:06d}"
        if len(number)>16:
            raise ValueError("Configured controlled sequence exceeds 16 characters")
        return number
    raise RuntimeError("Unable to allocate controlled sequence safely")
