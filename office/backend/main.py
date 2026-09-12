import os, json, hashlib, shutil
from pathlib import Path
import jwt
from jwt import PyJWKClient
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import FastAPI, Depends, HTTPException, Header, Query, UploadFile, File, Form
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from .database import Base, engine, get_db
from .models import LegalEntity, Product, Customer, Invoice, Payment, Receipt, IdempotencyRecord, AuditEvent, WorkflowRun, ComplianceObligation, DomainEvent, ChartAccount, JournalEntry, JournalLine, BoardMeeting, Resolution, AuthorityGrant, Vendor, Contract, Employee, OfficeAsset, Document, DocumentVersion, CommercialPlan, Subscription, CreditNote, Refund, BankAccount, BankTransaction, Settlement, ApprovalRequest, NoticeCase, InspectionCase, IntegrationRecord
from .schemas import CustomerCreate, ProductCreate, InvoiceCreate, PaymentCreate, ComplianceCreate, BoardMeetingCreate, ResolutionCreate, AuthorityCreate, VendorCreate, ContractCreate, EmployeeCreate, AssetCreate, PlanCreate, SubscriptionCreate, CreditNoteCreate, RefundCreate, BankAccountCreate, BankTransactionCreate, SettlementCreate, ApprovalCreate, ApprovalDecision, NoticeCreate, InspectionCreate, IntegrationCreate
from .services import uid, paise, rupees, now_utc, allocate_invoice_no, allocate_controlled_no, audit, workflow, emit_event, post_journal, ENTITY_ID
from .documents import invoice_pdf, receipt_pdf, ctc_pdf

APP_ENV = os.getenv("APP_ENV", "development")
AUTH_MODE = os.getenv("AUTH_MODE", "bootstrap" if APP_ENV != "production" else "oidc").lower()
BOOTSTRAP_KEY = os.getenv("OFFICE_BOOTSTRAP_KEY", "")
OIDC_ISSUER = os.getenv("OIDC_ISSUER", "")
OIDC_AUDIENCE = os.getenv("OIDC_AUDIENCE", "")
OIDC_JWKS_URL = os.getenv("OIDC_JWKS_URL", "")
OIDC_ROLE_CLAIM = os.getenv("OIDC_ROLE_CLAIM", "roles")
OIDC_ACTOR_CLAIM = os.getenv("OIDC_ACTOR_CLAIM", "email")
KRAVIA_GSTIN = os.getenv("KRAVIA_GSTIN", "")
KRAVIA_LEGAL_NAME = os.getenv("KRAVIA_LEGAL_NAME", "KRAVIA PRIVATE LIMITED").strip()
KRAVIA_CIN = os.getenv("KRAVIA_CIN", "").strip()
KRAVIA_REGISTERED_OFFICE = os.getenv("KRAVIA_REGISTERED_OFFICE", "").strip()
TAX_CONFIG_APPROVED = os.getenv("TAX_CONFIG_APPROVED", "false").lower() == "true"
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")
DOCUMENT_STORAGE_DIR = Path(os.getenv("DOCUMENT_STORAGE_DIR", "./runtime/private-vault")).resolve()
DOCUMENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25*1024*1024)))

if APP_ENV == "production" and AUTH_MODE != "oidc":
    raise RuntimeError("Production startup blocked: AUTH_MODE must be oidc")
if APP_ENV == "production" and not (OIDC_ISSUER and OIDC_AUDIENCE and OIDC_JWKS_URL):
    raise RuntimeError("Production startup blocked: OIDC issuer, audience and JWKS URL are required")

if APP_ENV == "production" and not (KRAVIA_LEGAL_NAME and KRAVIA_CIN and KRAVIA_REGISTERED_OFFICE):
    raise RuntimeError("Production startup blocked: controlled company master configuration is required")

def initialize_database():
    Base.metadata.create_all(bind=engine)
    from .database import SessionLocal
    db = SessionLocal()
    try:
        entity = db.get(LegalEntity, ENTITY_ID)
        if not entity:
            entity = LegalEntity(
                id=ENTITY_ID,
                legal_name=KRAVIA_LEGAL_NAME,
                cin=KRAVIA_CIN or "CONTROLLED_NOT_CONFIGURED",
                registered_office=KRAVIA_REGISTERED_OFFICE or "Controlled company master is not embedded in source control.",
                state_code="37",
                status="PARTIALLY_VERIFIED",
                source_ref="Controlled company master configuration is required before production lock"
            )
            db.add(entity)
        seeds = [
            ("PROD-VL","VL","VidyaLuma","Education SaaS"),
            ("PROD-VM","VM","Vaanmeet","Video Conferencing"),
            ("PROD-VF","VF","VFormix","Forms & Workflow SaaS"),
        ]
        for pid, code, name, cat in seeds:
            if not db.get(Product, pid):
                db.add(Product(id=pid, code=code, name=name, category=cat, legal_entity_id=ENTITY_ID))
        accounts=[
            ("1000","Bank / Payment Clearing","ASSET","DEBIT"),
            ("1100","Accounts Receivable","ASSET","DEBIT"),
            ("2000","Output GST - CGST","LIABILITY","CREDIT"),
            ("2010","Output GST - SGST","LIABILITY","CREDIT"),
            ("2020","Output GST - IGST","LIABILITY","CREDIT"),
            ("2100","Customer Credits / Refunds Payable","LIABILITY","CREDIT"),
            ("5100","Payment Gateway Fees","EXPENSE","DEBIT"),
            ("5110","Input GST - Gateway Fees","ASSET","DEBIT"),
            ("4000","SaaS / Services Revenue","INCOME","CREDIT"),
        ]
        for code,name,atype,normal in accounts:
            if not db.get(ChartAccount,code): db.add(ChartAccount(code=code,name=name,account_type=atype,normal_balance=normal))
        db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield

app = FastAPI(title="KRAVIA Office API", version="2.0.0", docs_url="/api/docs" if APP_ENV != "production" else None, lifespan=lifespan)

KNOWN_ROLES={"OWNER","DIRECTOR","FINANCE","CA","CS","LEGAL","HR","OPERATIONS","AUDITOR","PRODUCT_ADMIN"}
_jwks_client = PyJWKClient(OIDC_JWKS_URL) if OIDC_JWKS_URL else None

def actor_context(
    authorization: str | None = Header(default=None),
    x_kravia_office_key: str | None = Header(default=None),
    x_office_actor: str | None = Header(default=None),
    x_office_role: str | None = Header(default=None),
):
    if AUTH_MODE == "oidc":
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Bearer token required")
        token=authorization.split(" ",1)[1].strip()
        try:
            signing_key=_jwks_client.get_signing_key_from_jwt(token).key
            claims=jwt.decode(token,signing_key,algorithms=["RS256","ES256"],audience=OIDC_AUDIENCE,issuer=OIDC_ISSUER,options={"require":["exp","iat","sub"]})
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid identity token")
        raw_roles=claims.get(OIDC_ROLE_CLAIM,[])
        if isinstance(raw_roles,str): raw_roles=[raw_roles]
        roles={str(r).upper() for r in raw_roles if str(r).upper() in KNOWN_ROLES}
        if not roles: raise HTTPException(status_code=403, detail="No KRAVIA Office role assigned")
        actor=claims.get(OIDC_ACTOR_CLAIM) or claims.get("sub")
        return {"actor":str(actor),"role":sorted(roles)[0],"roles":roles,"subject":claims.get("sub"),"auth_mode":"oidc"}
    if BOOTSTRAP_KEY and x_kravia_office_key != BOOTSTRAP_KEY:
        raise HTTPException(status_code=401, detail="Invalid Office credential")
    role=(x_office_role or "OWNER").upper()
    if role not in KNOWN_ROLES: raise HTTPException(status_code=403, detail="Unknown Office role")
    return {"actor": x_office_actor or "Local Office Owner", "role": role, "roles":{role}, "subject":None, "auth_mode":"bootstrap"}

def require_roles(*allowed):
    allowed_set={x.upper() for x in allowed}
    def dependency(ctx=Depends(actor_context)):
        if not (ctx["roles"] & allowed_set):
            raise HTTPException(status_code=403, detail="Insufficient Office authority")
        return ctx
    return dependency

def get_idempotent(db, key, operation):
    if not key: return None
    row = db.execute(select(IdempotencyRecord).where(IdempotencyRecord.idempotency_key==key, IdempotencyRecord.operation==operation)).scalar_one_or_none()
    return json.loads(row.response_json) if row else None

def store_idempotent(db, key, operation, payload):
    if key:
        db.add(IdempotencyRecord(idempotency_key=key, operation=operation, response_json=json.dumps(payload, default=str)))

def invoice_json(inv):
    return {
        "id": inv.id, "invoice_no": inv.invoice_no, "status": inv.status,
        "issued_at": inv.issued_at.isoformat(), "due_date": inv.due_date,
        "customer_id": inv.customer_id, "product_id": inv.product_id,
        "description": inv.description, "sac": inv.sac,
        "taxable_value": rupees(inv.taxable_paise), "discount": rupees(inv.discount_paise),
        "net_taxable": rupees(inv.net_taxable_paise), "gst_rate": str(Decimal(inv.gst_rate_bps)/100),
        "cgst": rupees(inv.cgst_paise), "sgst": rupees(inv.sgst_paise), "igst": rupees(inv.igst_paise),
        "total": rupees(inv.total_paise), "paid": rupees(inv.paid_paise), "balance": rupees(inv.balance_paise),
        "currency": inv.currency, "document_hash": inv.document_hash, "snapshot": json.loads(inv.snapshot_json),
    }

