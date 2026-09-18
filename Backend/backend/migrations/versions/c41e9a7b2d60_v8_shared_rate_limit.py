"""v8 shared application rate limit

Revision ID: c41e9a7b2d60
Revises: a8c4e7d92130
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c41e9a7b2d60"
down_revision: Union[str, None] = "a8c4e7d92130"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shared_rate_limit_windows",
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.Integer(), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("key_hash", "window_start"),
    )
    op.create_index("ix_shared_rate_limit_window_start", "shared_rate_limit_windows", ["window_start"])


def downgrade() -> None:
    op.drop_index("ix_shared_rate_limit_window_start", table_name="shared_rate_limit_windows")
    op.drop_table("shared_rate_limit_windows")
