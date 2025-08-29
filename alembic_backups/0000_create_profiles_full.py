"""create full profiles table with pgcrypto UUID

Revision ID: 0000_create_profiles_full
Revises: None
Create Date: 2025-08-27 15:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "0000_create_profiles_full"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Ensure pgcrypto extension is available for gen_random_uuid()
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # Get inspector to check if table exists
    conn = op.get_bind()
    inspector = inspect(conn)

    # Create profiles table only if it doesn't exist
    if 'profiles' not in inspector.get_table_names():
        op.create_table(
            "profiles",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
            sa.Column("name", sa.Text(), nullable=True, comment="User full name"),
            sa.Column("email", sa.Text(), nullable=True, comment="User email address for identification and communication"),
            sa.Column("summary", sa.Text(), nullable=True, comment="Profile summary or bio"),
            sa.Column("skills", postgresql.JSONB, nullable=True, comment="List of skills as JSONB"),
            sa.Column("experience", postgresql.JSONB, nullable=True, comment="Professional experience as JSONB"),
            sa.Column("raw_text", sa.Text(), nullable=True, comment="Original raw text used to generate profile"),
            sa.Column("confidence", sa.Float(), nullable=True, comment="Confidence score between 0 and 1"),
            sa.Column("meta", postgresql.JSONB, nullable=True, comment="Additional metadata"),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1"), comment="Versioning column for profile"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
            sa.CheckConstraint('confidence >= 0 AND confidence <= 1', name='chk_confidence_range')
        )

    # Create index if it doesn't exist (idempotent)
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('profiles')]
    if 'ix_profiles_email' not in existing_indexes:
        op.create_index("ix_profiles_email", "profiles", ["email"], unique=False)

def downgrade():
    # Drop email index if exists
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('profiles')]
    if 'ix_profiles_email' in existing_indexes:
        op.drop_index("ix_profiles_email", table_name="profiles")

    # Drop profiles table if exists
    if 'profiles' in inspector.get_table_names():
        op.drop_table("profiles")
