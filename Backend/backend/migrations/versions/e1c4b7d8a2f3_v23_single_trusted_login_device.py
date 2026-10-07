"""v23 enforce one trusted login device per KRAVIA identity.

The application transaction revokes an old device before trusting a new one.
This partial unique index is the durable database backstop for that invariant.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1c4b7d8a2f3"
down_revision: Union[str, None] = "f2a7c9d4e8b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing historical rows can predate the one-device policy.  Retain only
    # the newest trusted row per account before adding the invariant.
    op.execute(
        sa.text(
            """
            with ranked as (
              select id, row_number() over (
                partition by user_id order by consumed_at desc, created_at desc, id desc
              ) as position
              from office_login_device_approvals
              where status='TRUSTED'
            )
            update office_login_device_approvals
            set status='REVOKED', trusted_until=coalesce(trusted_until, CURRENT_TIMESTAMP)
            where id in (select id from ranked where position > 1)
            """
        )
    )
    op.execute(
        sa.text(
            """
            update office_auth_sessions_v2
            set status='REVOKED', revoked_at=coalesce(revoked_at, CURRENT_TIMESTAMP)
            where id in (
              select session_id from office_login_device_approvals where status='REVOKED'
            ) and status='ACTIVE'
            """
        )
    )
    where = sa.text("status = 'TRUSTED'")
    op.create_index(
        "uq_office_login_device_approvals_one_trusted_user",
        "office_login_device_approvals",
        ["user_id"],
        unique=True,
        postgresql_where=where,
        sqlite_where=where,
    )


def downgrade() -> None:
    op.drop_index("uq_office_login_device_approvals_one_trusted_user", table_name="office_login_device_approvals")
