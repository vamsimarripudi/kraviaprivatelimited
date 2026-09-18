"""v7 audit retention controls

Revision ID: a8c4e7d92130
Revises: d9e7f3a4c120
Create Date: 2026-09-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a8c4e7d92130"
down_revision: Union[str, None] = "d9e7f3a4c120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_retention_policies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("retention_days", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="DRAFT"),
        sa.Column("archive_sink", sa.String(), nullable=True),
        sa.Column("archive_sink_reference", sa.String(), nullable=True),
        sa.Column("archive_sink_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.String(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "audit_legal_holds",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("scope_type", sa.String(), nullable=False),
        sa.Column("scope_value", sa.String(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("released_by", sa.String(), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_legal_hold_scope", "audit_legal_holds", ["scope_type", "scope_value", "status"])
    op.create_table(
        "audit_archive_manifests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("policy_id", sa.String(), nullable=False),
        sa.Column("cutoff_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_event_id", sa.String(), nullable=True),
        sa.Column("last_event_id", sa.String(), nullable=True),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_event_hash", sa.String(length=64), nullable=True),
        sa.Column("last_event_hash", sa.String(length=64), nullable=True),
        sa.Column("manifest_hash", sa.String(length=64), nullable=False),
        sa.Column("sink_reference", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="STAGED"),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["policy_id"], ["audit_retention_policies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("manifest_hash"),
    )


def downgrade() -> None:
    op.drop_table("audit_archive_manifests")
    op.drop_index("ix_audit_legal_hold_scope", table_name="audit_legal_holds")
    op.drop_table("audit_legal_holds")
    op.drop_table("audit_retention_policies")
