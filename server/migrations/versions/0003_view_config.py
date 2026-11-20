"""view_config table

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "view_config",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("view_key", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("form_key", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("mapping_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("view_key", "version", name="uq_view_config_key_version"),
    )
    op.create_index("idx_view_config_key", "view_config", ["view_key"])


def downgrade() -> None:
    op.drop_index("idx_view_config_key", table_name="view_config")
    op.drop_table("view_config")
