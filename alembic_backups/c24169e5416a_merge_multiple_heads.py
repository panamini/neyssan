"""merge multiple heads

Revision ID: c24169e5416a
Revises: 0000_create_profiles_full, 0003_add_profile_columns
Create Date: 2025-08-27 10:58:31.473117

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c24169e5416a'
down_revision: Union[str, Sequence[str], None] = ('0000_create_profiles_full', '0003_add_profile_columns')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
