from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class LegalEntity(Base):
    __tablename__ = "legal_entities"
    id = Column(String, primary_key=True)
    legal_name = Column(String, nullable=False)
    cin = Column(String, nullable=False, unique=True)
    registered_office = Column(Text, nullable=False)
    state_code = Column(String, nullable=True)
    status = Column(String, nullable=False, default="PARTIALLY_VERIFIED")
    source_ref = Column(String, nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True)
    code = Column(String(5), nullable=False, unique=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    status = Column(String, nullable=False, default="ACTIVE_CONFIG")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(String, primary_key=True)
    legal_name = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    gstin = Column(String(15), nullable=True)
    state = Column(String, nullable=False)
    state_code = Column(String(2), nullable=False)
    country = Column(String, nullable=False, default="India")
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    billing_address = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    product_code = Column(String(5), nullable=False)
    financial_year = Column(String(4), nullable=False)
    current_value = Column(Integer, nullable=False, default=0)
    __table_args__ = (UniqueConstraint("legal_entity_id","product_code","financial_year",name="uq_invoice_sequence"),)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True)
    invoice_no = Column(String(16), nullable=False, unique=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    status = Column(String, nullable=False, default="ISSUED")
    issued_at = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    sac = Column(String, nullable=True)
    qty_milli = Column(Integer, nullable=False, default=1000)
    taxable_paise = Column(Integer, nullable=False)
    discount_paise = Column(Integer, nullable=False, default=0)
    net_taxable_paise = Column(Integer, nullable=False)
    gst_rate_bps = Column(Integer, nullable=False, default=1800)
    cgst_paise = Column(Integer, nullable=False, default=0)
    sgst_paise = Column(Integer, nullable=False, default=0)
    igst_paise = Column(Integer, nullable=False, default=0)
    total_paise = Column(Integer, nullable=False)
    paid_paise = Column(Integer, nullable=False, default=0)
    balance_paise = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    snapshot_json = Column(Text, nullable=False)
    source = Column(String, nullable=False, default="KRAVIA Office Billing Engine")
    notes = Column(Text, nullable=True)
    document_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (Index("ix_invoices_customer_issued", "customer_id", "issued_at"),)

class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    method = Column(String, nullable=False)
    external_reference = Column(String, nullable=True)
    received_date = Column(String, nullable=False)
    status = Column(String, nullable=False, default="SUCCESS")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("method","external_reference",name="uq_payment_external_ref"),)

class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(String, primary_key=True)
    receipt_no = Column(String, nullable=False, unique=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    payment_id = Column(String, ForeignKey("payments.id"), nullable=False, unique=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    idempotency_key = Column(String, nullable=False)
    operation = Column(String, nullable=False)
    response_json = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("idempotency_key","operation",name="uq_idempotency_operation"),)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id = Column(String, primary_key=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    correlation_id = Column(String, nullable=True)
    detail_json = Column(Text, nullable=False)
    severity = Column(String, nullable=False, default="INFO")
    previous_hash = Column(String(64), nullable=True)
    event_hash = Column(String(64), nullable=True)
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"), Index("ux_audit_event_hash", "event_hash", unique=True))

class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id = Column(String, primary_key=True)
    workflow_code = Column(String, nullable=False)
    source_entity = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    status = Column(String, nullable=False)
    steps_json = Column(Text, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

class ComplianceObligation(Base):
    __tablename__ = "compliance_obligations"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    title = Column(String, nullable=False)
    authority = Column(String, nullable=False)
    status = Column(String, nullable=False)
    due_date = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    evidence_ref = Column(String, nullable=True)
    risk = Column(String, nullable=False, default="MEDIUM")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class DomainEvent(Base):
    __tablename__ = "event_outbox"
    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False)
    aggregate_type = Column(String, nullable=False)
    aggregate_id = Column(String, nullable=False)
    payload_json = Column(Text, nullable=False)
    correlation_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="PENDING")
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (Index("ix_outbox_status_created", "status", "created_at"),)

class ChartAccount(Base):
    __tablename__ = "chart_accounts"
    code = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    account_type = Column(String, nullable=False)
    normal_balance = Column(String, nullable=False)
    active = Column(Boolean, nullable=False, default=True)

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(String, primary_key=True)
    entry_date = Column(String, nullable=False)
    memo = Column(Text, nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    correlation_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="POSTED")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("source_type","source_id",name="uq_journal_source"),)

