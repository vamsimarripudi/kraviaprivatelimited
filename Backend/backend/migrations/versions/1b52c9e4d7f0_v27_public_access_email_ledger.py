"""v27 signed public visitor mail idempotency ledger (no public accounts in Office)

Revision ID: 1b52c9e4d7f0
Revises: e8a1c2d3f4b5
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "1b52c9e4d7f0"
down_revision: Union[str,None] = "e8a1c2d3f4b5"
branch_labels: Union[str,Sequence[str],None] = None
depends_on: Union[str,Sequence[str],None] = None

def upgrade() -> None:
    op.create_table("office_public_access_email_deliveries",
        sa.Column("event_id",sa.String(length=160),primary_key=True),
        sa.Column("recipient_fingerprint",sa.String(length=64),nullable=False),
        sa.Column("mail_kind",sa.String(length=40),nullable=False),
        sa.Column("status",sa.String(length=20),nullable=False,server_default="PENDING"),
        sa.Column("provider_message_id",sa.String(length=320)),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
    )
    op.create_index("ix_public_access_mail_kind_status","office_public_access_email_deliveries",
        ["mail_kind","status"])
    if op.get_bind().dialect.name=="postgresql":
        op.execute(sa.text("alter table public.office_public_access_email_deliveries enable row level security"))
        op.execute(sa.text("revoke all on public.office_public_access_email_deliveries from anon, authenticated"))

def downgrade() -> None:
    op.drop_index("ix_public_access_mail_kind_status",table_name="office_public_access_email_deliveries")
    op.drop_table("office_public_access_email_deliveries")
