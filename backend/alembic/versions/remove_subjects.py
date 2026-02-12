"""remove subjects

Revision ID: a1b2c3d4e5f6
Revises: fd09dcfe1afb
Create Date: 2026-02-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fd09dcfe1afb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove subjects table and subject_id FK from memes."""
    op.drop_constraint('memes_subject_id_fkey', 'memes', type_='foreignkey')
    op.drop_column('memes', 'subject_id')
    op.drop_index(op.f('ix_subjects_slug'), table_name='subjects')
    op.drop_index(op.f('ix_subjects_name'), table_name='subjects')
    op.drop_index(op.f('ix_subjects_id'), table_name='subjects')
    op.drop_table('subjects')


def downgrade() -> None:
    """Recreate subjects table and subject_id FK."""
    op.create_table('subjects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('slug', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subjects_id'), 'subjects', ['id'], unique=False)
    op.create_index(op.f('ix_subjects_name'), 'subjects', ['name'], unique=False)
    op.create_index(op.f('ix_subjects_slug'), 'subjects', ['slug'], unique=True)
    op.add_column('memes', sa.Column('subject_id', sa.Integer(), nullable=True))
    op.create_foreign_key('memes_subject_id_fkey', 'memes', 'subjects', ['subject_id'], ['id'])