class JournalLine(Base):
    __tablename__ = "journal_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id = Column(String, ForeignKey("journal_entries.id"), nullable=False)
    account_code = Column(String, ForeignKey("chart_accounts.code"), nullable=False)
    debit_paise = Column(Integer, nullable=False, default=0)
    credit_paise = Column(Integer, nullable=False, default=0)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=True)
    memo = Column(Text, nullable=True)

class BoardMeeting(Base):
    __tablename__ = "board_meetings"
    id = Column(String, primary_key=True)
    meeting_no = Column(String, nullable=False, unique=True)
    meeting_date = Column(String, nullable=False)
    title = Column(String, nullable=False)
    status = Column(String, nullable=False, default="DRAFT")
    notice_document_ref = Column(String, nullable=True)
    minutes_document_ref = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Resolution(Base):
    __tablename__ = "resolutions"
    id = Column(String, primary_key=True)
    resolution_no = Column(String, nullable=False, unique=True)
    meeting_id = Column(String, ForeignKey("board_meetings.id"), nullable=False)
    agenda_item = Column(String, nullable=False)
    title = Column(String, nullable=False)
    resolution_text = Column(Text, nullable=False)
    authority_scope = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="APPROVED")
    approved_date = Column(String, nullable=False)
    content_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class AuthorityGrant(Base):
    __tablename__ = "authority_grants"
    id = Column(String, primary_key=True)
    authority_no = Column(String, nullable=False, unique=True)
    resolution_id = Column(String, ForeignKey("resolutions.id"), nullable=False)
    grantee = Column(String, nullable=False)
    purpose = Column(String, nullable=False)
    scope_text = Column(Text, nullable=False)
    effective_date = Column(String, nullable=False)
    expiry_date = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(String, primary_key=True)
    legal_name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    gstin = Column(String(15), nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    risk = Column(String, nullable=False, default="MEDIUM")
    products_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String, primary_key=True)
    contract_no = Column(String, nullable=False, unique=True)
    contract_type = Column(String, nullable=False)
    counterparty_name = Column(String, nullable=False)
    product_codes_json = Column(Text, nullable=False, default="[]")
    effective_date = Column(String, nullable=False)
    expiry_date = Column(String, nullable=True)
    notice_days = Column(Integer, nullable=True)
    value_paise = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    document_ref = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Employee(Base):
    __tablename__ = "employees"
    id = Column(String, primary_key=True)
    employee_no = Column(String, nullable=False, unique=True)
    legal_name = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    department = Column(String, nullable=True)
    work_email = Column(String, nullable=True, unique=True)
    joining_date = Column(String, nullable=False)
    exit_date = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class OfficeAsset(Base):
    __tablename__ = "office_assets"
    id = Column(String, primary_key=True)
    asset_no = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    serial_no = Column(String, nullable=True, unique=True)
    assigned_employee_id = Column(String, ForeignKey("employees.id"), nullable=True)
    location = Column(String, nullable=True)
    purchase_paise = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    area = Column(String, nullable=False)
    status = Column(String, nullable=False, default="DRAFT")
    source = Column(String, nullable=False)
    current_version = Column(Integer, nullable=False, default=1)
    locked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id = Column(String, primary_key=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    version_no = Column(Integer, nullable=False)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_path = Column(Text, nullable=False)
    immutable = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("document_id","version_no",name="uq_document_version"),)

class ControlledSequence(Base):
    __tablename__ = "controlled_sequences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    document_type = Column(String, nullable=False)
    prefix = Column(String(5), nullable=False)
    financial_year = Column(String(4), nullable=False)
    current_value = Column(Integer, nullable=False, default=0)
    __table_args__ = (UniqueConstraint("legal_entity_id","document_type","prefix","financial_year",name="uq_controlled_sequence"),)

