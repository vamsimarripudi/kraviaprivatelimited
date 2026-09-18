"""v7 worker cadence metadata

Revision ID: e1b4a6d2c730
Revises: d9e7f3a4c120
Create Date: 2026-09-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "e1b4a6d2c730"
down_revision: Union[str, None] = "d9e7f3a4c120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("worker_heartbeats", sa.Column("configured_interval_seconds", sa.Integer(), nullable=True))
    op.add_column("worker_heartbeats", sa.Column("configured_batch_size", sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column("worker_heartbeats", "configured_batch_size")
    op.drop_column("worker_heartbeats", "configured_interval_seconds")
