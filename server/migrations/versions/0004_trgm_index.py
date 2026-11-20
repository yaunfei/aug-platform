"""pg_trgm GIN expression index for record keyword search

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-04
"""

from __future__ import annotations

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_form_record_data_trgm "
        "ON form_record USING gin (cast(data AS text) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_form_record_data_trgm")
