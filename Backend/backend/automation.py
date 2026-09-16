import json
from datetime import date, datetime, timezone
from sqlalchemy import select
from .models import ComplianceObligation, Contract, NoticeCase, Subscription, BankTransaction, OperationalAlert, DomainEvent
from .services import uid, now_utc, workflow

def _date(v):
    if not v: return None
    try:return date.fromisoformat(v[:10])
    except Exception:return None

def _days(v):
    d=_date(v)
    return (d-date.today()).days if d else None

def ensure_alert(db, key, category, severity, title, entity_type, entity_id, due_date=None, detail=None):
    row=db.execute(select(OperationalAlert).where(OperationalAlert.alert_key==key)).scalar_one_or_none()
    if row:
        if row.status=="RESOLVED": row.status="OPEN"; row.resolved_at=None
        row.severity=severity; row.title=title; row.due_date=due_date; row.detail_json=json.dumps(detail or {},sort_keys=True,default=str)
        return row,False
    row=OperationalAlert(id=uid("ALT"),alert_key=key,category=category,severity=severity,title=title,entity_type=entity_type,entity_id=entity_id,due_date=due_date,status="OPEN",detail_json=json.dumps(detail or {},sort_keys=True,default=str))
    db.add(row);return row,True

def scan_controls(db):
    created=0; touched=0
    for x in db.execute(select(ComplianceObligation)).scalars():
        if x.status in {"COMPLETE","VERIFIED","NOT_APPLICABLE"}: continue
        days=_days(x.due_date)
        if days is not None and days<=30:
            sev="CRITICAL" if days<0 else "HIGH" if days<=7 else "MEDIUM"
            _,new=ensure_alert(db,f"compliance:{x.id}","COMPLIANCE",sev,f"{x.title} {'overdue' if days<0 else 'due soon'}","compliance",x.id,x.due_date,{"authority":x.authority,"owner":x.owner,"days":days})
            created+=int(new);touched+=1
    for x in db.execute(select(Contract).where(Contract.status=="ACTIVE")).scalars():
        days=_days(x.expiry_date)
        threshold=x.notice_days if x.notice_days is not None else 30
        if days is not None and days<=threshold:
            sev="HIGH" if days<=7 else "MEDIUM"
            _,new=ensure_alert(db,f"contract:{x.id}","CONTRACT",sev,f"Contract action window: {x.contract_no}","contract",x.id,x.expiry_date,{"counterparty":x.counterparty_name,"notice_days":x.notice_days,"days":days})
            created+=int(new);touched+=1
    for x in db.execute(select(NoticeCase).where(NoticeCase.status=="OPEN")).scalars():
        days=_days(x.response_due_date)
        if days is not None and days<=14:
            sev="CRITICAL" if days<0 else "HIGH"
            _,new=ensure_alert(db,f"notice:{x.id}","NOTICE",sev,f"Response due: {x.authority} {x.reference_no}","notice",x.id,x.response_due_date,{"days":days,"risk":x.risk,"owner":x.owner})
            created+=int(new);touched+=1
    for x in db.execute(select(Subscription).where(Subscription.status.in_(["ACTIVE","CANCELLING"]))).scalars():
        days=_days(x.current_period_end)
        if days is not None and days<=7:
            _,new=ensure_alert(db,f"subscription:{x.id}","SUBSCRIPTION","MEDIUM",f"Subscription period ending: {x.id}","subscription",x.id,x.current_period_end,{"days":days,"cancel_at_period_end":x.cancel_at_period_end})
            created+=int(new);touched+=1
    for x in db.execute(select(BankTransaction).where(BankTransaction.match_status!="MATCHED")).scalars():
        _,new=ensure_alert(db,f"bank:{x.id}","RECONCILIATION","HIGH","Unmatched bank transaction","bank_transaction",x.id,x.transaction_date,{"reference":x.reference,"match_status":x.match_status,"amount_paise":x.amount_paise})
        created+=int(new);touched+=1
    return {"created":created,"active_control_hits":touched}

INTERNAL_EVENT_PREFIXES=("product.","customer.","invoice.","payment.","receipt.","credit_note.","refund.","subscription.","contract.","employee.","asset.","board.","authority.","document.","notice.","inspection.","bank.transaction.","approval.","commercial.plan.")

def process_outbox(db, limit=100):
    rows=db.execute(select(DomainEvent).where(DomainEvent.status=="PENDING").order_by(DomainEvent.created_at).limit(limit)).scalars().all()
    processed=0; waiting=0
    for ev in rows:
        if ev.event_type.startswith(INTERNAL_EVENT_PREFIXES):
            workflow(db,"WF-EVENT-INTERNAL",ev.aggregate_type,ev.aggregate_id,[{"step":"read_outbox_event","status":"SUCCESS"},{"step":"route_internal_event","status":"SUCCESS"},{"step":"complete_internal_bookkeeping","status":"SUCCESS"}],"SUCCESS")
            ev.status="PROCESSED";ev.processed_at=now_utc();ev.attempts+=1;processed+=1
        else:
            ev.status="WAITING_HANDLER";ev.attempts+=1;waiting+=1
    return {"processed":processed,"waiting_handler":waiting,"examined":len(rows)}

def tick(db):
    alerts=scan_controls(db)
    outbox=process_outbox(db)
    db.commit()
    return {"ran_at":now_utc().isoformat(),"alerts":alerts,"outbox":outbox}
