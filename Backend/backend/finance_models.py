"""Persistence models for KRAVIA Office Finance & Ownership.

This bounded domain deliberately keeps legal ownership, shareholder funding,
company expenses, mandates and provider payment execution as separate records.
"""
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)

from .database import Base


class ShareClass(Base):
    __tablename__ = "share_classes"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    code = Column(String(24), nullable=False)
    name = Column(String(120), nullable=False)
    face_value_paise = Column(Integer, nullable=False)
    authorised_shares = Column(Integer, nullable=False)
    voting_rights_per_share = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="ACTIVE")
    source_document_ref = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("legal_entity_id", "code", name="uq_share_class_entity_code"),
        CheckConstraint("face_value_paise > 0", name="ck_share_class_face_value_positive"),
        CheckConstraint("authorised_shares >= 0", name="ck_share_class_authorised_nonnegative"),
        CheckConstraint("voting_rights_per_share >= 0", name="ck_share_class_votes_nonnegative"),
    )


class Shareholder(Base):
    __tablename__ = "shareholders"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    shareholder_no = Column(String(50), nullable=False)
    legal_name = Column(String(200), nullable=False)
    folio_no = Column(String(80), nullable=True)
    email = Column(String(320), nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    source_document_ref = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("legal_entity_id", "shareholder_no", name="uq_shareholder_entity_number"),
        UniqueConstraint("legal_entity_id", "folio_no", name="uq_shareholder_entity_folio"),
    )


class ShareLedgerEntry(Base):
    __tablename__ = "share_ledger_entries"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    shareholder_id = Column(String, ForeignKey("shareholders.id"), nullable=False)
    share_class_id = Column(String, ForeignKey("share_classes.id"), nullable=False)
    entry_type = Column(String(30), nullable=False)
    quantity_delta = Column(Integer, nullable=False)
    instrument_date = Column(String(10), nullable=False)
    certificate_no = Column(String(80), nullable=True)
    counterparty_ref = Column(String(160), nullable=True)
    idempotency_key = Column(String(160), nullable=False, unique=True)
    source_document_ref = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    posted_by = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("quantity_delta <> 0", name="ck_share_ledger_quantity_nonzero"),
        Index("ix_share_ledger_holder_class_date", "shareholder_id", "share_class_id", "instrument_date"),
    )