@app.get("/health")
def health():
    return {"status":"ok","service":"KRAVIA Office API","version":"2.0.0","environment":APP_ENV}

@app.get("/api/v1/company")
def company(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    e=db.get(LegalEntity,ENTITY_ID)
    return {"id":e.id,"legal_name":e.legal_name,"cin":e.cin,"registered_office":e.registered_office,"state_code":e.state_code,"status":e.status,"source_ref":e.source_ref}

@app.get("/api/v1/products")
def products(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    return [{"id":p.id,"code":p.code,"name":p.name,"category":p.category,"status":p.status} for p in db.execute(select(Product).order_by(Product.code)).scalars()]

@app.post("/api/v1/products", status_code=201)
def create_product(payload: ProductCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER")), idempotency_key: str|None=Header(default=None, alias="Idempotency-Key")):
    cached=get_idempotent(db,idempotency_key,"product.create")
    if cached:return JSONResponse(cached,status_code=200)
    if db.execute(select(Product).where(Product.code==payload.code)).scalar_one_or_none():
        raise HTTPException(409,"Product code already exists")
    p=Product(id=uid("PROD"),code=payload.code,name=payload.name,category=payload.category,legal_entity_id=ENTITY_ID)
    db.add(p); audit(db,ctx["actor"],ctx["role"],"product.created","product",p.id,{"code":p.code,"name":p.name})
    result={"id":p.id,"code":p.code,"name":p.name,"category":p.category,"status":p.status}
    store_idempotent(db,idempotency_key,"product.create",result); db.commit(); return result

@app.get("/api/v1/customers")
def customers(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    return [{"id":c.id,"legal_name":c.legal_name,"display_name":c.display_name,"gstin":c.gstin,"state":c.state,"state_code":c.state_code,"country":c.country,"status":c.status} for c in db.execute(select(Customer).order_by(Customer.created_at.desc())).scalars()]

@app.post("/api/v1/customers", status_code=201)
def create_customer(payload: CustomerCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE")), idempotency_key: str|None=Header(default=None, alias="Idempotency-Key")):
    cached=get_idempotent(db,idempotency_key,"customer.create")
    if cached:return JSONResponse(cached,status_code=200)
    c=Customer(id=uid("CUS"),legal_name=payload.legal_name.strip(),display_name=(payload.display_name or payload.legal_name).strip(),gstin=payload.gstin,state=payload.state.strip(),state_code=payload.state_code,country=payload.country,email=payload.email,phone=payload.phone,billing_address=payload.billing_address)
    db.add(c); audit(db,ctx["actor"],ctx["role"],"customer.created","customer",c.id,{"legal_name":c.legal_name,"state_code":c.state_code})
    result={"id":c.id,"legal_name":c.legal_name,"display_name":c.display_name,"gstin":c.gstin,"state":c.state,"state_code":c.state_code,"country":c.country,"status":c.status}
    store_idempotent(db,idempotency_key,"customer.create",result); db.commit(); return result

@app.get("/api/v1/invoices")
def invoices(db: Session=Depends(get_db), ctx=Depends(actor_context), status: str|None=Query(default=None)):
    q=select(Invoice).order_by(Invoice.issued_at.desc())
    if status:q=q.where(Invoice.status==status)
    return [invoice_json(x) for x in db.execute(q).scalars()]

@app.post("/api/v1/invoices", status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE")), idempotency_key: str|None=Header(default=None, alias="Idempotency-Key")):
    if APP_ENV == "production" and (not KRAVIA_GSTIN or not TAX_CONFIG_APPROVED):
        raise HTTPException(409,"Production tax invoicing blocked until GSTIN and approved tax configuration are locked")
    cached=get_idempotent(db,idempotency_key,"invoice.issue")
    if cached:return JSONResponse(cached,status_code=200)
    c=db.get(Customer,payload.customer_id); p=db.get(Product,payload.product_id); e=db.get(LegalEntity,ENTITY_ID)
    if not c:raise HTTPException(404,"Customer not found")
    if not p:raise HTTPException(404,"Product not found")
    taxable=paise(payload.taxable_value); discount=paise(payload.discount)
    if discount>taxable:raise HTTPException(422,"Discount cannot exceed taxable value")
    net=taxable-discount; rate_bps=int((payload.gst_rate*Decimal(100)).to_integral_value())
    tax=(net*rate_bps+5000)//10000
    same_state=(c.state_code==e.state_code)
    cgst=tax//2 if same_state else 0; sgst=tax-cgst if same_state else 0; igst=0 if same_state else tax
    total=net+tax; no=allocate_invoice_no(db,p.code); inv_id=uid("INV")
    snapshot={"company":{"legal_name":e.legal_name,"cin":e.cin,"registered_office":e.registered_office,"state_code":e.state_code,"gstin":KRAVIA_GSTIN or None,"verification_status":e.status},"customer":{"id":c.id,"legal_name":c.legal_name,"display_name":c.display_name,"gstin":c.gstin,"state":c.state,"state_code":c.state_code,"country":c.country,"billing_address":c.billing_address},"product":{"id":p.id,"code":p.code,"name":p.name,"category":p.category}}
    immutable_payload={"invoice_no":no,"legal_entity_id":e.id,"customer_id":c.id,"product_id":p.id,"description":payload.description,"sac":payload.sac,"qty_milli":int(payload.qty*1000),"taxable_paise":taxable,"discount_paise":discount,"net_taxable_paise":net,"gst_rate_bps":rate_bps,"cgst_paise":cgst,"sgst_paise":sgst,"igst_paise":igst,"total_paise":total,"currency":"INR","snapshot":snapshot}
    document_hash=hashlib.sha256(json.dumps(immutable_payload,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
    inv=Invoice(id=inv_id,invoice_no=no,legal_entity_id=e.id,customer_id=c.id,product_id=p.id,status="ISSUED",issued_at=now_utc(),due_date=payload.due_date,description=payload.description,sac=payload.sac,qty_milli=int(payload.qty*1000),taxable_paise=taxable,discount_paise=discount,net_taxable_paise=net,gst_rate_bps=rate_bps,cgst_paise=cgst,sgst_paise=sgst,igst_paise=igst,total_paise=total,paid_paise=0,balance_paise=total,snapshot_json=json.dumps(snapshot,sort_keys=True),notes=payload.notes,document_hash=document_hash)
    db.add(inv); db.flush()
    journal_lines=[
        {"account_code":"1100","debit_paise":total,"customer_id":c.id,"product_id":p.id,"memo":no},
        {"account_code":"4000","credit_paise":net,"customer_id":c.id,"product_id":p.id,"memo":no},
    ]
    if cgst: journal_lines.append({"account_code":"2000","credit_paise":cgst,"customer_id":c.id,"product_id":p.id,"memo":no})
    if sgst: journal_lines.append({"account_code":"2010","credit_paise":sgst,"customer_id":c.id,"product_id":p.id,"memo":no})
    if igst: journal_lines.append({"account_code":"2020","credit_paise":igst,"customer_id":c.id,"product_id":p.id,"memo":no})
    post_journal(db,"INVOICE",inv.id,f"Invoice {no}",journal_lines,entry_date=inv.issued_at.date().isoformat())
    emit_event(db,"invoice.issued","invoice",inv.id,{"invoice_no":no,"customer_id":c.id,"product_id":p.id,"total_paise":total,"document_hash":document_hash})
    audit(db,ctx["actor"],ctx["role"],"invoice.issued","invoice",inv.id,{"invoice_no":no,"total_paise":total,"tax_mode":"CGST_SGST" if same_state else "IGST"},"FINANCIAL")
    workflow(db,"WF-BILL-ISSUE","invoice",inv.id,[{"step":"validate","status":"SUCCESS"},{"step":"allocate_sequence","status":"SUCCESS"},{"step":"snapshot","status":"SUCCESS"},{"step":"calculate_tax","status":"SUCCESS"},{"step":"issue","status":"SUCCESS"},{"step":"external_delivery","status":"NOT_CONNECTED"}],"PARTIAL_SUCCESS")
    result=invoice_json(inv); store_idempotent(db,idempotency_key,"invoice.issue",result); db.commit(); return result

@app.post("/api/v1/invoices/{invoice_id}/payments", status_code=201)
def record_payment(invoice_id: str, payload: PaymentCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE")), idempotency_key: str|None=Header(default=None, alias="Idempotency-Key")):
    cached=get_idempotent(db,idempotency_key,"payment.record")
    if cached:return JSONResponse(cached,status_code=200)
    inv=db.get(Invoice,invoice_id)
    if not inv:raise HTTPException(404,"Invoice not found")
    amount=paise(payload.amount)
    if amount>inv.balance_paise:raise HTTPException(422,"Payment exceeds invoice balance")
    if payload.external_reference:
        duplicate=db.execute(select(Payment).where(Payment.method==payload.method,Payment.external_reference==payload.external_reference)).scalar_one_or_none()
        if duplicate:
            raise HTTPException(409,"Payment external reference already recorded")
    pay=Payment(id=uid("PAY"),invoice_id=inv.id,amount_paise=amount,method=payload.method,external_reference=payload.external_reference,received_date=payload.received_date,status="SUCCESS")
    db.add(pay); db.flush()
    inv.paid_paise += amount; inv.balance_paise -= amount; inv.status="PAID" if inv.balance_paise==0 else "PARTIALLY_PAID"
    receipt_no=allocate_invoice_no(db,"R")
    receipt=Receipt(id=uid("RCT"),receipt_no=receipt_no,invoice_id=inv.id,payment_id=pay.id,customer_id=inv.customer_id,amount_paise=amount)
    db.add(receipt); db.flush()
    post_journal(db,"PAYMENT",pay.id,f"Payment against {inv.invoice_no}",[
        {"account_code":"1000","debit_paise":amount,"customer_id":inv.customer_id,"product_id":inv.product_id,"memo":payload.method},
        {"account_code":"1100","credit_paise":amount,"customer_id":inv.customer_id,"product_id":inv.product_id,"memo":inv.invoice_no},
    ],entry_date=payload.received_date)
    emit_event(db,"payment.succeeded","payment",pay.id,{"invoice_id":inv.id,"amount_paise":amount,"method":pay.method,"external_reference":pay.external_reference})
    emit_event(db,"receipt.issued","receipt",receipt.id,{"receipt_no":receipt.receipt_no,"payment_id":pay.id,"invoice_id":inv.id,"amount_paise":amount})
    audit(db,ctx["actor"],ctx["role"],"payment.recorded","payment",pay.id,{"invoice_id":inv.id,"amount_paise":amount,"method":pay.method},"FINANCIAL")
    workflow(db,"WF-PAYMENT-RECORD","payment",pay.id,[{"step":"validate","status":"SUCCESS"},{"step":"match_invoice","status":"SUCCESS"},{"step":"update_receivable","status":"SUCCESS"},{"step":"issue_receipt","status":"SUCCESS"},{"step":"bank_reconciliation","status":"SOURCE_NOT_CONNECTED"}],"PARTIAL_SUCCESS")
    result={"payment":{"id":pay.id,"amount":rupees(amount),"method":pay.method,"reference":pay.external_reference,"status":pay.status},"receipt":{"id":receipt.id,"receipt_no":receipt.receipt_no,"amount":rupees(amount)},"invoice":invoice_json(inv)}
    store_idempotent(db,idempotency_key,"payment.record",result); db.commit(); return result

@app.get("/api/v1/tax/gst/summary")
def gst_summary(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Invoice)).scalars().all()
    sums={"net_taxable_paise":0,"cgst_paise":0,"sgst_paise":0,"igst_paise":0,"total_paise":0}
    for x in rows:
        for k in sums:sums[k]+=getattr(x,k)
    return {k.replace("_paise",""):rupees(v) for k,v in sums.items()} | {"invoice_count":len(rows),"filing_status":"REVIEW_REQUIRED","note":"Working sales-register summary only; no GST portal filing is performed."}

@app.get("/api/v1/audit")
def audit_events(db: Session=Depends(get_db), ctx=Depends(actor_context), limit: int=Query(default=100,ge=1,le=500)):
    rows=db.execute(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(limit)).scalars()
    return [{"id":x.id,"occurred_at":x.occurred_at.isoformat(),"actor":x.actor,"role":x.actor_role,"event_type":x.event_type,"entity_type":x.entity_type,"entity_id":x.entity_id,"severity":x.severity,"previous_hash":x.previous_hash,"event_hash":x.event_hash,"detail":json.loads(x.detail_json)} for x in rows]


@app.get("/api/v1/audit/verify-chain")
def verify_audit_chain(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","AUDITOR"))):
    rows=db.execute(select(AuditEvent).order_by(AuditEvent.occurred_at.asc(),AuditEvent.id.asc())).scalars().all()
    previous=None; failures=[]
    for x in rows:
        payload={"id":x.id,"actor":x.actor,"actor_role":x.actor_role,"event_type":x.event_type,"entity_type":x.entity_type,"entity_id":x.entity_id,"correlation_id":x.correlation_id,"detail_json":x.detail_json,"severity":x.severity,"previous_hash":x.previous_hash}
        expected=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()
        if x.previous_hash!=previous or x.event_hash!=expected:
            failures.append({"id":x.id,"expected_previous":previous,"stored_previous":x.previous_hash,"expected_hash":expected,"stored_hash":x.event_hash})
        previous=x.event_hash
    return {"valid":not failures,"event_count":len(rows),"last_hash":previous,"failures":failures}

@app.get("/api/v1/workflows/runs")
def workflow_runs(db: Session=Depends(get_db), ctx=Depends(actor_context), limit: int=Query(default=100,ge=1,le=500)):
    rows=db.execute(select(WorkflowRun).order_by(WorkflowRun.started_at.desc()).limit(limit)).scalars()
    return [{"id":x.id,"workflow":x.workflow_code,"source_entity":x.source_entity,"source_id":x.source_id,"status":x.status,"steps":json.loads(x.steps_json),"started_at":x.started_at.isoformat()} for x in rows]

@app.get("/api/v1/compliance")
def compliance(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(ComplianceObligation).order_by(ComplianceObligation.created_at.desc())).scalars()
    return [{"id":x.id,"title":x.title,"authority":x.authority,"status":x.status,"due_date":x.due_date,"owner":x.owner,"evidence_ref":x.evidence_ref,"risk":x.risk} for x in rows]

@app.post("/api/v1/compliance", status_code=201)
def create_compliance(payload: ComplianceCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","CA","CS"))):
    row=ComplianceObligation(id=uid("CMP"),legal_entity_id=ENTITY_ID,title=payload.title,authority=payload.authority,status=payload.status,due_date=payload.due_date,owner=payload.owner,evidence_ref=payload.evidence_ref,risk=payload.risk)
    db.add(row); audit(db,ctx["actor"],ctx["role"],"compliance.created","compliance",row.id,{"title":row.title,"authority":row.authority,"status":row.status},"CONTROL"); db.commit()
    return {"id":row.id,"title":row.title,"authority":row.authority,"status":row.status,"due_date":row.due_date,"owner":row.owner,"risk":row.risk}

@app.get("/api/v1/inspection/manifest")
def inspection_manifest(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    invoices=db.execute(select(Invoice).order_by(Invoice.issued_at)).scalars().all()
    audit_count=db.execute(select(func.count()).select_from(AuditEvent)).scalar_one()
    return {
        "manifest_id":uid("INSP"),"generated_at":now_utc().isoformat(),"generated_by":ctx["actor"],"legal_entity_id":ENTITY_ID,
        "status":"READY_WITH_WARNINGS","warnings":["GST portal filing evidence is not connected","Bank feed/reconciliation is not connected","Production identity/signature layer is not connected"],
        "records":{"invoice_count":len(invoices),"audit_event_count":audit_count},
        "invoices":[{"invoice_id":x.id,"invoice_no":x.invoice_no,"status":x.status,"issued_at":x.issued_at.isoformat(),"total":rupees(x.total_paise)} for x in invoices]
    }

@app.get("/verify/invoice/{invoice_no:path}")
def verify_invoice(invoice_no: str, db: Session=Depends(get_db)):
    inv=db.execute(select(Invoice).where(Invoice.invoice_no==invoice_no)).scalar_one_or_none()
    if not inv:
        raise HTTPException(404,"Document not found")
    entity=db.get(LegalEntity,inv.legal_entity_id)
    return {
        "valid": True,
        "document_type": "TAX_INVOICE",
        "issuer": entity.legal_name,
        "cin": entity.cin,
        "document_number": inv.invoice_no,
        "issued_at": inv.issued_at.date().isoformat(),
        "status": inv.status,
        "hash": inv.document_hash
    }

@app.get("/api/v1/accounting/trial-balance")
def trial_balance(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    accounts=db.execute(select(ChartAccount).order_by(ChartAccount.code)).scalars().all()
    result=[]; total_debit=0; total_credit=0
    for a in accounts:
        debit=db.execute(select(func.coalesce(func.sum(JournalLine.debit_paise),0)).where(JournalLine.account_code==a.code)).scalar_one()
        credit=db.execute(select(func.coalesce(func.sum(JournalLine.credit_paise),0)).where(JournalLine.account_code==a.code)).scalar_one()
        total_debit += int(debit); total_credit += int(credit)
        result.append({"account_code":a.code,"account_name":a.name,"account_type":a.account_type,"debit":rupees(int(debit)),"credit":rupees(int(credit)),"net_paise":int(debit)-int(credit)})
    return {"balanced":total_debit==total_credit,"total_debit":rupees(total_debit),"total_credit":rupees(total_credit),"accounts":result,"control_note":"Operational subledger. Production chart/accounting policy requires accountant approval."}

@app.get("/api/v1/events/outbox")
def outbox(db: Session=Depends(get_db), ctx=Depends(actor_context), status: str|None=Query(default=None), limit: int=Query(default=100,ge=1,le=500)):
    q=select(DomainEvent).order_by(DomainEvent.created_at.desc()).limit(limit)
    if status:q=q.where(DomainEvent.status==status)
    rows=db.execute(q).scalars()
    return [{"id":x.id,"event_type":x.event_type,"aggregate_type":x.aggregate_type,"aggregate_id":x.aggregate_id,"status":x.status,"attempts":x.attempts,"created_at":x.created_at.isoformat(),"payload":json.loads(x.payload_json)} for x in rows]

@app.get("/api/v1/invoices/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: str, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    inv=db.get(Invoice,invoice_id)
    if not inv: raise HTTPException(404,"Invoice not found")
    company=db.get(LegalEntity,inv.legal_entity_id); customer=db.get(Customer,inv.customer_id); product=db.get(Product,inv.product_id)
    stream=invoice_pdf(inv,company,customer,product,KRAVIA_GSTIN or None,PUBLIC_BASE_URL or None)
    return StreamingResponse(stream,media_type="application/pdf",headers={"Content-Disposition":f'inline; filename="{inv.invoice_no.replace("/","-")}.pdf"'})

@app.get("/api/v1/receipts/{receipt_id}/pdf")
def get_receipt_pdf(receipt_id: str, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    receipt=db.get(Receipt,receipt_id)
    if not receipt: raise HTTPException(404,"Receipt not found")
    payment=db.get(Payment,receipt.payment_id); invoice=db.get(Invoice,receipt.invoice_id); company=db.get(LegalEntity,invoice.legal_entity_id); customer=db.get(Customer,receipt.customer_id)
    stream=receipt_pdf(receipt,payment,invoice,company,customer)
    return StreamingResponse(stream,media_type="application/pdf",headers={"Content-Disposition":f'inline; filename="{receipt.receipt_no.replace("/","-")}.pdf"'})

@app.get("/api/v1/governance/meetings")
def board_meetings(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(BoardMeeting).order_by(BoardMeeting.meeting_date.desc())).scalars()
    return [{"id":x.id,"meeting_no":x.meeting_no,"meeting_date":x.meeting_date,"title":x.title,"status":x.status,"notice_document_ref":x.notice_document_ref,"minutes_document_ref":x.minutes_document_ref} for x in rows]

@app.post("/api/v1/governance/meetings", status_code=201)
def create_board_meeting(payload: BoardMeetingCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","CS"))):
    if db.execute(select(BoardMeeting).where(BoardMeeting.meeting_no==payload.meeting_no)).scalar_one_or_none(): raise HTTPException(409,"Meeting number already exists")
    row=BoardMeeting(id=uid("BM"),meeting_no=payload.meeting_no,meeting_date=payload.meeting_date,title=payload.title,status="DRAFT")
    db.add(row); emit_event(db,"board.meeting.created","board_meeting",row.id,{"meeting_no":row.meeting_no,"date":row.meeting_date}); audit(db,ctx["actor"],ctx["role"],"board.meeting.created","board_meeting",row.id,{"meeting_no":row.meeting_no},"GOVERNANCE"); db.commit()
    return {"id":row.id,"meeting_no":row.meeting_no,"meeting_date":row.meeting_date,"title":row.title,"status":row.status}

@app.get("/api/v1/governance/resolutions")
def resolutions(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Resolution).order_by(Resolution.created_at.desc())).scalars()
    return [{"id":x.id,"resolution_no":x.resolution_no,"meeting_id":x.meeting_id,"agenda_item":x.agenda_item,"title":x.title,"status":x.status,"approved_date":x.approved_date,"content_hash":x.content_hash,"authority_scope":x.authority_scope} for x in rows]

@app.post("/api/v1/governance/meetings/{meeting_id}/resolutions", status_code=201)
def create_resolution(meeting_id: str, payload: ResolutionCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","CS"))):
    meeting=db.get(BoardMeeting,meeting_id)
    if not meeting: raise HTTPException(404,"Board meeting not found")
    if db.execute(select(Resolution).where(Resolution.resolution_no==payload.resolution_no)).scalar_one_or_none(): raise HTTPException(409,"Resolution number already exists")
    canonical=json.dumps({"meeting_id":meeting_id,"resolution_no":payload.resolution_no,"agenda_item":payload.agenda_item,"title":payload.title,"resolution_text":payload.resolution_text,"authority_scope":payload.authority_scope,"approved_date":payload.approved_date},sort_keys=True,separators=(",",":"))
    content_hash=hashlib.sha256(canonical.encode()).hexdigest()
    row=Resolution(id=uid("BR"),resolution_no=payload.resolution_no,meeting_id=meeting_id,agenda_item=payload.agenda_item,title=payload.title,resolution_text=payload.resolution_text,authority_scope=payload.authority_scope,status="APPROVED",approved_date=payload.approved_date,content_hash=content_hash)
    db.add(row); meeting.status="RESOLUTION_APPROVED"; emit_event(db,"board.resolution.approved","resolution",row.id,{"resolution_no":row.resolution_no,"meeting_id":meeting_id,"content_hash":content_hash}); audit(db,ctx["actor"],ctx["role"],"board.resolution.approved","resolution",row.id,{"resolution_no":row.resolution_no,"meeting_no":meeting.meeting_no},"GOVERNANCE"); workflow(db,"WF-BOARD-AUTHORITY","resolution",row.id,[{"step":"lock_resolution_version","status":"SUCCESS"},{"step":"ctc_ready","status":"SUCCESS"},{"step":"authority","status":"AVAILABLE_IF_SCOPE_EXISTS" if payload.authority_scope else "NOT_REQUIRED"},{"step":"human_certification","status":"PENDING"}],"PENDING_REVIEW"); db.commit()
    return {"id":row.id,"resolution_no":row.resolution_no,"meeting_id":row.meeting_id,"title":row.title,"status":row.status,"content_hash":row.content_hash,"authority_scope":row.authority_scope}

@app.get("/api/v1/governance/resolutions/{resolution_id}/ctc.pdf")
def resolution_ctc(resolution_id: str, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    resolution=db.get(Resolution,resolution_id)
    if not resolution: raise HTTPException(404,"Resolution not found")
    meeting=db.get(BoardMeeting,resolution.meeting_id); company=db.get(LegalEntity,ENTITY_ID)
    stream=ctc_pdf(resolution,meeting,company)
    return StreamingResponse(stream,media_type="application/pdf",headers={"Content-Disposition":f'inline; filename="CTC-{resolution.resolution_no}.pdf"'})

@app.get("/api/v1/governance/authorities")
def authorities(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(AuthorityGrant).order_by(AuthorityGrant.created_at.desc())).scalars()
    return [{"id":x.id,"authority_no":x.authority_no,"resolution_id":x.resolution_id,"grantee":x.grantee,"purpose":x.purpose,"scope_text":x.scope_text,"effective_date":x.effective_date,"expiry_date":x.expiry_date,"status":x.status} for x in rows]

@app.post("/api/v1/governance/resolutions/{resolution_id}/authorities", status_code=201)
def create_authority(resolution_id: str, payload: AuthorityCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","CS"))):
    resolution=db.get(Resolution,resolution_id)
    if not resolution: raise HTTPException(404,"Resolution not found")
    if not resolution.authority_scope: raise HTTPException(409,"Source resolution does not contain an approved authority scope")
    if db.execute(select(AuthorityGrant).where(AuthorityGrant.authority_no==payload.authority_no)).scalar_one_or_none(): raise HTTPException(409,"Authority number already exists")
    row=AuthorityGrant(id=uid("AUTH"),authority_no=payload.authority_no,resolution_id=resolution.id,grantee=payload.grantee,purpose=payload.purpose,scope_text=resolution.authority_scope,effective_date=payload.effective_date,expiry_date=payload.expiry_date,status="ACTIVE")
    db.add(row); emit_event(db,"authority.granted","authority",row.id,{"authority_no":row.authority_no,"resolution_id":resolution.id,"grantee":row.grantee}); audit(db,ctx["actor"],ctx["role"],"authority.granted","authority",row.id,{"authority_no":row.authority_no,"resolution_no":resolution.resolution_no,"grantee":row.grantee},"GOVERNANCE"); db.commit()
    return {"id":row.id,"authority_no":row.authority_no,"resolution_id":row.resolution_id,"grantee":row.grantee,"purpose":row.purpose,"scope_text":row.scope_text,"effective_date":row.effective_date,"expiry_date":row.expiry_date,"status":row.status}
@app.get("/api/v1/vendors")
def vendors(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Vendor).order_by(Vendor.created_at.desc())).scalars()
    return [{"id":x.id,"legal_name":x.legal_name,"category":x.category,"gstin":x.gstin,"status":x.status,"risk":x.risk,"product_codes":json.loads(x.products_json)} for x in rows]

@app.post("/api/v1/vendors", status_code=201)
def create_vendor(payload: VendorCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE","OPERATIONS"))):
    v=Vendor(id=uid("VEN"),legal_name=payload.legal_name,category=payload.category,gstin=(payload.gstin or None),risk=payload.risk,products_json=json.dumps(payload.product_codes))
    db.add(v); emit_event(db,"vendor.created","vendor",v.id,{"legal_name":v.legal_name,"risk":v.risk}); audit(db,ctx["actor"],ctx["role"],"vendor.created","vendor",v.id,{"legal_name":v.legal_name,"risk":v.risk},"CONTROL"); db.commit()
    return {"id":v.id,"legal_name":v.legal_name,"category":v.category,"gstin":v.gstin,"status":v.status,"risk":v.risk,"product_codes":payload.product_codes}

@app.get("/api/v1/contracts")
def contracts(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Contract).order_by(Contract.created_at.desc())).scalars()
    return [{"id":x.id,"contract_no":x.contract_no,"contract_type":x.contract_type,"counterparty_name":x.counterparty_name,"product_codes":json.loads(x.product_codes_json),"effective_date":x.effective_date,"expiry_date":x.expiry_date,"notice_days":x.notice_days,"value":rupees(x.value_paise) if x.value_paise is not None else None,"status":x.status,"document_ref":x.document_ref,"owner":x.owner} for x in rows]

@app.post("/api/v1/contracts", status_code=201)
def create_contract(payload: ContractCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","LEGAL"))):
    if db.execute(select(Contract).where(Contract.contract_no==payload.contract_no)).scalar_one_or_none(): raise HTTPException(409,"Contract number already exists")
    row=Contract(id=uid("CTR"),contract_no=payload.contract_no,contract_type=payload.contract_type,counterparty_name=payload.counterparty_name,product_codes_json=json.dumps(payload.product_codes),effective_date=payload.effective_date,expiry_date=payload.expiry_date,notice_days=payload.notice_days,value_paise=paise(payload.value) if payload.value is not None else None,document_ref=payload.document_ref,owner=payload.owner,status="ACTIVE")
    db.add(row); emit_event(db,"contract.created","contract",row.id,{"contract_no":row.contract_no,"counterparty":row.counterparty_name,"expiry_date":row.expiry_date}); audit(db,ctx["actor"],ctx["role"],"contract.created","contract",row.id,{"contract_no":row.contract_no},"LEGAL"); db.commit()
    return {"id":row.id,"contract_no":row.contract_no,"contract_type":row.contract_type,"counterparty_name":row.counterparty_name,"product_codes":payload.product_codes,"effective_date":row.effective_date,"expiry_date":row.expiry_date,"notice_days":row.notice_days,"status":row.status,"document_ref":row.document_ref,"owner":row.owner}

@app.get("/api/v1/people")
def people(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Employee).order_by(Employee.created_at.desc())).scalars()
    return [{"id":x.id,"employee_no":x.employee_no,"legal_name":x.legal_name,"designation":x.designation,"department":x.department,"work_email":x.work_email,"joining_date":x.joining_date,"exit_date":x.exit_date,"status":x.status} for x in rows]

@app.post("/api/v1/people", status_code=201)
def create_employee(payload: EmployeeCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","HR"))):
    if db.execute(select(Employee).where(Employee.employee_no==payload.employee_no)).scalar_one_or_none(): raise HTTPException(409,"Employee number already exists")
    row=Employee(id=uid("EMP"),employee_no=payload.employee_no,legal_name=payload.legal_name,designation=payload.designation,department=payload.department,work_email=payload.work_email,joining_date=payload.joining_date,status="ACTIVE")
    db.add(row); emit_event(db,"employee.joined","employee",row.id,{"employee_no":row.employee_no,"designation":row.designation}); audit(db,ctx["actor"],ctx["role"],"employee.joined","employee",row.id,{"employee_no":row.employee_no},"HR"); db.commit()
    return {"id":row.id,"employee_no":row.employee_no,"legal_name":row.legal_name,"designation":row.designation,"department":row.department,"work_email":row.work_email,"joining_date":row.joining_date,"status":row.status}

@app.get("/api/v1/assets")
def assets(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(OfficeAsset).order_by(OfficeAsset.created_at.desc())).scalars()
    return [{"id":x.id,"asset_no":x.asset_no,"name":x.name,"category":x.category,"serial_no":x.serial_no,"assigned_employee_id":x.assigned_employee_id,"location":x.location,"purchase_value":rupees(x.purchase_paise) if x.purchase_paise is not None else None,"status":x.status} for x in rows]

@app.post("/api/v1/assets", status_code=201)
def create_asset(payload: AssetCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","OPERATIONS","HR"))):
    if db.execute(select(OfficeAsset).where(OfficeAsset.asset_no==payload.asset_no)).scalar_one_or_none(): raise HTTPException(409,"Asset number already exists")
    if payload.assigned_employee_id and not db.get(Employee,payload.assigned_employee_id): raise HTTPException(404,"Assigned employee not found")
    row=OfficeAsset(id=uid("AST"),asset_no=payload.asset_no,name=payload.name,category=payload.category,serial_no=payload.serial_no,assigned_employee_id=payload.assigned_employee_id,location=payload.location,purchase_paise=paise(payload.purchase_value) if payload.purchase_value is not None else None,status="ACTIVE")
    db.add(row); emit_event(db,"asset.created","asset",row.id,{"asset_no":row.asset_no,"category":row.category}); audit(db,ctx["actor"],ctx["role"],"asset.created","asset",row.id,{"asset_no":row.asset_no},"CONTROL"); db.commit()
    return {"id":row.id,"asset_no":row.asset_no,"name":row.name,"category":row.category,"serial_no":row.serial_no,"assigned_employee_id":row.assigned_employee_id,"location":row.location,"status":row.status}

ALLOWED_UPLOAD_TYPES={"application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain","text/csv","image/png","image/jpeg","application/zip"}

@app.get("/api/v1/documents")
def documents(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Document).order_by(Document.created_at.desc())).scalars()
    result=[]
    for x in rows:
        v=db.execute(select(DocumentVersion).where(DocumentVersion.document_id==x.id,DocumentVersion.version_no==x.current_version)).scalar_one_or_none()
        result.append({"id":x.id,"title":x.title,"document_type":x.document_type,"area":x.area,"status":x.status,"source":x.source,"current_version":x.current_version,"locked":x.locked,"sha256":v.sha256 if v else None,"filename":v.filename if v else None,"size_bytes":v.size_bytes if v else None})
    return result

@app.post("/api/v1/documents", status_code=201)
async def upload_document(title: str=Form(...), document_type: str=Form(...), area: str=Form(...), source: str=Form("DIRECT_UPLOAD"), file: UploadFile=File(...), db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","CS","LEGAL","HR","OPERATIONS"))):
    content=await file.read(MAX_UPLOAD_BYTES+1)
    if len(content)>MAX_UPLOAD_BYTES: raise HTTPException(413,"File exceeds configured upload limit")
    ctype=(file.content_type or "application/octet-stream").lower()
    if ctype not in ALLOWED_UPLOAD_TYPES: raise HTTPException(415,"File type not allowed")
    digest=hashlib.sha256(content).hexdigest(); doc_id=uid("DOC"); ver_id=uid("DVER")
    suffix=Path(file.filename or "document").suffix.lower(); safe_name=f"{doc_id}-v1{suffix}"; path=DOCUMENT_STORAGE_DIR/safe_name; path.write_bytes(content)
    doc=Document(id=doc_id,title=title,document_type=document_type,area=area,status="DRAFT",source=source,current_version=1,locked=False)
    ver=DocumentVersion(id=ver_id,document_id=doc_id,version_no=1,filename=file.filename or safe_name,content_type=ctype,size_bytes=len(content),sha256=digest,storage_path=str(path),immutable=False)
    db.add(doc);db.add(ver);emit_event(db,"document.uploaded","document",doc.id,{"title":doc.title,"sha256":digest,"version":1});audit(db,ctx["actor"],ctx["role"],"document.uploaded","document",doc.id,{"title":doc.title,"sha256":digest},"DOCUMENT");db.commit()
    return {"id":doc.id,"title":doc.title,"document_type":doc.document_type,"area":doc.area,"status":doc.status,"version":1,"filename":ver.filename,"sha256":ver.sha256,"size_bytes":ver.size_bytes}

@app.post("/api/v1/documents/{document_id}/versions", status_code=201)
async def upload_document_version(document_id: str, file: UploadFile=File(...), db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","CS","LEGAL","HR","OPERATIONS"))):
    doc=db.get(Document,document_id)
    if not doc: raise HTTPException(404,"Document not found")
    if doc.locked: raise HTTPException(409,"Locked document cannot receive a replacement version; supersede through a new controlled document")
    content=await file.read(MAX_UPLOAD_BYTES+1)
    if len(content)>MAX_UPLOAD_BYTES: raise HTTPException(413,"File exceeds configured upload limit")
    ctype=(file.content_type or "application/octet-stream").lower()
    if ctype not in ALLOWED_UPLOAD_TYPES: raise HTTPException(415,"File type not allowed")
    next_version=doc.current_version+1; digest=hashlib.sha256(content).hexdigest(); suffix=Path(file.filename or "document").suffix.lower(); path=DOCUMENT_STORAGE_DIR/f"{doc.id}-v{next_version}{suffix}"; path.write_bytes(content)
    ver=DocumentVersion(id=uid("DVER"),document_id=doc.id,version_no=next_version,filename=file.filename or path.name,content_type=ctype,size_bytes=len(content),sha256=digest,storage_path=str(path),immutable=False)
    db.add(ver);doc.current_version=next_version;emit_event(db,"document.version.created","document",doc.id,{"version":next_version,"sha256":digest});audit(db,ctx["actor"],ctx["role"],"document.version.created","document",doc.id,{"version":next_version,"sha256":digest},"DOCUMENT");db.commit()
    return {"document_id":doc.id,"version":next_version,"filename":ver.filename,"sha256":digest,"size_bytes":len(content)}

@app.post("/api/v1/documents/{document_id}/lock")
def lock_document(document_id: str, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CS","LEGAL"))):
    doc=db.get(Document,document_id)
    if not doc: raise HTTPException(404,"Document not found")
    ver=db.execute(select(DocumentVersion).where(DocumentVersion.document_id==doc.id,DocumentVersion.version_no==doc.current_version)).scalar_one()
    doc.locked=True;doc.status="LOCKED";ver.immutable=True;emit_event(db,"document.locked","document",doc.id,{"version":doc.current_version,"sha256":ver.sha256});audit(db,ctx["actor"],ctx["role"],"document.locked","document",doc.id,{"version":doc.current_version,"sha256":ver.sha256},"DOCUMENT");db.commit()
    return {"id":doc.id,"status":doc.status,"locked":doc.locked,"version":doc.current_version,"sha256":ver.sha256}

@app.get("/api/v1/documents/{document_id}/download")
def download_document(document_id: str, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    doc=db.get(Document,document_id)
    if not doc: raise HTTPException(404,"Document not found")
    ver=db.execute(select(DocumentVersion).where(DocumentVersion.document_id==doc.id,DocumentVersion.version_no==doc.current_version)).scalar_one()
    path=Path(ver.storage_path)
    if not path.exists(): raise HTTPException(410,"Stored file unavailable")
    audit(db,ctx["actor"],ctx["role"],"document.downloaded","document",doc.id,{"version":doc.current_version,"sha256":ver.sha256},"DOCUMENT");db.commit()
    return FileResponse(path,media_type=ver.content_type,filename=ver.filename)

# ---- KRAVIA Office v2: commercial, refunds, banking, approvals, notices and inspection ----

def _plan_json(x):
    return {"id":x.id,"product_id":x.product_id,"code":x.code,"name":x.name,"billing_cycle":x.billing_cycle,"price":rupees(x.price_paise),"gst_rate":str(Decimal(x.gst_rate_bps)/100),"sac":x.sac,"currency":x.currency,"status":x.status,"effective_from":x.effective_from,"effective_to":x.effective_to,"config":json.loads(x.config_json or '{}')}

@app.get("/api/v1/commercial/plans")
def list_plans(db: Session=Depends(get_db), ctx=Depends(actor_context), product_id: str|None=Query(default=None)):
    q=select(CommercialPlan).order_by(CommercialPlan.created_at.desc())
    if product_id:q=q.where(CommercialPlan.product_id==product_id)
    return [_plan_json(x) for x in db.execute(q).scalars()]

@app.post("/api/v1/commercial/plans", status_code=201)
def create_plan(payload: PlanCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE"))):
    if not db.get(Product,payload.product_id): raise HTTPException(404,"Product not found")
    row=CommercialPlan(id=uid("PLAN"),product_id=payload.product_id,code=payload.code,name=payload.name,billing_cycle=payload.billing_cycle,price_paise=paise(payload.price),gst_rate_bps=int(payload.gst_rate*100),sac=payload.sac,currency="INR",status="ACTIVE",effective_from=payload.effective_from,effective_to=payload.effective_to,config_json="{}")
    db.add(row); emit_event(db,"commercial.plan.created","plan",row.id,{"code":row.code,"product_id":row.product_id}); audit(db,ctx["actor"],ctx["role"],"commercial.plan.created","plan",row.id,{"code":row.code},"CONTROL"); db.commit(); return _plan_json(row)

@app.get("/api/v1/commercial/subscriptions")
def list_subscriptions(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Subscription).order_by(Subscription.created_at.desc())).scalars()
    return [{"id":x.id,"customer_id":x.customer_id,"product_id":x.product_id,"plan_id":x.plan_id,"status":x.status,"started_at":x.started_at,"current_period_start":x.current_period_start,"current_period_end":x.current_period_end,"cancel_at_period_end":x.cancel_at_period_end,"external_reference":x.external_reference} for x in rows]

@app.post("/api/v1/commercial/subscriptions", status_code=201)
def create_subscription(payload: SubscriptionCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE")), idempotency_key: str|None=Header(default=None,alias="Idempotency-Key")):
    cached=get_idempotent(db,idempotency_key,"subscription.create")
    if cached:return JSONResponse(cached,status_code=200)
    customer=db.get(Customer,payload.customer_id); plan=db.get(CommercialPlan,payload.plan_id)
    if not customer: raise HTTPException(404,"Customer not found")
    if not plan: raise HTTPException(404,"Plan not found")
    row=Subscription(id=uid("SUB"),customer_id=customer.id,product_id=plan.product_id,plan_id=plan.id,status="ACTIVE",started_at=payload.started_at,current_period_start=payload.current_period_start,current_period_end=payload.current_period_end,external_reference=payload.external_reference)
    db.add(row); emit_event(db,"subscription.started","subscription",row.id,{"customer_id":row.customer_id,"product_id":row.product_id,"plan_id":row.plan_id}); audit(db,ctx["actor"],ctx["role"],"subscription.started","subscription",row.id,{"plan_id":row.plan_id},"COMMERCIAL")
    result={"id":row.id,"customer_id":row.customer_id,"product_id":row.product_id,"plan_id":row.plan_id,"status":row.status,"current_period_start":row.current_period_start,"current_period_end":row.current_period_end}
    store_idempotent(db,idempotency_key,"subscription.create",result); db.commit(); return result

@app.post("/api/v1/commercial/subscriptions/{subscription_id}/cancel")
def cancel_subscription(subscription_id: str, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE"))):
    row=db.get(Subscription,subscription_id)
    if not row: raise HTTPException(404,"Subscription not found")
    if row.status=="CANCELLED": return {"id":row.id,"status":row.status}
    row.cancel_at_period_end=True; row.status="CANCELLING"
    emit_event(db,"subscription.cancellation.requested","subscription",row.id,{"current_period_end":row.current_period_end}); audit(db,ctx["actor"],ctx["role"],"subscription.cancellation.requested","subscription",row.id,{"current_period_end":row.current_period_end},"COMMERCIAL"); db.commit(); return {"id":row.id,"status":row.status,"cancel_at_period_end":True}

@app.get("/api/v1/credit-notes")
def list_credit_notes(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(CreditNote).order_by(CreditNote.issued_at.desc())).scalars()
    return [{"id":x.id,"credit_note_no":x.credit_note_no,"invoice_id":x.invoice_id,"reason":x.reason,"net_taxable":rupees(x.net_taxable_paise),"cgst":rupees(x.cgst_paise),"sgst":rupees(x.sgst_paise),"igst":rupees(x.igst_paise),"total":rupees(x.total_paise),"status":x.status,"issued_at":x.issued_at.isoformat(),"document_hash":x.document_hash} for x in rows]

@app.post("/api/v1/invoices/{invoice_id}/credit-notes", status_code=201)
def create_credit_note(invoice_id: str, payload: CreditNoteCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE")), idempotency_key: str|None=Header(default=None,alias="Idempotency-Key")):
    cached=get_idempotent(db,idempotency_key,"credit_note.issue")
    if cached:return JSONResponse(cached,status_code=200)
    inv=db.get(Invoice,invoice_id)
    if not inv: raise HTTPException(404,"Invoice not found")
    prior=sum(x.net_taxable_paise for x in db.execute(select(CreditNote).where(CreditNote.invoice_id==invoice_id,CreditNote.status=="ISSUED")).scalars())
    value=paise(payload.taxable_value)
    if value<=0 or prior+value>inv.net_taxable_paise: raise HTTPException(422,"Credit taxable value exceeds remaining invoice taxable value")
    rate=inv.gst_rate_bps; tax=(value*rate+5000)//10000
    if inv.cgst_paise or inv.sgst_paise:
        cgst=tax//2; sgst=tax-cgst; igst=0
    else:
        cgst=sgst=0; igst=tax
    total=value+tax
    product=db.get(Product,inv.product_id); no=allocate_controlled_no(db,"CREDIT_NOTE",(product.code+"C")[:5])
    immutable={"credit_note_no":no,"invoice_id":inv.id,"reason":payload.reason,"net_taxable_paise":value,"cgst_paise":cgst,"sgst_paise":sgst,"igst_paise":igst,"total_paise":total}
    digest=hashlib.sha256(json.dumps(immutable,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    row=CreditNote(id=uid("CN"),credit_note_no=no,invoice_id=inv.id,customer_id=inv.customer_id,product_id=inv.product_id,reason=payload.reason,net_taxable_paise=value,cgst_paise=cgst,sgst_paise=sgst,igst_paise=igst,total_paise=total,status="ISSUED",issued_at=now_utc(),document_hash=digest)
    db.add(row)
    ar_reduction=min(inv.balance_paise,total); credit_liability=total-ar_reduction
    lines=[{"account_code":"4000","debit_paise":value,"customer_id":inv.customer_id,"product_id":inv.product_id}]
    if cgst: lines += [{"account_code":"2000","debit_paise":cgst},{"account_code":"2010","debit_paise":sgst}]
    if igst: lines += [{"account_code":"2020","debit_paise":igst}]
    if ar_reduction: lines.append({"account_code":"1100","credit_paise":ar_reduction,"customer_id":inv.customer_id,"product_id":inv.product_id})
    if credit_liability: lines.append({"account_code":"2100","credit_paise":credit_liability,"customer_id":inv.customer_id,"product_id":inv.product_id})
    post_journal(db,"CREDIT_NOTE",row.id,f"Credit note {no} against {inv.invoice_no}",lines,correlation_id=row.id)
    inv.balance_paise=max(0,inv.balance_paise-total)
    if inv.balance_paise==0 and inv.paid_paise==0: inv.status="CREDITED"
    elif inv.balance_paise==0 and inv.paid_paise>0: inv.status="PAID_CREDITED"
    emit_event(db,"credit_note.issued","credit_note",row.id,{"credit_note_no":no,"invoice_id":inv.id,"total_paise":total}); audit(db,ctx["actor"],ctx["role"],"credit_note.issued","credit_note",row.id,{"invoice_id":inv.id,"total":rupees(total)},"FINANCIAL")
    result={"id":row.id,"credit_note_no":no,"invoice_id":inv.id,"reason":row.reason,"net_taxable":rupees(value),"cgst":rupees(cgst),"sgst":rupees(sgst),"igst":rupees(igst),"total":rupees(total),"status":row.status,"document_hash":digest}
    store_idempotent(db,idempotency_key,"credit_note.issue",result); db.commit(); return result

@app.get("/api/v1/refunds")
def list_refunds(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(Refund).order_by(Refund.created_at.desc())).scalars()
    return [{"id":x.id,"payment_id":x.payment_id,"invoice_id":x.invoice_id,"credit_note_id":x.credit_note_id,"amount":rupees(x.amount_paise),"reason":x.reason,"external_reference":x.external_reference,"status":x.status,"refunded_date":x.refunded_date} for x in rows]

@app.post("/api/v1/payments/{payment_id}/refunds", status_code=201)
def create_refund(payment_id: str, payload: RefundCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE")), idempotency_key: str|None=Header(default=None,alias="Idempotency-Key")):
    cached=get_idempotent(db,idempotency_key,"refund.create")
    if cached:return JSONResponse(cached,status_code=200)
    pay=db.get(Payment,payment_id)
    if not pay: raise HTTPException(404,"Payment not found")
    amount=paise(payload.amount); refunded=sum(x.amount_paise for x in db.execute(select(Refund).where(Refund.payment_id==payment_id,Refund.status=="COMPLETED")).scalars())
    if refunded+amount>pay.amount_paise: raise HTTPException(422,"Refund exceeds available payment amount")
    if payload.credit_note_id and not db.get(CreditNote,payload.credit_note_id): raise HTTPException(404,"Credit note not found")
    row=Refund(id=uid("RFD"),payment_id=pay.id,invoice_id=pay.invoice_id,credit_note_id=payload.credit_note_id,amount_paise=amount,reason=payload.reason,external_reference=payload.external_reference,status="COMPLETED",refunded_date=payload.refunded_date)
    db.add(row); post_journal(db,"REFUND",row.id,f"Refund for payment {pay.id}",[{"account_code":"2100","debit_paise":amount},{"account_code":"1000","credit_paise":amount}],entry_date=payload.refunded_date,correlation_id=row.id)
    emit_event(db,"refund.completed","refund",row.id,{"payment_id":pay.id,"invoice_id":pay.invoice_id,"amount_paise":amount}); audit(db,ctx["actor"],ctx["role"],"refund.completed","refund",row.id,{"amount":rupees(amount)},"FINANCIAL")
    result={"id":row.id,"payment_id":pay.id,"invoice_id":pay.invoice_id,"credit_note_id":row.credit_note_id,"amount":rupees(amount),"status":row.status,"refunded_date":row.refunded_date}
    store_idempotent(db,idempotency_key,"refund.create",result); db.commit(); return result

@app.get("/api/v1/banking/accounts")
def list_bank_accounts(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","AUDITOR"))):
    rows=db.execute(select(BankAccount).order_by(BankAccount.created_at.desc())).scalars()
    return [{"id":x.id,"bank_name":x.bank_name,"account_name":x.account_name,"masked_account":x.masked_account,"ifsc":x.ifsc,"currency":x.currency,"purpose":x.purpose,"status":x.status} for x in rows]

@app.post("/api/v1/banking/accounts", status_code=201)
def create_bank_account(payload: BankAccountCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE"))):
    if len(payload.masked_account)<4: raise HTTPException(422,"Store only a masked account reference with at least last four digits")
    row=BankAccount(id=uid("BANK"),legal_entity_id=ENTITY_ID,bank_name=payload.bank_name,account_name=payload.account_name,masked_account=payload.masked_account,ifsc=payload.ifsc,purpose=payload.purpose,status="ACTIVE")
    db.add(row); audit(db,ctx["actor"],ctx["role"],"bank.account.registered","bank_account",row.id,{"bank_name":row.bank_name,"masked_account":row.masked_account},"SENSITIVE"); db.commit(); return {"id":row.id,"bank_name":row.bank_name,"account_name":row.account_name,"masked_account":row.masked_account,"ifsc":row.ifsc,"purpose":row.purpose,"status":row.status}

@app.post("/api/v1/banking/transactions", status_code=201)
def create_bank_transaction(payload: BankTransactionCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE","CA"))):
    if not db.get(BankAccount,payload.bank_account_id): raise HTTPException(404,"Bank account not found")
    row=BankTransaction(id=uid("BTX"),bank_account_id=payload.bank_account_id,transaction_date=payload.transaction_date,amount_paise=paise(payload.amount),direction=payload.direction,reference=payload.reference,description=payload.description,source=payload.source,match_status="UNMATCHED")
    db.add(row); emit_event(db,"bank.transaction.imported","bank_transaction",row.id,{"direction":row.direction,"amount_paise":row.amount_paise,"reference":row.reference}); audit(db,ctx["actor"],ctx["role"],"bank.transaction.imported","bank_transaction",row.id,{"reference":row.reference,"amount":rupees(row.amount_paise)},"FINANCIAL"); db.commit(); return {"id":row.id,"transaction_date":row.transaction_date,"amount":rupees(row.amount_paise),"direction":row.direction,"reference":row.reference,"match_status":row.match_status}

@app.post("/api/v1/banking/transactions/{transaction_id}/auto-match")
def auto_match_bank_transaction(transaction_id: str, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE","CA"))):
    tx=db.get(BankTransaction,transaction_id)
    if not tx: raise HTTPException(404,"Bank transaction not found")
    if tx.direction!="CREDIT": raise HTTPException(422,"Only credit transactions can currently auto-match customer payments")
    q=select(Payment).where(Payment.amount_paise==tx.amount_paise,Payment.status=="SUCCESS")
    candidates=[p for p in db.execute(q).scalars() if (not p.external_reference or p.external_reference==tx.reference)]
    if len(candidates)==1:
        tx.matched_payment_id=candidates[0].id; tx.match_status="MATCHED"
        emit_event(db,"bank.transaction.matched","bank_transaction",tx.id,{"payment_id":candidates[0].id}); audit(db,ctx["actor"],ctx["role"],"bank.transaction.matched","bank_transaction",tx.id,{"payment_id":candidates[0].id},"FINANCIAL"); db.commit(); return {"id":tx.id,"match_status":"MATCHED","payment_id":candidates[0].id}
    tx.match_status="REVIEW_REQUIRED"; db.commit(); return {"id":tx.id,"match_status":tx.match_status,"candidate_count":len(candidates)}

@app.get("/api/v1/banking/transactions")
def list_bank_transactions(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","AUDITOR"))):
    rows=db.execute(select(BankTransaction).order_by(BankTransaction.created_at.desc())).scalars()
    return [{"id":x.id,"bank_account_id":x.bank_account_id,"transaction_date":x.transaction_date,"amount":rupees(x.amount_paise),"direction":x.direction,"reference":x.reference,"description":x.description,"match_status":x.match_status,"matched_payment_id":x.matched_payment_id,"source":x.source} for x in rows]

@app.post("/api/v1/banking/settlements", status_code=201)
def create_settlement(payload: SettlementCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","FINANCE","CA"))):
    gross,fee,tax,net=map(paise,[payload.gross,payload.fee,payload.tax_on_fee,payload.net])
    if net != gross-fee-tax: raise HTTPException(422,"Settlement net must equal gross minus fee minus tax on fee")
    row=Settlement(id=uid("SETL"),provider=payload.provider,external_settlement_id=payload.external_settlement_id,gross_paise=gross,fee_paise=fee,tax_on_fee_paise=tax,net_paise=net,settlement_date=payload.settlement_date,status="UNMATCHED")
    db.add(row); emit_event(db,"settlement.received","settlement",row.id,{"provider":row.provider,"external_settlement_id":row.external_settlement_id,"net_paise":net}); audit(db,ctx["actor"],ctx["role"],"settlement.received","settlement",row.id,{"provider":row.provider,"net":rupees(net)},"FINANCIAL"); db.commit(); return {"id":row.id,"provider":row.provider,"external_settlement_id":row.external_settlement_id,"gross":rupees(gross),"fee":rupees(fee),"tax_on_fee":rupees(tax),"net":rupees(net),"status":row.status}

@app.get("/api/v1/approvals")
def list_approvals(db: Session=Depends(get_db), ctx=Depends(actor_context), status: str|None=Query(default=None)):
    q=select(ApprovalRequest).order_by(ApprovalRequest.created_at.desc())
    if status:q=q.where(ApprovalRequest.status==status)
    return [{"id":x.id,"action_type":x.action_type,"entity_type":x.entity_type,"entity_id":x.entity_id,"requested_by":x.requested_by,"required_role":x.required_role,"status":x.status,"reason":x.reason,"decided_by":x.decided_by,"decision_reason":x.decision_reason} for x in db.execute(q).scalars()]

@app.post("/api/v1/approvals", status_code=201)
def create_approval(payload: ApprovalCreate, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    role=payload.required_role.upper()
    if role not in KNOWN_ROLES: raise HTTPException(422,"Unknown required role")
    row=ApprovalRequest(id=uid("APR"),action_type=payload.action_type,entity_type=payload.entity_type,entity_id=payload.entity_id,requested_by=ctx["actor"],required_role=role,status="PENDING",reason=payload.reason)
    db.add(row); emit_event(db,"approval.requested","approval",row.id,{"action_type":row.action_type,"required_role":role}); audit(db,ctx["actor"],ctx["role"],"approval.requested","approval",row.id,{"action_type":row.action_type,"required_role":role},"CONTROL"); db.commit(); return {"id":row.id,"status":row.status,"required_role":row.required_role}

@app.post("/api/v1/approvals/{approval_id}/approve")
def approve_request(approval_id: str, payload: ApprovalDecision, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    row=db.get(ApprovalRequest,approval_id)
    if not row: raise HTTPException(404,"Approval request not found")
    if row.status!="PENDING": raise HTTPException(409,"Approval already decided")
    if row.required_role not in ctx["roles"] and "OWNER" not in ctx["roles"]: raise HTTPException(403,"Actor does not hold required approval authority")
    if row.requested_by==ctx["actor"]: raise HTTPException(409,"Maker-checker control: requester cannot approve own request")
    row.status="APPROVED"; row.decided_by=ctx["actor"]; row.decision_reason=payload.reason; row.decided_at=now_utc()
    emit_event(db,"approval.approved","approval",row.id,{"decided_by":row.decided_by}); audit(db,ctx["actor"],ctx["role"],"approval.approved","approval",row.id,{"action_type":row.action_type},"CONTROL"); db.commit(); return {"id":row.id,"status":row.status,"decided_by":row.decided_by}

@app.post("/api/v1/approvals/{approval_id}/reject")
def reject_request(approval_id: str, payload: ApprovalDecision, db: Session=Depends(get_db), ctx=Depends(actor_context)):
    row=db.get(ApprovalRequest,approval_id)
    if not row: raise HTTPException(404,"Approval request not found")
    if row.status!="PENDING": raise HTTPException(409,"Approval already decided")
    if row.required_role not in ctx["roles"] and "OWNER" not in ctx["roles"]: raise HTTPException(403,"Actor does not hold required approval authority")
    if row.requested_by==ctx["actor"]: raise HTTPException(409,"Maker-checker control: requester cannot decide own request")
    row.status="REJECTED"; row.decided_by=ctx["actor"]; row.decision_reason=payload.reason; row.decided_at=now_utc()
    emit_event(db,"approval.rejected","approval",row.id,{"decided_by":row.decided_by}); audit(db,ctx["actor"],ctx["role"],"approval.rejected","approval",row.id,{"action_type":row.action_type},"CONTROL"); db.commit(); return {"id":row.id,"status":row.status,"decided_by":row.decided_by}

@app.get("/api/v1/notices")
def list_notices(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","CA","CS","LEGAL","AUDITOR"))):
    rows=db.execute(select(NoticeCase).order_by(NoticeCase.created_at.desc())).scalars()
    return [{"id":x.id,"authority":x.authority,"reference_no":x.reference_no,"title":x.title,"received_date":x.received_date,"response_due_date":x.response_due_date,"risk":x.risk,"owner":x.owner,"status":x.status,"source_document_id":x.source_document_id} for x in rows]

@app.post("/api/v1/notices", status_code=201)
def create_notice(payload: NoticeCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","CA","CS","LEGAL"))):
    if payload.source_document_id and not db.get(Document,payload.source_document_id): raise HTTPException(404,"Source document not found")
    row=NoticeCase(id=uid("NOTICE"),authority=payload.authority,reference_no=payload.reference_no,title=payload.title,received_date=payload.received_date,response_due_date=payload.response_due_date,risk=payload.risk,owner=payload.owner,status="OPEN",source_document_id=payload.source_document_id,notes=payload.notes)
    db.add(row); emit_event(db,"notice.received","notice",row.id,{"authority":row.authority,"reference_no":row.reference_no,"response_due_date":row.response_due_date,"risk":row.risk}); audit(db,ctx["actor"],ctx["role"],"notice.received","notice",row.id,{"authority":row.authority,"reference_no":row.reference_no,"due":row.response_due_date},"HIGH"); db.commit(); return {"id":row.id,"authority":row.authority,"reference_no":row.reference_no,"status":row.status,"response_due_date":row.response_due_date,"risk":row.risk}

@app.get("/api/v1/inspections")
def list_inspections(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","CS","LEGAL","AUDITOR"))):
    rows=db.execute(select(InspectionCase).order_by(InspectionCase.created_at.desc())).scalars()
    return [{"id":x.id,"authority":x.authority,"reference_no":x.reference_no,"scope_text":x.scope_text,"period_start":x.period_start,"period_end":x.period_end,"status":x.status,"requested_by":x.requested_by,"owner":x.owner,"manifest":json.loads(x.manifest_json or '{}')} for x in rows]

@app.post("/api/v1/inspections", status_code=201)
def create_inspection(payload: InspectionCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","CS","LEGAL"))):
    row=InspectionCase(id=uid("INSP"),authority=payload.authority,reference_no=payload.reference_no,scope_text=payload.scope_text,period_start=payload.period_start,period_end=payload.period_end,status="OPEN",requested_by=payload.requested_by,owner=payload.owner,manifest_json="{}")
    db.add(row); emit_event(db,"inspection.opened","inspection",row.id,{"authority":row.authority,"scope":row.scope_text}); audit(db,ctx["actor"],ctx["role"],"inspection.opened","inspection",row.id,{"authority":row.authority,"scope":row.scope_text},"CONTROL"); db.commit(); return {"id":row.id,"authority":row.authority,"status":row.status,"scope_text":row.scope_text}

@app.post("/api/v1/inspections/{inspection_id}/build-manifest")
def build_inspection_manifest(inspection_id: str, document_ids: list[str], db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER","DIRECTOR","FINANCE","CA","CS","LEGAL"))):
    row=db.get(InspectionCase,inspection_id)
    if not row: raise HTTPException(404,"Inspection not found")
    items=[]; warnings=[]
    for did in document_ids:
        doc=db.get(Document,did)
        if not doc: warnings.append({"document_id":did,"warning":"NOT_FOUND"}); continue
        ver=db.execute(select(DocumentVersion).where(DocumentVersion.document_id==doc.id,DocumentVersion.version_no==doc.current_version)).scalar_one_or_none()
        if not ver: warnings.append({"document_id":did,"warning":"NO_VERSION"}); continue
        if not doc.locked: warnings.append({"document_id":did,"warning":"NOT_LOCKED"})
        items.append({"document_id":doc.id,"title":doc.title,"document_type":doc.document_type,"version":doc.current_version,"sha256":ver.sha256,"filename":ver.filename,"locked":doc.locked})
    manifest={"inspection_id":row.id,"authority":row.authority,"scope":row.scope_text,"generated_at":now_utc().isoformat(),"generated_by":ctx["actor"],"documents":items,"warnings":warnings,"readiness":"READY" if not warnings else "READY_WITH_WARNINGS"}
    row.manifest_json=json.dumps(manifest,sort_keys=True); emit_event(db,"inspection.manifest.generated","inspection",row.id,{"document_count":len(items),"warning_count":len(warnings)}); audit(db,ctx["actor"],ctx["role"],"inspection.manifest.generated","inspection",row.id,{"document_count":len(items),"warning_count":len(warnings)},"CONTROL"); db.commit(); return manifest

@app.get("/api/v1/integrations")
def list_integrations(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    rows=db.execute(select(IntegrationRecord).order_by(IntegrationRecord.provider)).scalars()
    return [{"id":x.id,"provider":x.provider,"integration_type":x.integration_type,"environment":x.environment,"status":x.status,"owner":x.owner,"last_verified_at":x.last_verified_at.isoformat() if x.last_verified_at else None,"config":json.loads(x.config_json or '{}')} for x in rows]

@app.post("/api/v1/integrations", status_code=201)
def create_integration(payload: IntegrationCreate, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER"))):
    safe_config={k:v for k,v in payload.config.items() if (k.lower().endswith("_reference") or not any(token in k.lower() for token in ("password","secret","token","private_key","api_key")))}
    if len(safe_config)!=len(payload.config): raise HTTPException(422,"Secrets must be stored in the approved secret manager; registry accepts references only")
    row=IntegrationRecord(id=uid("INT"),provider=payload.provider,integration_type=payload.integration_type,environment=payload.environment,status=payload.status,owner=payload.owner,config_json=json.dumps(safe_config,sort_keys=True))
    db.add(row); audit(db,ctx["actor"],ctx["role"],"integration.registered","integration",row.id,{"provider":row.provider,"type":row.integration_type,"status":row.status},"CONTROL"); db.commit(); return {"id":row.id,"provider":row.provider,"integration_type":row.integration_type,"environment":row.environment,"status":row.status,"owner":row.owner,"config":safe_config}

@app.get("/api/v1/command-center")
def command_center(db: Session=Depends(get_db), ctx=Depends(actor_context)):
    invoices=db.execute(select(Invoice)).scalars().all(); payments=db.execute(select(Payment).where(Payment.status=="SUCCESS")).scalars().all()
    notices=db.execute(select(NoticeCase).where(NoticeCase.status=="OPEN")).scalars().all(); approvals=db.execute(select(ApprovalRequest).where(ApprovalRequest.status=="PENDING")).scalars().all(); unmatched=db.execute(select(BankTransaction).where(BankTransaction.match_status!="MATCHED")).scalars().all()
    return {
        "financial":{"issued_invoice_value":rupees(sum(x.total_paise for x in invoices)),"collected":rupees(sum(x.amount_paise for x in payments)),"receivables":rupees(sum(x.balance_paise for x in invoices))},
        "attention":{"open_notices":len(notices),"pending_approvals":len(approvals),"unmatched_bank_transactions":len(unmatched),"pending_events":db.scalar(select(func.count()).select_from(DomainEvent).where(DomainEvent.status=="PENDING")) or 0},
        "records":{"customers":db.scalar(select(func.count()).select_from(Customer)) or 0,"products":db.scalar(select(func.count()).select_from(Product)) or 0,"subscriptions":db.scalar(select(func.count()).select_from(Subscription)) or 0,"documents":db.scalar(select(func.count()).select_from(Document)) or 0},
        "source":"KRAVIA Office canonical database; no fabricated cash/bank values"
    }

# Serve the production-style Office web shell from a dedicated public directory only.
# Private evidence/document storage is deliberately outside this mount.
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
WEB_DIR=(Path(__file__).resolve().parents[1]/"web").resolve()
if WEB_DIR.exists():
    app.mount("/office", StaticFiles(directory=str(WEB_DIR), html=True), name="office-web")

@app.get("/", include_in_schema=False)
def office_root():
    return RedirectResponse(url="/office/")
