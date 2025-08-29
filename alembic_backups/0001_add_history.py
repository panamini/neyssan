"""add llm_history table and profiles.version column

Revision ID: 0001_add_llm_history_and_profile_version
Revises: None
Create Date: 2025-08-22 16:08:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "0001_add_history"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Get current database inspector
    conn = op.get_bind()
    inspector = inspect(conn)

    # Check if 'profiles' table exists
    if 'profiles' not in inspector.get_table_names():
        op.create_table(
            'profiles',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1'))
        )
    else:
        # Add `version` column if table exists
        existing_cols = [c['name'] for c in inspector.get_columns('profiles')]
        if 'version' not in existing_cols:
            with op.batch_alter_table("profiles", schema=None) as batch_op:
                batch_op.add_column(
                    sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1"))
                )

    # Create `llm_history` table
    if 'llm_history' not in inspector.get_table_names():
        op.create_table(
            "llm_history",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("run_time", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("provider", sa.Text(), nullable=True),
            sa.Column("model", sa.Text(), nullable=True),
            sa.Column("job_id", sa.Text(), nullable=True),
            sa.Column("request_payload", postgresql.JSONB, nullable=True),
            sa.Column("response_snippet", sa.Text(), nullable=True),
            sa.Column("full_response", postgresql.JSONB, nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("merged", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("merge_notes", sa.Text(), nullable=True),
        )

        # Indexes
        op.create_index("ix_llm_history_profile_id", "llm_history", ["profile_id"])
        op.create_index("ix_llm_history_job_id", "llm_history", ["job_id"])


def downgrade():
    # Drop indexes and table
    op.drop_index("ix_llm_history_job_id", table_name="llm_history")
    op.drop_index("ix_llm_history_profile_id", table_name="llm_history")
    op.drop_table("llm_history")

    # Remove version column from profiles if exists
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('profiles')]
    if 'version' in existing_cols:
        with op.batch_alter_table("profiles", schema=None) as batch_op:
            batch_op.drop_column("version")
