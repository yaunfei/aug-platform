"""initial form_schema and form_record

Revision ID: 0001
Revises:
Create Date: 2026-07-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "form_schema",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("form_key", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("schema_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="published"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("form_key", "version", name="uq_form_schema_key_version"),
    )
    op.create_index("idx_form_schema_key", "form_schema", ["form_key"])

    op.create_table(
        "form_record",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("form_key", sa.String(length=64), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "idx_form_record_key_created",
        "form_record",
        ["form_key", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_form_record_key_created", table_name="form_record")
    op.drop_table("form_record")
    op.drop_index("idx_form_schema_key", table_name="form_schema")
    op.drop_table("form_schema")