class CommercialPlan(Base):
    __tablename__ = "commercial_plans"
    id = Column(String, primary_key=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    billing_cycle = Column(String, nullable=False)
    price_paise = Column(Integer, nullable=False)
    gst_rate_bps = Column(Integer, nullable=False, default=1800)
    sac = Column(String, nullable=True)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String, nullable=False, default="ACTIVE")
    effective_from = Column(String, nullable=False)
    effective_to = Column(String, nullable=True)
    config_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("product_id","code","effective_from",name="uq_plan_version"),)

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(String, primary_key=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    plan_id = Column(String, ForeignKey("commercial_plans.id"), nullable=False)
    status = Column(String, nullable=False, default="ACTIVE")
    started_at = Column(String, nullable=False)
    current_period_start = Column(String, nullable=False)
    current_period_end = Column(String, nullable=False)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False)
    external_reference = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class CreditNote(Base):
    __tablename__ = "credit_notes"
    id = Column(String, primary_key=True)
    credit_note_no = Column(String(16), nullable=False, unique=True)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    reason = Column(Text, nullable=False)
    net_taxable_paise = Column(Integer, nullable=False)
    cgst_paise = Column(Integer, nullable=False, default=0)
    sgst_paise = Column(Integer, nullable=False, default=0)
    igst_paise = Column(Integer, nullable=False, default=0)
    total_paise = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="ISSUED")
    issued_at = Column(DateTime(timezone=True), nullable=False)
    document_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Refund(Base):
    __tablename__ = "refunds"
    id = Column(String, primary_key=True)
    payment_id = Column(String, ForeignKey("payments.id"), nullable=False)
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False)
    credit_note_id = Column(String, ForeignKey("credit_notes.id"), nullable=True)
    amount_paise = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    external_reference = Column(String, nullable=True)
    status = Column(String, nullable=False, default="COMPLETED")
    refunded_date = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("external_reference",name="uq_refund_external_ref"),)

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    bank_name = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    masked_account = Column(String, nullable=False)
    ifsc = Column(String, nullable=True)
    currency = Column(String(3), nullable=False, default="INR")
    purpose = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    id = Column(String, primary_key=True)
    bank_account_id = Column(String, ForeignKey("bank_accounts.id"), nullable=False)
    transaction_date = Column(String, nullable=False)
    amount_paise = Column(Integer, nullable=False)
    direction = Column(String, nullable=False)
    reference = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    match_status = Column(String, nullable=False, default="UNMATCHED")
    matched_payment_id = Column(String, ForeignKey("payments.id"), nullable=True)
    source = Column(String, nullable=False, default="MANUAL_IMPORT")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("bank_account_id","reference","amount_paise",name="uq_bank_tx_ref_amount"),)

class Settlement(Base):
    __tablename__ = "settlements"
    id = Column(String, primary_key=True)
    provider = Column(String, nullable=False)
    external_settlement_id = Column(String, nullable=False, unique=True)
    gross_paise = Column(Integer, nullable=False)
    fee_paise = Column(Integer, nullable=False, default=0)
    tax_on_fee_paise = Column(Integer, nullable=False, default=0)
    net_paise = Column(Integer, nullable=False)
    settlement_date = Column(String, nullable=False)
    bank_transaction_id = Column(String, ForeignKey("bank_transactions.id"), nullable=True)
    status = Column(String, nullable=False, default="UNMATCHED")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id = Column(String, primary_key=True)
    action_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    requested_by = Column(String, nullable=False)
    required_role = Column(String, nullable=False)
    status = Column(String, nullable=False, default="PENDING")
    reason = Column(Text, nullable=True)
    decided_by = Column(String, nullable=True)
    decision_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    decided_at = Column(DateTime(timezone=True), nullable=True)

class NoticeCase(Base):
    __tablename__ = "notice_cases"
    id = Column(String, primary_key=True)
    authority = Column(String, nullable=False)
    reference_no = Column(String, nullable=False, unique=True)
    title = Column(String, nullable=False)
    received_date = Column(String, nullable=False)
    response_due_date = Column(String, nullable=True)
    risk = Column(String, nullable=False, default="HIGH")
    owner = Column(String, nullable=True)
    status = Column(String, nullable=False, default="OPEN")
    source_document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class InspectionCase(Base):
    __tablename__ = "inspection_cases"
    id = Column(String, primary_key=True)
    authority = Column(String, nullable=False)
    reference_no = Column(String, nullable=True)
    scope_text = Column(Text, nullable=False)
    period_start = Column(String, nullable=True)
    period_end = Column(String, nullable=True)
    status = Column(String, nullable=False, default="OPEN")
    requested_by = Column(String, nullable=True)
    owner = Column(String, nullable=True)
    manifest_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)

class IntegrationRecord(Base):
    __tablename__ = "integration_registry"
    id = Column(String, primary_key=True)
    provider = Column(String, nullable=False)
    integration_type = Column(String, nullable=False)
    environment = Column(String, nullable=False, default="production")
    status = Column(String, nullable=False, default="NOT_CONNECTED")
    owner = Column(String, nullable=True)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    config_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class OperationalAlert(Base):
    __tablename__ = "operational_alerts"
    id = Column(String, primary_key=True)
    alert_key = Column(String, nullable=False, unique=True)
    category = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    title = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    due_date = Column(String, nullable=True)
    status = Column(String, nullable=False, default="OPEN")
    detail_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
