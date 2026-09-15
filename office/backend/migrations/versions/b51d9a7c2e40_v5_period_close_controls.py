"""v5 accounting and tax period close controls

Revision ID: b51d9a7c2e40
Revises: 8f3a1c9e4b27
Create Date: 2026-09-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b51d9a7c2e40"
down_revision: Union[str, Sequence[str], None] = "8f3a1c9e4b27"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accounting_period_locks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("legal_entity_id", sa.String(), nullable=False),
        sa.Column("period_start", sa.String(length=10), nullable=False),
        sa.Column("period_end", sa.String(length=10), nullable=False),
        sa.Column("lock_type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("locked_by", sa.String(length=200), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("unlock_approval_id", sa.String(), nullable=True),
        sa.Column("unlocked_by", sa.String(length=200), nullable=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("period_start <= period_end", name="ck_period_lock_valid_range"),
        sa.CheckConstraint("lock_type in ('ACCOUNTING','TAX','BOTH')", name="ck_period_lock_type"),
        sa.CheckConstraint("status in ('LOCKED','OPEN')", name="ck_period_lock_status"),
        sa.ForeignKeyConstraint(["legal_entity_id"], ["legal_entities.id"]),
        sa.ForeignKeyConstraint(["unlock_approval_id"], ["approval_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_period_lock_lookup",
        "accounting_period_locks",
        ["legal_entity_id", "status", "period_start", "period_end"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_period_lock_lookup", table_name="accounting_period_locks")
    op.drop_table("accounting_period_locks")
