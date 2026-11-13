"""v30 explicit invitation notice opt-in with once-only delivery ledger

Revision ID: f5bd0e2a1678
Revises: 9b4e7c2d10fa
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "f5bd0e2a1678"
down_revision: Union[str, None] = "9b4e7c2d10fa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "office_auth_invites",
        sa.Column("notice_opt_in", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "office_auth_invite_notice_deliveries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("invite_id", sa.String(length=36), sa.ForeignKey("office_auth_invites.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("recipient_kind", sa.String(length=16), nullable=False),
        sa.Column("recipient_email", sa.String(length=320), nullable=False),
        sa.Column("recipient_name", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("claim_token", sa.String(length=36), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True)),
        sa.Column("provider_message_id", sa.String(length=200)),
        sa.UniqueConstraint("invite_id", "kind", "recipient_kind", name="uq_auth_invite_notice_once"),
        sa.CheckConstraint("kind IN ('REMINDER','EXPIRED')", name="ck_auth_invite_notice_kind"),
        sa.CheckConstraint("recipient_kind IN ('INVITEE','INVITER')", name="ck_auth_invite_notice_recipient"),
        sa.CheckConstraint("status IN ('SENDING','SENT','REJECTED','UNKNOWN','SKIPPED')", name="ck_auth_invite_notice_outcome"),
    )
    op.create_index(
        "ix_auth_invite_notice_status_claim",
        "office_auth_invite_notice_deliveries", ["status", "claimed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_invite_notice_status_claim", table_name="office_auth_invite_notice_deliveries")
    op.drop_table("office_auth_invite_notice_deliveries")
    op.drop_column("office_auth_invites", "notice_opt_in")
