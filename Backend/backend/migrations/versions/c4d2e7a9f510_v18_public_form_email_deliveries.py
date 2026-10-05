"""v18 idempotent public-form acknowledgement deliveries

Revision ID: c4d2e7a9f510
Revises: a9e3f1b72c40
Create Date: 2026-10-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d2e7a9f510"
down_revision: Union[str, None] = "a9e3f1b72c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_public_email_deliveries",
        sa.Column("event_id", sa.String(length=160), nullable=False),
        sa.Column("reference", sa.String(length=64), nullable=False),
        sa.Column("form_kind", sa.String(length=32), nullable=False),
        sa.Column("recipient_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING"),
        sa.Column("provider_message_id", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("event_id"),
    )
    op.create_index(
        "ix_office_public_email_deliveries_status_created",
        "office_public_email_deliveries",
        ["status", "created_at"],
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("alter table public.office_public_email_deliveries enable row level security"))
        op.execute(sa.text("revoke all on table public.office_public_email_deliveries from anon, authenticated"))


def downgrade() -> None:
    op.drop_index("ix_office_public_email_deliveries_status_created", table_name="office_public_email_deliveries")
    op.drop_table("office_public_email_deliveries")
