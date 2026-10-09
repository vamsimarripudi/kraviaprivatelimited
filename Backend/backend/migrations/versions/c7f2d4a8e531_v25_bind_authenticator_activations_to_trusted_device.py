"""Bind Authenticator activation capabilities to a trusted native device.

Older unclaimed capabilities cannot prove which device/session created them, so
they are terminalized during the migration rather than remaining claimable.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7f2d4a8e531"
down_revision: Union[str, None] = "f9d5b8a3c712"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("office_authenticator_activations") as batch:
        batch.add_column(sa.Column("session_id", sa.String(length=36), nullable=True))
        batch.add_column(sa.Column("device_approval_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_office_authenticator_activations_session",
            "office_auth_sessions_v2",
            ["session_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch.create_foreign_key(
            "fk_office_authenticator_activations_device",
            "office_login_device_approvals",
            ["device_approval_id"],
            ["id"],
            ondelete="CASCADE",
        )
    op.create_index(
        "ix_office_authenticator_activations_session_status",
        "office_authenticator_activations",
        ["session_id", "status"],
    )
    op.create_index(
        "ix_office_authenticator_activations_device_status",
        "office_authenticator_activations",
        ["device_approval_id", "status"],
    )
    op.execute(
        sa.text(
            """
            update office_authenticator_activations
            set status = 'CANCELLED', cancelled_at = coalesce(cancelled_at, CURRENT_TIMESTAMP)
            where status in ('PENDING', 'APPROVED')
            """
        )
    )

    # These tables are owned exclusively by the first-party identity service.
    # Existing deployments need the same deny-by-default database boundary as
    # the earlier OTP and legacy approval tables.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in (
            "office_login_device_approvals",
            "office_qr_signin_approvals",
            "office_authenticator_activations",
        ):
            op.execute(sa.text(f"alter table public.{table} enable row level security"))
            op.execute(sa.text(f"revoke all on table public.{table} from anon, authenticated"))


def downgrade() -> None:
    op.drop_index(
        "ix_office_authenticator_activations_device_status",
        table_name="office_authenticator_activations",
    )
    op.drop_index(
        "ix_office_authenticator_activations_session_status",
        table_name="office_authenticator_activations",
    )
    with op.batch_alter_table("office_authenticator_activations") as batch:
        batch.drop_constraint("fk_office_authenticator_activations_device", type_="foreignkey")
        batch.drop_constraint("fk_office_authenticator_activations_session", type_="foreignkey")
        batch.drop_column("device_approval_id")
        batch.drop_column("session_id")
