"""v11 controlled product GST profiles

Revision ID: e4b7c2d91a60
Revises: a41f3c9e5d20
Create Date: 2026-09-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e4b7c2d91a60"
down_revision: Union[str, None] = "a41f3c9e5d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PRODUCTS = (
    ("PROD-VL", "VL", "VidyaLuma", "Education technology", "ACTIVE_CONFIG", True),
    ("PROD-RF", "RF", "RecruitFlow", "Recruitment technology", "ACTIVE_CONFIG", True),
    ("PROD-YK", "YK", "YUKTA", "Healthcare technology", "CONFIG_ONLY", False),
    ("PROD-VO", "VO", "VORIO", "Field-service operations", "CONFIG_ONLY", False),
    ("PROD-VM", "VM", "Vaanmeet", "Video Conferencing", "ACTIVE_CONFIG", True),
    ("PROD-VF", "VF", "VFormix", "Forms & Workflow SaaS", "ACTIVE_CONFIG", True),
)

BASIS = (
    "Standard subscription supplies hosted application access and related platform services; "
    "the standard commercial model does not transfer ownership of software or intellectual-property rights. "
    "Use a separate tax profile when a contract is primarily software licensing, hosting-only, custom development or IT support."
)

SOURCE = "CBIC Scheme of Classification of Services: SAC 998319; CBIC IT/ITES FAQ: IT services GST 18%"


def upgrade() -> None:
    op.create_table(
        "product_tax_profiles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("sac", sa.String(length=6), nullable=False),
        sa.Column("gst_rate_bps", sa.Integer(), nullable=False, server_default="1800"),
        sa.Column("tax_treatment", sa.String(length=24), nullable=False, server_default="TAXABLE"),
        sa.Column("supply_model", sa.String(length=32), nullable=False, server_default="HOSTED_SAAS"),
        sa.Column("billing_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="REVIEW_REQUIRED"),
        sa.Column("classification_basis", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.Text(), nullable=False),
        sa.Column("approved_by", sa.String(length=200), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence_ref", sa.Text(), nullable=True),
        sa.Column("approval_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id"),
        sa.CheckConstraint("gst_rate_bps >= 0 AND gst_rate_bps <= 10000", name="ck_product_tax_rate_range"),
        sa.CheckConstraint("length(sac) = 6", name="ck_product_tax_sac_length"),
    )
    op.create_index("ix_product_tax_profile_status", "product_tax_profiles", ["status"])
    op.create_index("ix_product_tax_profile_billing", "product_tax_profiles", ["billing_enabled"])

    bind = op.get_bind()
    entity_id = "LE-KRAVIA-IN"
    entity_exists = bind.execute(
        sa.text("select 1 from legal_entities where id = :id"),
        {"id": entity_id},
    ).first()
    if entity_exists:
        for product_id, code, name, category, status, billing_enabled in PRODUCTS:
            exists = bind.execute(sa.text("select 1 from products where id = :id"), {"id": product_id}).first()
            if not exists:
                bind.execute(
                    sa.text(
                        "insert into products (id, code, name, category, legal_entity_id, status) "
                        "values (:id, :code, :name, :category, :entity_id, :status)"
                    ),
                    {"id": product_id, "code": code, "name": name, "category": category, "entity_id": entity_id, "status": status},
                )
            profile_exists = bind.execute(sa.text("select 1 from product_tax_profiles where product_id = :pid"), {"pid": product_id}).first()
            if not profile_exists:
                bind.execute(
                    sa.text(
                        "insert into product_tax_profiles "
                        "(id, product_id, sac, gst_rate_bps, tax_treatment, supply_model, billing_enabled, status, classification_basis, source_ref) "
                        "values (:id, :pid, '998319', 1800, 'TAXABLE', 'HOSTED_SAAS', :billing, 'REVIEW_REQUIRED', :basis, :source)"
                    ),
                    {"id": f"TAX-{code}", "pid": product_id, "billing": billing_enabled, "basis": BASIS, "source": SOURCE},
                )

    if bind.dialect.name == "postgresql":
        op.execute(sa.text("alter table public.product_tax_profiles enable row level security"))
        op.execute(sa.text("revoke all on table public.product_tax_profiles from anon, authenticated"))


def downgrade() -> None:
    op.drop_index("ix_product_tax_profile_billing", table_name="product_tax_profiles")
    op.drop_index("ix_product_tax_profile_status", table_name="product_tax_profiles")
    op.drop_table("product_tax_profiles")
