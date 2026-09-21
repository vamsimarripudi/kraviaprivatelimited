"""v15 MFA replay protection

Revision ID: 4c7f91a2b6de
Revises: 63d2f419ab77
Create Date: 2026-09-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "4c7f91a2b6de"
down_revision: Union[str, None] = "63d2f419ab77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("office_auth_users") as batch:
        batch.add_column(sa.Column("mfa_last_accepted_counter", sa.BigInteger(), nullable=True))
    with op.batch_alter_table("office_auth_sessions_v2") as batch:
        batch.add_column(
            sa.Column(
                "mfa_failed_attempts",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("office_auth_sessions_v2") as batch:
        batch.drop_column("mfa_failed_attempts")
    with op.batch_alter_table("office_auth_users") as batch:
        batch.drop_column("mfa_last_accepted_counter")
