import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Float, Table, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from app.core.database import Base

# Many-to-Many for Memes <-> Tags
meme_tags = Table(
    "meme_tags",
    Base.metadata,
    Column("meme_id", UUID(as_uuid=True), ForeignKey("memes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

# Many-to-Many for Follows (User <-> User)
follows = Table(
    "follows",
    Base.metadata,
    Column("follower_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("followed_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    header_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    website = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- НОВЫЕ ПОЛЯ НАСТРОЕК (Добавили их сюда) ---
    notify_on_like = Column(Boolean, default=True)
    notify_on_comment = Column(Boolean, default=True)
    notify_on_new_follower = Column(Boolean, default=True)
    notify_on_new_meme = Column(Boolean, default=True)

    # Явные связи (чтобы избежать конфликтов backref)
    memes = relationship("Meme", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    # Используем overlaps="user" чтобы подавить предупреждения, если они возникнут, но лучше back_populates
    # Для комментариев:
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan") 

    notifications = relationship("Notification", foreign_keys="[Notification.user_id]", back_populates="user", cascade="all, delete-orphan")

    followers = relationship(
        "User",
        secondary=follows,
        primaryjoin=(follows.c.followed_id == id),
        secondaryjoin=(follows.c.follower_id == id),
        backref="following"
    )

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class SubjectCategory(str):
    PERSON = "person"
    GAME = "game"
    MOVIE = "movie"
    OTHER = "other"

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    category = Column(String, default="person") # person, game, movie...
    image_url = Column(String, nullable=True)

class Meme(Base):
    __tablename__ = "memes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    
    title = Column(String)
    description = Column(String, nullable=True)
    media_url = Column(String) # путь к файлу
    thumbnail_url = Column(String)
    original_audio_url = Column(String, nullable=True) # если видео
    
    duration = Column(Float, default=0.0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)

    # НОВОЕ ПОЛЕ: Есть ли звук?
    has_audio = Column(Boolean, default=False)
    
    views_count = Column(Integer, default=0)
    status = Column(String, default="pending") # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    user = relationship("User", back_populates="memes")
    subject = relationship("Subject")
    tags = relationship("Tag", secondary=meme_tags, backref="memes")
    likes = relationship("Like", back_populates="meme", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="meme", cascade="all, delete-orphan")

class Like(Base):
    __tablename__ = "likes"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    meme_id = Column(UUID(as_uuid=True), ForeignKey("memes.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="likes")
    meme = relationship("Meme", back_populates="likes")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    meme_id = Column(UUID(as_uuid=True), ForeignKey("memes.id", ondelete="CASCADE"), nullable=False)
    
    # Ссылка на родительский комментарий
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)

    # Связи с использованием back_populates для избежания конфликтов
    user = relationship("User", back_populates="comments")
    meme = relationship("Meme", back_populates="comments")
    
    # Рекурсивная связь (ответы)
    replies = relationship("Comment", 
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan"
    )

class NotificationType(str):
    LIKE = "like"
    COMMENT = "comment"
    FOLLOW = "follow"
    NEW_MEME = "new_meme"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")) # кому
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")) # от кого
    type = Column(String) # like, comment, follow...
    meme_id = Column(UUID(as_uuid=True), ForeignKey("memes.id", ondelete="CASCADE"), nullable=True)
    text = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    sender = relationship("User", foreign_keys=[sender_id])
    meme = relationship("Meme")

class Block(Base):
    __tablename__ = "blocks"
    # Кто заблокировал (current_user)
    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    # Кого заблокировали (bad_user)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ReportReason(str):
    SPAM = "spam"
    VIOLENCE = "violence"
    PORN = "porn"
    COPYRIGHT = "copyright"
    OTHER = "other"

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")) # Кто жалуется
    meme_id = Column(UUID(as_uuid=True), ForeignKey("memes.id", ondelete="CASCADE"), nullable=True) # На что (мем)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True) # На что (коммент)
    
    reason = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="pending") # pending, resolved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    reporter = relationship("User", foreign_keys=[reporter_id])
    meme = relationship("Meme", foreign_keys=[meme_id])
    comment = relationship("Comment", foreign_keys=[comment_id])