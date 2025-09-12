"""initial_schema_baseline

Revision ID: d9efe780a491
Revises: 
Create Date: 2025-08-27 18:33:52.614251

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'd9efe780a491'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Check if tables already exist (idempotency)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # Create profiles table if it doesn't exist
    if 'profiles' not in existing_tables:
        op.create_table(
            'profiles',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('name', sa.Text(), nullable=True),
            sa.Column('email', sa.Text(), nullable=True),
            sa.Column('summary', sa.Text(), nullable=True),
            sa.Column('skills', postgresql.JSONB(), nullable=True),
            sa.Column('experience', postgresql.JSONB(), nullable=True),
            sa.Column('education', postgresql.JSONB(), nullable=True),
            sa.Column('achievements', postgresql.JSONB(), nullable=True),
            sa.Column('raw_text', sa.Text(), nullable=True),
            sa.Column('confidence', sa.Float(), nullable=True),
            sa.Column('meta', postgresql.JSONB(), nullable=True),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        
        # Create index only if it doesn't exist
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('profiles')]
        if 'ix_profiles_email' not in existing_indexes:
            op.create_index('ix_profiles_email', 'profiles', ['email'], unique=False)
    
    # Create llm_history table if it doesn't exist
    if 'llm_history' not in existing_tables:
        op.create_table(
            'llm_history',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('profile_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('run_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('provider', sa.Text(), nullable=True),
            sa.Column('model', sa.Text(), nullable=True),
            sa.Column('job_id', sa.Text(), nullable=True, index=True),
            sa.Column('request_payload', postgresql.JSONB(), nullable=True),
            sa.Column('response_snippet', sa.Text(), nullable=True),
            sa.Column('full_response', postgresql.JSONB(), nullable=True),
            sa.Column('confidence', sa.Float(), nullable=True),
            sa.Column('merged', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('merge_notes', sa.Text(), nullable=True),
            sa.Column('convex_write_status', sa.Text(), nullable=True),
            sa.Column('convex_error', sa.Text(), nullable=True),
            sa.Column('convex_written_at', sa.BigInteger(), nullable=True),
            sa.Column('convex_attempts', sa.Integer(), server_default='0', nullable=True),
            sa.Column('convex_last_attempt_at', sa.BigInteger(), nullable=True),
            sa.Column('convex_idempotency_key', sa.Text(), nullable=True, index=True),
            sa.ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_llm_history_profile_id', 'llm_history', ['profile_id'], unique=False)
        op.create_index('ix_llm_history_run_time', 'llm_history', ['run_time'], unique=False)

def downgrade():
    # Drop tables in correct order to respect foreign key constraints
    op.drop_table('llm_history')
    op.drop_table('profiles')
