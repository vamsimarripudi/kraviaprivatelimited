"""v22 add owner-scoped Office browser-device approval.

Revision ID: f2a7c9d4e8b1
Revises: c8d4e1f7a9b2
Create Date: 2026-10-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a7c9d4e8b1"
down_revision: Union[str, None] = "c8d4e1f7a9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_login_device_approvals",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("office_auth_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.String(length=36), sa.ForeignKey("office_auth_sessions_v2.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("device_token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("owner_action_token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("source_ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=64), nullable=True),
        sa.Column("device_label", sa.String(length=160), nullable=False),
        sa.Column("provider_message_id", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trusted_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_office_login_device_approvals_user_status", "office_login_device_approvals", ["user_id", "status"])
    op.create_index("ix_office_login_device_approvals_status_expires", "office_login_device_approvals", ["status", "expires_at"])


def downgrade() -> None:
    op.drop_index("ix_office_login_device_approvals_status_expires", table_name="office_login_device_approvals")
    op.drop_index("ix_office_login_device_approvals_user_status", table_name="office_login_device_approvals")
    op.drop_table("office_login_device_approvals")