class ShareChangeRequest(Base):
    __tablename__ = "share_change_requests"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    shareholder_id = Column(String, ForeignKey("shareholders.id"), nullable=False)
    share_class_id = Column(String, ForeignKey("share_classes.id"), nullable=False)
    entry_type = Column(String(30), nullable=False)
    quantity_delta = Column(Integer, nullable=False)
    instrument_date = Column(String(10), nullable=False)
    certificate_no = Column(String(80), nullable=True)
    counterparty_ref = Column(String(160), nullable=True)
    source_document_ref = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    idempotency_key = Column(String(160), nullable=False, unique=True)
    payload_hash = Column(String(64), nullable=False)
    status = Column(String(30), nullable=False, default="PENDING_APPROVAL")
    requested_by = Column(String(200), nullable=False)
    approval_request_id = Column(String, ForeignKey("approval_requests.id"), nullable=True)
    posted_ledger_entry_id = Column(String, ForeignKey("share_ledger_entries.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        CheckConstraint("quantity_delta <> 0", name="ck_share_change_quantity_nonzero"),
        Index("ix_share_change_status_created", "status", "created_at"),
    )


class ShareTransferRequest(Base):
    __tablename__ = "share_transfer_requests"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    from_shareholder_id = Column(String, ForeignKey("shareholders.id"), nullable=False)
    to_shareholder_id = Column(String, ForeignKey("shareholders.id"), nullable=False)
    share_class_id = Column(String, ForeignKey("share_classes.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    instrument_date = Column(String(10), nullable=False)
    source_document_ref = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    idempotency_key = Column(String(160), nullable=False, unique=True)
    payload_hash = Column(String(64), nullable=False)
    status = Column(String(30), nullable=False, default="PENDING_APPROVAL")
    requested_by = Column(String(200), nullable=False)
    approval_request_id = Column(String, ForeignKey("approval_requests.id"), nullable=True)
    out_ledger_entry_id = Column(String, ForeignKey("share_ledger_entries.id"), nullable=True)
    in_ledger_entry_id = Column(String, ForeignKey("share_ledger_entries.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_share_transfer_quantity_positive"),
        CheckConstraint("from_shareholder_id <> to_shareholder_id", name="ck_share_transfer_distinct_holders"),
        Index("ix_share_transfer_status_created", "status", "created_at"),
    )


class FundingPolicy(Base):
    __tablename__ = "funding_policies"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    name = Column(String(160), nullable=False)
    allocation_basis = Column(String(30), nullable=False)
    custom_weights_json = Column(Text, nullable=False, default="{}")
    frequency = Column(String(30), nullable=False, default="AS_NEEDED")
    max_call_paise = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="DRAFT")
    source_document_ref = Column(Text, nullable=False)
    approved_by = Column(String(200), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("max_call_paise IS NULL OR max_call_paise > 0", name="ck_funding_policy_max_positive"),
    )


class ExpenseObligation(Base):
    __tablename__ = "expense_obligations"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    reference = Column(String(100), nullable=False, unique=True)
    title = Column(String(240), nullable=False)
    category = Column(String(120), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    due_date = Column(String(10), nullable=True)
    funding_mode = Column(String(30), nullable=False, default="COMPANY_FUNDS")
    funding_policy_id = Column(String, ForeignKey("funding_policies.id"), nullable=True)
    source_document_ref = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    idempotency_key = Column(String(160), nullable=False, unique=True)
    payload_hash = Column(String(64), nullable=False)
    status = Column(String(30), nullable=False, default="PENDING_APPROVAL")
    requested_by = Column(String(200), nullable=False)
    approval_request_id = Column(String, ForeignKey("approval_requests.id"), nullable=True)
    approved_by = Column(String(200), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_expense_obligation_amount_positive"),
        Index("ix_expense_obligation_status_due", "status", "due_date"),
    )


class PaymentMandate(Base):
    __tablename__ = "payment_mandates"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    shareholder_id = Column(String, ForeignKey("shareholders.id"), nullable=False)
    provider = Column(String(50), nullable=False)
    purpose = Column(String(240), nullable=False)
    status = Column(String(30), nullable=False, default="DRAFT")
    max_amount_paise = Column(Integer, nullable=False)
    frequency = Column(String(30), nullable=False)
    provider_customer_ref = Column(String(160), nullable=True)
    provider_mandate_ref = Column(String(160), nullable=True)
    authorisation_url = Column(Text, nullable=True)
    valid_from = Column(String(10), nullable=True)
    valid_until = Column(String(10), nullable=True)
    consented_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    source_document_ref = Column(Text, nullable=True)
    created_by = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("max_amount_paise > 0", name="ck_payment_mandate_max_positive"),
        Index("ix_payment_mandate_holder_status", "shareholder_id", "status"),
    )


class ContributionCall(Base):
    __tablename__ = "contribution_calls"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    expense_id = Column(String, ForeignKey("expense_obligations.id"), nullable=False, unique=True)
    funding_policy_id = Column(String, ForeignKey("funding_policies.id"), nullable=False)
    total_paise = Column(Integer, nullable=False)
    due_date = Column(String(10), nullable=True)
    status = Column(String(20), nullable=False, default="ISSUED")
    created_by = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (CheckConstraint("total_paise > 0", name="ck_contribution_call_total_positive"),)


class ContributionAllocation(Base):
    __tablename__ = "contribution_allocations"
    id = Column(String, primary_key=True)
    call_id = Column(String, ForeignKey("contribution_calls.id"), nullable=False)
    shareholder_id = Column(String, ForeignKey("shareholders.id"), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    weight_bps = Column(Integer, nullable=False)
    collected_paise = Column(Integer, nullable=False, default=0)
    mandate_id = Column(String, ForeignKey("payment_mandates.id"), nullable=True)
    status = Column(String(20), nullable=False, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("call_id", "shareholder_id", name="uq_contribution_call_shareholder"),
        CheckConstraint("amount_paise >= 0", name="ck_contribution_allocation_amount_nonnegative"),
        CheckConstraint("collected_paise >= 0", name="ck_contribution_allocation_collected_nonnegative"),
        CheckConstraint("weight_bps >= 0 AND weight_bps <= 10000", name="ck_contribution_allocation_weight_range"),
    )


class PaymentInstruction(Base):
    __tablename__ = "payment_instructions"
    id = Column(String, primary_key=True)
    legal_entity_id = Column(String, ForeignKey("legal_entities.id"), nullable=False)
    direction = Column(String(20), nullable=False)
    expense_id = Column(String, ForeignKey("expense_obligations.id"), nullable=True)
    allocation_id = Column(String, ForeignKey("contribution_allocations.id"), nullable=True)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    bank_account_id = Column(String, ForeignKey("bank_accounts.id"), nullable=True)
    mandate_id = Column(String, ForeignKey("payment_mandates.id"), nullable=True)
    amount_paise = Column(Integer, nullable=False)
    provider = Column(String(50), nullable=False)
    provider_destination_ref = Column(String(200), nullable=True)
    idempotency_key = Column(String(160), nullable=False, unique=True)
    payload_hash = Column(String(64), nullable=False)
    status = Column(String(30), nullable=False, default="PENDING_APPROVAL")
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    requested_by = Column(String(200), nullable=False)
    approved_by = Column(String(200), nullable=True)
    provider_reference = Column(String(200), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_payment_instruction_amount_positive"),
        Index("ix_payment_instruction_status_schedule", "status", "scheduled_for"),
    )


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"
    id = Column(String, primary_key=True)
    instruction_id = Column(String, ForeignKey("payment_instructions.id"), nullable=False)
    attempt_no = Column(Integer, nullable=False)
    provider = Column(String(50), nullable=False)
    request_digest = Column(String(64), nullable=False)
    provider_reference = Column(String(200), nullable=True)
    status = Column(String(30), nullable=False)
    http_status = Column(Integer, nullable=True)
    failure_code = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("instruction_id", "attempt_no", name="uq_payment_attempt_instruction_no"),)


class FinanceProviderEvent(Base):
    __tablename__ = "finance_provider_events"
    id = Column(String, primary_key=True)
    provider = Column(String(50), nullable=False)
    provider_event_id = Column(String(200), nullable=False)
    event_type = Column(String(120), nullable=False)
    signature_verified = Column(Boolean, nullable=False, default=False)
    payload_digest = Column(String(64), nullable=False)
    processing_status = Column(String(30), nullable=False, default="RECEIVED")
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("provider", "provider_event_id", name="uq_finance_provider_event"),)


FINANCE_OWNERSHIP_TABLES = (
    "share_classes",
    "shareholders",
    "share_ledger_entries",
    "share_change_requests",
    "share_transfer_requests",
    "funding_policies",
    "expense_obligations",
    "payment_mandates",
    "contribution_calls",
    "contribution_allocations",
    "payment_instructions",
    "payment_attempts",
    "finance_provider_events",
)
