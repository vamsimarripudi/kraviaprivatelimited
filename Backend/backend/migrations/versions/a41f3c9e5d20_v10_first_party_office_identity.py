"""v10 first-party Office identity

Revision ID: a41f3c9e5d20
Revises: f2c8d1a94e50
Create Date: 2026-09-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a41f3c9e5d20"
down_revision: Union[str, None] = "f2c8d1a94e50"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "office_auth_users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="ACTIVE"),
        sa.Column("founder_slot", sa.String(length=32), nullable=True),
        sa.Column("mfa_secret_ciphertext", sa.Text(), nullable=True),
        sa.Column("mfa_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("founder_slot"),
    )
    op.create_index("ix_office_auth_users_status", "office_auth_users", ["status"])


    op.create_table(
        "office_auth_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("granted_by", sa.String(length=36), nullable=True),
        sa.Column("grant_reason", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["office_auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role", name="uq_office_auth_role_user_role"),
    )
    op.create_index("ix_office_auth_roles_user", "office_auth_roles", ["user_id"])

    op.create_table(
        "office_auth_sessions_v2",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="ACTIVE"),
        sa.Column("aal", sa.String(length=8), nullable=False, server_default="aal1"),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["office_auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_token_hash"),
    )
    op.create_index("ix_office_auth_sessions_v2_user_status", "office_auth_sessions_v2", ["user_id", "status"])
    op.create_index("ix_office_auth_sessions_v2_expires", "office_auth_sessions_v2", ["expires_at"])

    op.create_table(
        "office_auth_invites",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=True),
        sa.Column("job_title", sa.String(length=160), nullable=True),
        sa.Column("department", sa.String(length=64), nullable=True),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="PENDING"),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_by", sa.String(length=36), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_office_auth_invites_email_status", "office_auth_invites", ["email", "status"])
    op.create_index("ix_office_auth_invites_expires", "office_auth_invites", ["expires_at"])

    op.create_table(
        "office_auth_events_v2",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent_hash", sa.String(length=64), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_office_auth_events_v2_user_created", "office_auth_events_v2", ["user_id", "created_at"])
    op.create_index("ix_office_auth_events_v2_session_created", "office_auth_events_v2", ["session_id", "created_at"])

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in ("office_auth_users", "office_auth_roles", "office_auth_sessions_v2", "office_auth_invites", "office_auth_events_v2"):
            op.execute(sa.text(f'alter table public."{table}" enable row level security'))
            op.execute(sa.text(f'revoke all on table public."{table}" from anon, authenticated'))


def downgrade() -> None:
    op.drop_index("ix_office_auth_events_v2_session_created", table_name="office_auth_events_v2")
    op.drop_index("ix_office_auth_events_v2_user_created", table_name="office_auth_events_v2")
    op.drop_table("office_auth_events_v2")
    op.drop_index("ix_office_auth_invites_expires", table_name="office_auth_invites")
    op.drop_index("ix_office_auth_invites_email_status", table_name="office_auth_invites")
    op.drop_table("office_auth_invites")
    op.drop_index("ix_office_auth_sessions_v2_expires", table_name="office_auth_sessions_v2")
    op.drop_index("ix_office_auth_sessions_v2_user_status", table_name="office_auth_sessions_v2")
    op.drop_table("office_auth_sessions_v2")
    op.drop_index("ix_office_auth_roles_user", table_name="office_auth_roles")
    op.drop_table("office_auth_roles")
    op.drop_index("ix_office_auth_users_status", table_name="office_auth_users")
    op.drop_table("office_auth_users")
