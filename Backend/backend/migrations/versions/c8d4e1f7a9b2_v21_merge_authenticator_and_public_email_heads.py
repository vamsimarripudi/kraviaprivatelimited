"""v21 merge Authenticator and public-email migration heads.

Revision ID: c8d4e1f7a9b2
Revises: b6f1a8d4e2c3, d7e4f0a6c821
Create Date: 2026-10-06
"""
from typing import Sequence, Union


revision: str = "c8d4e1f7a9b2"
down_revision: Union[str, Sequence[str], None] = ("b6f1a8d4e2c3", "d7e4f0a6c821")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This merge revision intentionally has no schema operation.
    pass


def downgrade() -> None:
    # Downgrade traverses the two parent branches independently.
    pass
