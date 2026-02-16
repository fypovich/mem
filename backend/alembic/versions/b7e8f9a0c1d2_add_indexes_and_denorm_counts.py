"""add indexes and denormalized counts

Revision ID: b7e8f9a0c1d2
Revises: a1b2c3d4e5f6
Create Date: 2026-02-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e8f9a0c1d2'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === ДЕНОРМАЛИЗОВАННЫЕ СЧЕТЧИКИ ===

    # Memes: likes_count, comments_count
    op.add_column('memes', sa.Column('likes_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('memes', sa.Column('comments_count', sa.Integer(), server_default='0', nullable=False))

    # Users: followers_count, following_count
    op.add_column('users', sa.Column('followers_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('following_count', sa.Integer(), server_default='0', nullable=False))

    # === ИНДЕКСЫ НА ТАБЛИЦАХ ===

    # memes
    op.create_index('ix_memes_user_id', 'memes', ['user_id'])
    op.create_index('ix_memes_status', 'memes', ['status'])
    op.create_index('ix_memes_created_at', 'memes', ['created_at'])
    op.create_index('ix_memes_status_created_at', 'memes', ['status', 'created_at'])

    # comments
    op.create_index('ix_comments_meme_id', 'comments', ['meme_id'])
    op.create_index('ix_comments_user_id', 'comments', ['user_id'])
    op.create_index('ix_comments_parent_id', 'comments', ['parent_id'])

    # likes — PK is (user_id, meme_id), need index on meme_id for reverse lookups
    op.create_index('ix_likes_meme_id', 'likes', ['meme_id'])
    op.create_index('ix_likes_created_at', 'likes', ['created_at'])

    # notifications
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_sender_id', 'notifications', ['sender_id'])
    op.create_index('ix_notifications_meme_id', 'notifications', ['meme_id'])
    op.create_index('ix_notifications_user_is_read', 'notifications', ['user_id', 'is_read'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # follows — PK is (follower_id, followed_id), need index on followed_id
    op.create_index('ix_follows_followed_id', 'follows', ['followed_id'])

    # meme_tags — PK is (meme_id, tag_id), need index on tag_id
    op.create_index('ix_meme_tags_tag_id', 'meme_tags', ['tag_id'])

    # blocks — PK is (blocker_id, blocked_id), need index on blocked_id
    op.create_index('ix_blocks_blocked_id', 'blocks', ['blocked_id'])

    # reports
    op.create_index('ix_reports_meme_id', 'reports', ['meme_id'])
    op.create_index('ix_reports_reporter_id', 'reports', ['reporter_id'])

    # === BACKFILL: Заполняем счетчики из существующих данных ===

    op.execute("""
        UPDATE memes SET likes_count = (
            SELECT COUNT(*) FROM likes WHERE likes.meme_id = memes.id
        )
    """)
    op.execute("""
        UPDATE memes SET comments_count = (
            SELECT COUNT(*) FROM comments WHERE comments.meme_id = memes.id
        )
    """)
    op.execute("""
        UPDATE users SET followers_count = (
            SELECT COUNT(*) FROM follows WHERE follows.followed_id = users.id
        )
    """)
    op.execute("""
        UPDATE users SET following_count = (
            SELECT COUNT(*) FROM follows WHERE follows.follower_id = users.id
        )
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_reports_reporter_id', table_name='reports')
    op.drop_index('ix_reports_meme_id', table_name='reports')
    op.drop_index('ix_blocks_blocked_id', table_name='blocks')
    op.drop_index('ix_meme_tags_tag_id', table_name='meme_tags')
    op.drop_index('ix_follows_followed_id', table_name='follows')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_user_is_read', table_name='notifications')
    op.drop_index('ix_notifications_meme_id', table_name='notifications')
    op.drop_index('ix_notifications_sender_id', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_index('ix_likes_created_at', table_name='likes')
    op.drop_index('ix_likes_meme_id', table_name='likes')
    op.drop_index('ix_comments_parent_id', table_name='comments')
    op.drop_index('ix_comments_user_id', table_name='comments')
    op.drop_index('ix_comments_meme_id', table_name='comments')
    op.drop_index('ix_memes_status_created_at', table_name='memes')
    op.drop_index('ix_memes_created_at', table_name='memes')
    op.drop_index('ix_memes_status', table_name='memes')
    op.drop_index('ix_memes_user_id', table_name='memes')

    # Drop columns
    op.drop_column('users', 'following_count')
    op.drop_column('users', 'followers_count')
    op.drop_column('memes', 'comments_count')
    op.drop_column('memes', 'likes_count')
