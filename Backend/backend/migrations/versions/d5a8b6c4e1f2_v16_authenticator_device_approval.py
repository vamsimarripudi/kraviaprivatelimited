"""v16 approved Authenticator device activation

Revision ID: d5a8b6c4e1f2
Revises: 4c7f91a2b6de
Create Date: 2026-09-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5a8b6c4e1f2"
down_revision: Union[str, None] = "4c7f91a2b6de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_authenticator_activations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("claim_token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_by", sa.String(length=36), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["office_auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("claim_token_hash"),
    )
    op.create_index(
        "ix_office_authenticator_activations_user_status",
        "office_authenticator_activations",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_office_authenticator_activations_status_expires",
        "office_authenticator_activations",
        ["status", "expires_at"],
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text('alter table public.office_authenticator_activations enable row level security'))
        op.execute(sa.text('revoke all on table public.office_authenticator_activations from anon, authenticated'))


def downgrade() -> None:
    op.drop_index("ix_office_authenticator_activations_status_expires", table_name="office_authenticator_activations")
    op.drop_index("ix_office_authenticator_activations_user_status", table_name="office_authenticator_activations")
    op.drop_table("office_authenticator_activations")
