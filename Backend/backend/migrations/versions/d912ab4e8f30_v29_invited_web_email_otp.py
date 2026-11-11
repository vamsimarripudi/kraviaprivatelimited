"""v29: mark invited employee web email-OTP sessions independently from Authenticator.

Email OTP is only available to verified invitees with MEMBER-only access.
An elevated account cannot use a mailbox code as an Authenticator substitute.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d912ab4e8f30"
down_revision: Union[str, None] = "8c46b2a09d17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("office_auth_sessions_v2", sa.Column("email_otp_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("office_email_otp_challenges", sa.Column("browser_session_id", sa.String(length=36), nullable=True))
    op.create_index("ix_office_email_otp_browser_session", "office_email_otp_challenges", ["browser_session_id", "channel"])


def downgrade() -> None:
    op.drop_index("ix_office_email_otp_browser_session", table_name="office_email_otp_challenges")
    op.drop_column("office_email_otp_challenges", "browser_session_id")
    op.drop_column("office_auth_sessions_v2", "email_otp_verified_at")
