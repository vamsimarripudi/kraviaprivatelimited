"""v19 auditable public-intake follow-up deliveries

Revision ID: d7e4f0a6c821
Revises: c4d2e7a9f510
Create Date: 2026-10-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e4f0a6c821"
down_revision: Union[str, None] = "c4d2e7a9f510"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "office_public_email_deliveries",
        sa.Column("delivery_kind", sa.String(length=32), nullable=False, server_default="ACKNOWLEDGEMENT"),
    )
    op.add_column(
        "office_public_email_deliveries",
        sa.Column("content_fingerprint", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("office_public_email_deliveries", "content_fingerprint")
    op.drop_column("office_public_email_deliveries", "delivery_kind")
