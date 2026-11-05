"""v28 add a keyed signed-payload fingerprint to public access mail idempotency

Revision ID: 8c46b2a09d17
Revises: 1b52c9e4d7f0
Create Date: 2026-11-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "8c46b2a09d17"
down_revision: Union[str, None] = "1b52c9e4d7f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "office_public_access_email_deliveries",
        sa.Column("content_fingerprint", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("office_public_access_email_deliveries", "content_fingerprint")
