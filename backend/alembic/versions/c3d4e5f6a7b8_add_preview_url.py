"""add preview_url to memes

Revision ID: c3d4e5f6a7b8
Revises: b7e8f9a0c1d2
Create Date: 2026-02-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b7e8f9a0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('memes', sa.Column('preview_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('memes', 'preview_url')
