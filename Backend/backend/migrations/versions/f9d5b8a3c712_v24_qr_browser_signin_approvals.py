"""v24 password-first Authenticator QR browser-sign-in approvals.

The QR code is only a short-lived scan capability.  The original browser and
the trusted mobile device each retain independent high-entropy proofs; neither
proof is stored in cleartext.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9d5b8a3c712"
down_revision: Union[str, None] = "e1c4b7d8a2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_qr_signin_approvals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("browser_proof_hash", sa.String(length=64), nullable=False),
        sa.Column("scan_token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING"),
        sa.Column("source_ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=64), nullable=True),
        sa.Column("browser_label", sa.String(length=160), nullable=False),
        sa.Column("scanned_by_device_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["scanned_by_device_id"], ["office_login_device_approvals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["session_id"], ["office_auth_sessions_v2.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["office_auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("browser_proof_hash"),
        sa.UniqueConstraint("scan_token_hash"),
    )
    op.create_index(
        "ix_office_qr_signin_approvals_user_status",
        "office_qr_signin_approvals",
        ["user_id", "status"],
    )
    op.create_index(
        "ix_office_qr_signin_approvals_session_status",
        "office_qr_signin_approvals",
        ["session_id", "status"],
    )
    op.create_index(
        "ix_office_qr_signin_approvals_status_expires",
        "office_qr_signin_approvals",
        ["status", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_office_qr_signin_approvals_status_expires", table_name="office_qr_signin_approvals")
    op.drop_index("ix_office_qr_signin_approvals_session_status", table_name="office_qr_signin_approvals")
    op.drop_index("ix_office_qr_signin_approvals_user_status", table_name="office_qr_signin_approvals")
    op.drop_table("office_qr_signin_approvals")
