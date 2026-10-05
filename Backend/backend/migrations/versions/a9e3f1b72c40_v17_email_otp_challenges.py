"""v17 email OTP authentication challenges

Revision ID: a9e3f1b72c40
Revises: d5a8b6c4e1f2
Create Date: 2026-10-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9e3f1b72c40"
down_revision: Union[str, None] = "d5a8b6c4e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_email_otp_challenges",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("challenge_token_hash", sa.String(length=64), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING"),
        sa.Column("channel", sa.String(length=48), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("delivery_attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider_message_id", sa.String(length=320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["office_auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("challenge_token_hash"),
    )
    op.create_index(
        "ix_office_email_otp_challenges_user_status",
        "office_email_otp_challenges",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_office_email_otp_challenges_status_expires",
        "office_email_otp_challenges",
        ["status", "expires_at"],
    )

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("alter table public.office_email_otp_challenges enable row level security"))
        op.execute(sa.text("revoke all on table public.office_email_otp_challenges from anon, authenticated"))


def downgrade() -> None:
    op.drop_index("ix_office_email_otp_challenges_status_expires", table_name="office_email_otp_challenges")
    op.drop_index("ix_office_email_otp_challenges_user_status", table_name="office_email_otp_challenges")
    op.drop_table("office_email_otp_challenges")
