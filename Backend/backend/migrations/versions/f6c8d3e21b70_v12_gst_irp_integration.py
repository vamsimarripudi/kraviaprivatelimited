"""v12 GST IRP integration

Revision ID: f6c8d3e21b70
Revises: e4b7c2d91a60
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6c8d3e21b70"
down_revision: Union[str, None] = "e4b7c2d91a60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("customers") as batch:
        batch.add_column(sa.Column("billing_locality", sa.String(length=120), nullable=True))
        batch.add_column(sa.Column("billing_pincode", sa.String(length=6), nullable=True))

    op.create_table(
        "gst_taxpayer_snapshots",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("gstin", sa.String(length=15), nullable=False),
        sa.Column("legal_name", sa.String(length=240), nullable=True),
        sa.Column("trade_name", sa.String(length=240), nullable=True),
        sa.Column("taxpayer_type", sa.String(length=80), nullable=True),
        sa.Column("registration_status", sa.String(length=40), nullable=True),
        sa.Column("state_code", sa.String(length=2), nullable=True),
        sa.Column("pincode", sa.String(length=6), nullable=True),
        sa.Column("source_response_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_json", sa.Text(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gst_taxpayer_snapshot_gstin_verified", "gst_taxpayer_snapshots", ["gstin", "verified_at"])

    op.create_table(
        "gst_einvoice_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("invoice_id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_environment", sa.String(length=24), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("irn", sa.String(length=64), nullable=True),
        sa.Column("ack_no", sa.String(length=40), nullable=True),
        sa.Column("ack_at", sa.String(length=40), nullable=True),
        sa.Column("signed_invoice", sa.Text(), nullable=True),
        sa.Column("signed_qr_code", sa.Text(), nullable=True),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_hash", sa.String(length=64), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason_code", sa.String(length=2), nullable=True),
        sa.Column("cancel_remarks", sa.String(length=200), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_id"),
        sa.UniqueConstraint("irn"),
    )
    op.create_index("ix_gst_einvoice_status_created", "gst_einvoice_records", ["status", "created_at"])

    op.create_table(
        "gst_provider_operations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_environment", sa.String(length=24), nullable=False),
        sa.Column("operation", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=True),
        sa.Column("entity_id", sa.String(length=160), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=True),
        sa.Column("response_hash", sa.String(length=64), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("actor", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gst_provider_operation_created", "gst_provider_operations", ["provider", "created_at"])
    op.create_index("ix_gst_provider_operation_entity", "gst_provider_operations", ["entity_type", "entity_id"])

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in ("gst_taxpayer_snapshots", "gst_einvoice_records", "gst_provider_operations"):
            op.execute(sa.text(f'alter table public."{table}" enable row level security'))
            op.execute(sa.text(f'revoke all on table public."{table}" from anon, authenticated'))


def downgrade() -> None:
    op.drop_index("ix_gst_provider_operation_entity", table_name="gst_provider_operations")
    op.drop_index("ix_gst_provider_operation_created", table_name="gst_provider_operations")
    op.drop_table("gst_provider_operations")
    op.drop_index("ix_gst_einvoice_status_created", table_name="gst_einvoice_records")
    op.drop_table("gst_einvoice_records")
    op.drop_index("ix_gst_taxpayer_snapshot_gstin_verified", table_name="gst_taxpayer_snapshots")
    op.drop_table("gst_taxpayer_snapshots")
    with op.batch_alter_table("customers") as batch:
        batch.drop_column("billing_pincode")
        batch.drop_column("billing_locality")
