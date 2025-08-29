"""
add missing profile columns and email index

Revision ID: 0003_add_profile_columns
Revises: 0002_add_convex_fields
Create Date: 2025-08-26 13:40:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "0003_add_profile_columns"
down_revision = "0002_add_convex_fields"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)

    # If the profiles table does not exist, create it with the expected columns.
    if "profiles" not in inspector.get_table_names():
        op.create_table(
            "profiles",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("name", sa.Text(), nullable=True),
            sa.Column("email", sa.Text(), nullable=True),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("skills", postgresql.JSONB, nullable=True),
            sa.Column("experience", postgresql.JSONB, nullable=True),
            sa.Column("raw_text", sa.Text(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("meta", postgresql.JSONB, nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_profiles_email", "profiles", ["email"], unique=False)
        return

    # Table exists: detect and add missing columns only
    existing_cols = {c["name"] for c in inspector.get_columns("profiles")}
    cols_to_add = []

    if "email" not in existing_cols:
        cols_to_add.append(sa.Column("email", sa.Text(), nullable=True))
    if "summary" not in existing_cols:
        cols_to_add.append(sa.Column("summary", sa.Text(), nullable=True))
    if "skills" not in existing_cols:
        cols_to_add.append(sa.Column("skills", postgresql.JSONB, nullable=True))
    if "experience" not in existing_cols:
        cols_to_add.append(sa.Column("experience", postgresql.JSONB, nullable=True))
    if "raw_text" not in existing_cols:
        cols_to_add.append(sa.Column("raw_text", sa.Text(), nullable=True))
    if "confidence" not in existing_cols:
        cols_to_add.append(sa.Column("confidence", sa.Float(), nullable=True))
    if "meta" not in existing_cols:
        cols_to_add.append(sa.Column("meta", postgresql.JSONB, nullable=True))
    if "created_at" not in existing_cols:
        cols_to_add.append(sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    if "updated_at" not in existing_cols:
        cols_to_add.append(sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))

    if cols_to_add:
        with op.batch_alter_table("profiles", schema=None) as batch_op:
            for col in cols_to_add:
                batch_op.add_column(col)

    # Create non-unique email index if not present
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("profiles")}
    if "ix_profiles_email" not in existing_indexes:
        op.create_index("ix_profiles_email", "profiles", ["email"], unique=False)


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)

    # Drop index if present
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("profiles")}
    if "ix_profiles_email" in existing_indexes:
        op.drop_index("ix_profiles_email", table_name="profiles")

    # Drop columns if present (reverse order to be safe)
    existing_cols = {c["name"] for c in inspector.get_columns("profiles")}
    with op.batch_alter_table("profiles", schema=None) as batch_op:
        if "updated_at" in existing_cols:
            batch_op.drop_column("updated_at")
        if "created_at" in existing_cols:
            batch_op.drop_column("created_at")
        if "meta" in existing_cols:
            batch_op.drop_column("meta")
        if "confidence" in existing_cols:
            batch_op.drop_column("confidence")
        if "raw_text" in existing_cols:
            batch_op.drop_column("raw_text")
        if "experience" in existing_cols:
            batch_op.drop_column("experience")
        if "skills" in existing_cols:
            batch_op.drop_column("skills")
        if "summary" in existing_cols:
            batch_op.drop_column("summary")
        if "email" in existing_cols:
            batch_op.drop_column("email")
