"""v14 Fynamics GSP filing evidence

Revision ID: 63d2f419ab77
Revises: 0b7e5a9c4d31
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "63d2f419ab77"
down_revision: Union[str, None] = "0b7e5a9c4d31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("gst_return_workings") as batch:
        batch.add_column(sa.Column("gsp_submission_ref", sa.String(length=160), nullable=True))
        batch.add_column(sa.Column("gsp_response_hash", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("gsp_status_json", sa.Text(), nullable=False, server_default="{}"))
        batch.add_column(sa.Column("gsp_last_sync_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("gsp_verified_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("gsp_verified_status", sa.String(length=40), nullable=True))
        batch.add_column(sa.Column("itc_review_json", sa.Text(), nullable=True))
        batch.add_column(sa.Column("itc_reviewed_by", sa.String(length=200), nullable=True))
        batch.add_column(sa.Column("itc_reviewed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("gst_return_workings") as batch:
        batch.drop_column("itc_reviewed_at")
        batch.drop_column("itc_reviewed_by")
        batch.drop_column("itc_review_json")
        batch.drop_column("gsp_verified_status")
        batch.drop_column("gsp_verified_at")
        batch.drop_column("gsp_last_sync_at")
        batch.drop_column("gsp_status_json")
        batch.drop_column("gsp_response_hash")
        batch.drop_column("gsp_submission_ref")
