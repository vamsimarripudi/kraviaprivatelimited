"""Create the isolated, time-bounded Google Play reviewer identity record.

This is not an Office role.  It only enables the native Authenticator's
review-only activation capability and is disabled/revoked by an operational
script after Play review.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8a1c2d3f4b5"
down_revision: Union[str, None] = "c7f2d4a8e531"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_play_reviewer_access",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("otp_code_hash", sa.String(length=512), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["office_auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_office_play_reviewer_access_user"),
    )
    op.create_index(
        "ix_office_play_reviewer_access_enabled_expires",
        "office_play_reviewer_access",
        ["enabled", "expires_at"],
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("alter table public.office_play_reviewer_access enable row level security"))
        op.execute(sa.text("revoke all on table public.office_play_reviewer_access from anon, authenticated"))


def downgrade() -> None:
    op.drop_index("ix_office_play_reviewer_access_enabled_expires", table_name="office_play_reviewer_access")
    op.drop_table("office_play_reviewer_access")
