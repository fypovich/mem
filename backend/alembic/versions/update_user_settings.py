"""update_user_settings

Revision ID: update_user_settings
Revises: 6f84bcec4b3d (или какой у вас последний ID)
Create Date: 2026-01-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'update_user_settings'
down_revision = '6f84bcec4b3d' # ВАЖНО: Вставьте сюда ID последней миграции из папки versions!
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Добавляем колонки с дефолтным значением True
    op.add_column('users', sa.Column('notify_on_like', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('notify_on_comment', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('notify_on_new_follower', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('notify_on_new_meme', sa.Boolean(), server_default='true', nullable=False))

def downgrade() -> None:
    op.drop_column('users', 'notify_on_new_meme')
    op.drop_column('users', 'notify_on_new_follower')
    op.drop_column('users', 'notify_on_comment')
    op.drop_column('users', 'notify_on_like')