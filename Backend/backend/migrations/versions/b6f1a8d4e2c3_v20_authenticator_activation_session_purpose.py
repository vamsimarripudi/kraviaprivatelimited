"""v20 scope mobile email sessions to Authenticator activation.

Revision ID: b6f1a8d4e2c3
Revises: a9e3f1b72c40
Create Date: 2026-10-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6f1a8d4e2c3"
down_revision: Union[str, None] = "a9e3f1b72c40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "office_auth_sessions_v2",
        sa.Column("purpose", sa.String(length=48), nullable=False, server_default="OFFICE"),
    )


def downgrade() -> None:
    op.drop_column("office_auth_sessions_v2", "purpose")
