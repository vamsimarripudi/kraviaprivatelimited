"""v13 GST purchase reconciliation and return workings

Revision ID: 0b7e5a9c4d31
Revises: f6c8d3e21b70
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0b7e5a9c4d31"
down_revision: Union[str, None] = "f6c8d3e21b70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gst_data_download_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("provider_environment", sa.String(length=24), nullable=False),
        sa.Column("direction", sa.String(length=24), nullable=False, server_default="PURCHASE"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="REQUESTED"),
        sa.Column("provider_request_id", sa.String(length=160), nullable=True),
        sa.Column("period_from", sa.String(length=10), nullable=True),
        sa.Column("period_to", sa.String(length=10), nullable=True),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_hash", sa.String(length=64), nullable=True),
        sa.Column("provider_status_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("result_file_hash", sa.String(length=64), nullable=True),
        sa.Column("imported_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("requested_by", sa.String(length=200), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gst_data_download_status", "gst_data_download_jobs", ["status", "requested_at"])

    op.create_table(
        "gst_purchase_invoices",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("source_job_id", sa.String(), nullable=True),
        sa.Column("irn", sa.String(length=64), nullable=True),
        sa.Column("supplier_gstin", sa.String(length=15), nullable=False),
        sa.Column("supplier_name", sa.String(length=240), nullable=True),
        sa.Column("document_type", sa.String(length=12), nullable=False),
        sa.Column("document_no", sa.String(length=32), nullable=False),
        sa.Column("document_date", sa.String(length=10), nullable=False),
        sa.Column("place_of_supply", sa.String(length=2), nullable=True),
        sa.Column("taxable_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cgst_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sgst_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("igst_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cess_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("irn_status", sa.String(length=30), nullable=True),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_json", sa.Text(), nullable=False),
        sa.Column("vendor_id", sa.String(), nullable=True),
        sa.Column("bank_transaction_id", sa.String(), nullable=True),
        sa.Column("reconciliation_status", sa.String(length=30), nullable=False, server_default="UNMATCHED"),
        sa.Column("itc_review_status", sa.String(length=30), nullable=False, server_default="REVIEW_REQUIRED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["source_job_id"], ["gst_data_download_jobs.id"]),
        sa.ForeignKeyConstraint(["vendor_id"], ["vendors.id"]),
        sa.ForeignKeyConstraint(["bank_transaction_id"], ["bank_transactions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_hash"),
    )
    op.create_index("ix_gst_purchase_period", "gst_purchase_invoices", ["document_date"])
    op.create_index("ix_gst_purchase_supplier_doc", "gst_purchase_invoices", ["supplier_gstin", "document_no"])
    op.create_index("ix_gst_purchase_reconciliation", "gst_purchase_invoices", ["reconciliation_status"])

    op.create_table(
        "gst_reconciliation_runs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("period_from", sa.String(length=10), nullable=True),
        sa.Column("period_to", sa.String(length=10), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("summary_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("run_by", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "gst_return_workings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("form_type", sa.String(length=20), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="DRAFT"),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("summary_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("prepared_by", sa.String(length=200), nullable=False),
        sa.Column("reviewed_by", sa.String(length=200), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("filing_provider", sa.String(length=80), nullable=True),
        sa.Column("filing_arn", sa.String(length=80), nullable=True),
        sa.Column("filing_evidence_ref", sa.Text(), nullable=True),
        sa.Column("filed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("form_type", "period", name="uq_gst_return_working_period"),
    )
    op.create_index("ix_gst_return_status_period", "gst_return_workings", ["status", "period"])

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in ("gst_data_download_jobs", "gst_purchase_invoices", "gst_reconciliation_runs", "gst_return_workings"):
            op.execute(sa.text(f'alter table public."{table}" enable row level security'))
            op.execute(sa.text(f'revoke all on table public."{table}" from anon, authenticated'))


def downgrade() -> None:
    op.drop_index("ix_gst_return_status_period", table_name="gst_return_workings")
    op.drop_table("gst_return_workings")
    op.drop_table("gst_reconciliation_runs")
    op.drop_index("ix_gst_purchase_reconciliation", table_name="gst_purchase_invoices")
    op.drop_index("ix_gst_purchase_supplier_doc", table_name="gst_purchase_invoices")
    op.drop_index("ix_gst_purchase_period", table_name="gst_purchase_invoices")
    op.drop_table("gst_purchase_invoices")
    op.drop_index("ix_gst_data_download_status", table_name="gst_data_download_jobs")
    op.drop_table("gst_data_download_jobs")
