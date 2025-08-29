"""add convex write columns to llm_history

Revision ID: 0002_add_convex_fields_llm_history
Revises: 0001_add_llm_history_and_profile_version
Create Date: 2025-08-23 23:26:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_add_convex_fields"
down_revision = "0001_add_history"
branch_labels = None
depends_on = None


def upgrade():
    """
    Add three nullable columns to record Convex persist attempts/results.

    This migration uses raw SQL with 'ADD COLUMN IF NOT EXISTS' to ensure
    it is idempotent. It will run safely even if the columns have already
    been created by an external script or a previous migration attempt,
    preventing 'DuplicateColumnError'.
    """
    op.execute("""
        ALTER TABLE llm_history
        ADD COLUMN IF NOT EXISTS convex_write_status TEXT,
        ADD COLUMN IF NOT EXISTS convex_error TEXT,
        ADD COLUMN IF NOT EXISTS convex_written_at BIGINT;
    """)


def downgrade():
    """
    Remove the Convex-related columns on downgrade.

    This migration uses raw SQL with 'DROP COLUMN IF EXISTS' to ensure
    it is idempotent. It will run safely even if the columns have already
    been removed, preventing errors.
    """
    op.execute("""
        ALTER TABLE llm_history
        DROP COLUMN IF EXISTS convex_written_at,
        DROP COLUMN IF EXISTS convex_error,
        DROP COLUMN IF EXISTS convex_write_status;
    """)
