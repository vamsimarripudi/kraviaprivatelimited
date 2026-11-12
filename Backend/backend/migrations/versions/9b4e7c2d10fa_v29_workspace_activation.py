"""v29 separate employee authentication from Founder-approved workspace activation

Revision ID: 9b4e7c2d10fa
Revises: 8c46b2a09d17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9b4e7c2d10fa"
down_revision: Union[str, None] = "8c46b2a09d17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "office_auth_users",
        sa.Column("workspace_status", sa.String(length=24), server_default="ACTIVE", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("office_auth_users", "workspace_status")
