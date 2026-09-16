"""v4 finance ownership and controlled treasury

Revision ID: 8f3a1c9e4b27
Revises: 7908cb4588e7
Create Date: 2026-09-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8f3a1c9e4b27"
down_revision: Union[str, Sequence[str], None] = "7908cb4588e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "share_classes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("code", sa.String(length=24), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("face_value_paise", sa.Integer(), nullable=False),
        sa.Column("authorised_shares", sa.Integer(), nullable=False),
        sa.Column("voting_rights_per_share", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source_document_ref", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("face_value_paise > 0", name="ck_share_class_face_value_positive"),
        sa.CheckConstraint("authorised_shares >= 0", name="ck_share_class_authorised_nonnegative"),
        sa.CheckConstraint("voting_rights_per_share >= 0", name="ck_share_class_votes_nonnegative"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legal_entity_id", "code", name="uq_share_class_entity_code"),
    )
    op.create_table(
        "shareholders",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("shareholder_no", sa.String(length=50), nullable=False),
        sa.Column("legal_name", sa.String(length=200), nullable=False),
        sa.Column("folio_no", sa.String(length=80), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source_document_ref", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legal_entity_id", "shareholder_no", name="uq_shareholder_entity_number"),
        sa.UniqueConstraint("legal_entity_id", "folio_no", name="uq_shareholder_entity_folio"),
    )
    op.create_table(
        "share_ledger_entries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("shareholder_id", sa.String(), nullable=False),
        sa.Column("share_class_id", sa.String(), nullable=False),
        sa.Column("entry_type", sa.String(length=30), nullable=False),
        sa.Column("quantity_delta", sa.Integer(), nullable=False),
        sa.Column("instrument_date", sa.String(length=10), nullable=False),
        sa.Column("certificate_no", sa.String(length=80), nullable=True),
        sa.Column("counterparty_ref", sa.String(length=160), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("source_document_ref", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("posted_by", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity_delta <> 0", name="ck_share_ledger_quantity_nonzero"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["shareholder_id"], ["shareholders.id"]),
        sa.ForeignKeyConstraint(["share_class_id"], ["share_classes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_share_ledger_idempotency_key"),
    )
    op.create_index("ix_share_ledger_holder_class_date", "share_ledger_entries", ["shareholder_id", "share_class_id", "instrument_date"], unique=False)
    op.create_table(
        "share_change_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("shareholder_id", sa.String(), nullable=False),
        sa.Column("share_class_id", sa.String(), nullable=False),
        sa.Column("entry_type", sa.String(length=30), nullable=False),
        sa.Column("quantity_delta", sa.Integer(), nullable=False),
        sa.Column("instrument_date", sa.String(length=10), nullable=False),
        sa.Column("certificate_no", sa.String(length=80), nullable=True),
        sa.Column("counterparty_ref", sa.String(length=160), nullable=True),
        sa.Column("source_document_ref", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("requested_by", sa.String(length=200), nullable=False),
        sa.Column("approval_request_id", sa.String(), nullable=True),
        sa.Column("posted_ledger_entry_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity_delta <> 0", name="ck_share_change_quantity_nonzero"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["shareholder_id"], ["shareholders.id"]),
        sa.ForeignKeyConstraint(["share_class_id"], ["share_classes.id"]),
        sa.ForeignKeyConstraint(["approval_request_id"], ["approval_requests.id"]),
        sa.ForeignKeyConstraint(["posted_ledger_entry_id"], ["share_ledger_entries.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_share_change_idempotency_key"),
    )
    op.create_index("ix_share_change_status_created", "share_change_requests", ["status", "created_at"], unique=False)
    op.create_table(
        "share_transfer_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("from_shareholder_id", sa.String(), nullable=False),
        sa.Column("to_shareholder_id", sa.String(), nullable=False),
        sa.Column("share_class_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("instrument_date", sa.String(length=10), nullable=False),
        sa.Column("source_document_ref", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("requested_by", sa.String(length=200), nullable=False),
        sa.Column("approval_request_id", sa.String(), nullable=True),
        sa.Column("out_ledger_entry_id", sa.String(), nullable=True),
        sa.Column("in_ledger_entry_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity > 0", name="ck_share_transfer_quantity_positive"),
        sa.CheckConstraint("from_shareholder_id <> to_shareholder_id", name="ck_share_transfer_distinct_holders"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["from_shareholder_id"], ["shareholders.id"]),
        sa.ForeignKeyConstraint(["to_shareholder_id"], ["shareholders.id"]),
        sa.ForeignKeyConstraint(["share_class_id"], ["share_classes.id"]),
        sa.ForeignKeyConstraint(["approval_request_id"], ["approval_requests.id"]),
        sa.ForeignKeyConstraint(["out_ledger_entry_id"], ["share_ledger_entries.id"]),
        sa.ForeignKeyConstraint(["in_ledger_entry_id"], ["share_ledger_entries.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_share_transfer_idempotency_key"),
    )
    op.create_index("ix_share_transfer_status_created", "share_transfer_requests", ["status", "created_at"], unique=False)
    op.create_table(
        "funding_policies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("allocation_basis", sa.String(length=30), nullable=False),
        sa.Column("custom_weights_json", sa.Text(), nullable=False),
        sa.Column("frequency", sa.String(length=30), nullable=False),
        sa.Column("max_call_paise", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("source_document_ref", sa.Text(), nullable=False),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("max_call_paise IS NULL OR max_call_paise > 0", name="ck_funding_policy_max_positive"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "expense_obligations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("vendor_id", sa.String(), nullable=True),
        sa.Column("reference", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.String(length=10), nullable=True),
        sa.Column("funding_mode", sa.String(length=30), nullable=False),
        sa.Column("funding_policy_id", sa.String(), nullable=True),
        sa.Column("source_document_ref", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("requested_by", sa.String(length=200), nullable=False),
        sa.Column("approval_request_id", sa.String(), nullable=True),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount_paise > 0", name="ck_expense_obligation_amount_positive"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"]),
        sa.ForeignKeyConstraint(["funding_policy_id"], ["funding_policies.id"]),
        sa.ForeignKeyConstraint(["approval_request_id"], ["approval_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("reference", name="uq_expense_obligation_reference"),
        sa.UniqueConstraint("idempotency_key", name="uq_expense_obligation_idempotency_key"),
    )
    op.create_index("ix_expense_obligation_status_due", "expense_obligations", ["status", "due_date"], unique=False)
    op.create_table(
        "payment_mandates",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("shareholder_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("purpose", sa.String(length=240), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("max_amount_paise", sa.Integer(), nullable=False),
        sa.Column("frequency", sa.String(length=30), nullable=False),
        sa.Column("provider_customer_ref", sa.String(length=160), nullable=True),
        sa.Column("provider_mandate_ref", sa.String(length=160), nullable=True),
        sa.Column("authorisation_url", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.String(length=10), nullable=True),
        sa.Column("valid_until", sa.String(length=10), nullable=True),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("source_document_ref", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("max_amount_paise > 0", name="ck_payment_mandate_max_positive"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["shareholder_id"], ["shareholders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_mandate_holder_status", "payment_mandates", ["shareholder_id", "status"], unique=False)
    op.create_table(
        "contribution_calls",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("expense_id", sa.String(), nullable=False),
        sa.Column("funding_policy_id", sa.String(), nullable=False),
        sa.Column("total_paise", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.String(length=10), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_by", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("total_paise > 0", name="ck_contribution_call_total_positive"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["expense_id"], ["expense_obligations.id"]),
        sa.ForeignKeyConstraint(["funding_policy_id"], ["funding_policies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("expense_id", name="uq_contribution_call_expense"),
    )
    op.create_table(
        "contribution_allocations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("call_id", sa.String(), nullable=False),
        sa.Column("shareholder_id", sa.String(), nullable=False),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("weight_bps", sa.Integer(), nullable=False),
        sa.Column("collected_paise", sa.Integer(), nullable=False),
        sa.Column("mandate_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount_paise >= 0", name="ck_contribution_allocation_amount_nonnegative"),
        sa.CheckConstraint("collected_paise >= 0", name="ck_contribution_allocation_collected_nonnegative"),
        sa.CheckConstraint("weight_bps >= 0 AND weight_bps <= 10000", name="ck_contribution_allocation_weight_range"),
        sa.ForeignKeyConstraint(["call_id"], ["contribution_calls.id"]),
        sa.ForeignKeyConstraint(["shareholder_id"], ["shareholders.id"]),
        sa.ForeignKeyConstraint(["mandate_id"], ["payment_mandates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("call_id", "shareholder_id", name="uq_contribution_call_shareholder"),
    )
    op.create_table(
        "payment_instructions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False),
        sa.Column("expense_id", sa.String(), nullable=True),
        sa.Column("allocation_id", sa.String(), nullable=True),
        sa.Column("vendor_id", sa.String(), nullable=True),
        sa.Column("bank_account_id", sa.String(), nullable=True),
        sa.Column("mandate_id", sa.String(), nullable=True),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_destination_ref", sa.String(length=200), nullable=True),
        sa.Column("idempotency_key", sa.String(length=160), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_by", sa.String(length=200), nullable=False),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("provider_reference", sa.String(length=200), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount_paise > 0", name="ck_payment_instruction_amount_positive"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["expense_id"], ["expense_obligations.id"]),
        sa.ForeignKeyConstraint(["allocation_id"], ["contribution_allocations.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"]),
        sa.ForeignKeyConstraint(["bank_account_id"], ["bank_accounts.id"]),
        sa.ForeignKeyConstraint(["mandate_id"], ["payment_mandates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_payment_instruction_idempotency_key"),
    )
    op.create_index("ix_payment_instruction_status_schedule", "payment_instructions", ["status", "scheduled_for"], unique=False)
    op.create_table(
        "payment_attempts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("instruction_id", sa.String(), nullable=False),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("request_digest", sa.String(length=64), nullable=False),
        sa.Column("provider_reference", sa.String(length=200), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("failure_code", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["instruction_id"], ["payment_instructions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("instruction_id", "attempt_no", name="uq_payment_attempt_instruction_no"),
    )
    op.create_table(
        "finance_provider_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_event_id", sa.String(length=200), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("signature_verified", sa.Boolean(), nullable=False),
        sa.Column("payload_digest", sa.String(length=64), nullable=False),
        sa.Column("processing_status", sa.String(length=30), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_event_id", name="uq_finance_provider_event"),
    )


def downgrade() -> None:
    op.drop_table("finance_provider_events")
    op.drop_table("payment_attempts")
    op.drop_index("ix_payment_instruction_status_schedule", table_name="payment_instructions")
    op.drop_table("payment_instructions")
    op.drop_table("contribution_allocations")
    op.drop_table("contribution_calls")
    op.drop_index("ix_payment_mandate_holder_status", table_name="payment_mandates")
    op.drop_table("payment_mandates")
    op.drop_index("ix_expense_obligation_status_due", table_name="expense_obligations")
    op.drop_table("expense_obligations")
    op.drop_table("funding_policies")
    op.drop_index("ix_share_transfer_status_created", table_name="share_transfer_requests")
    op.drop_table("share_transfer_requests")
    op.drop_index("ix_share_change_status_created", table_name="share_change_requests")
    op.drop_table("share_change_requests")
    op.drop_index("ix_share_ledger_holder_class_date", table_name="share_ledger_entries")
    op.drop_table("share_ledger_entries")
    op.drop_table("shareholders")
    op.drop_table("share_classes")
