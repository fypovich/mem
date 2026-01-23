import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import String, Text, Float, Integer, ForeignKey, DateTime, Table, Column, Boolean, Enum as PgEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

# --- Enums ---
class MemeStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class SubjectCategory(str, Enum):
    PERSON = "person"
    GAME = "game"
    MOVIE = "movie"
    OTHER = "other"

class NotificationType(str, Enum):
    FOLLOW = "follow"
    LIKE = "like"
    COMMENT = "comment"
    SYSTEM = "system"
    NEW_MEME = "new_meme"

# --- Association Tables ---
follows = Table(
    "follows",
    Base.metadata,
    Column("follower_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("followed_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)

meme_tags = Table(
    "meme_tags",
    Base.metadata,
    Column("meme_id", UUID(as_uuid=True), ForeignKey("memes.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)

# --- Models ---

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    header_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    memes: Mapped[List["Meme"]] = relationship(back_populates="user")
    likes: Mapped[List["Like"]] = relationship(back_populates="user")
    comments: Mapped[List["Comment"]] = relationship(back_populates="user")

    # Уведомления, которые получил этот пользователь
    notifications: Mapped[List["Notification"]] = relationship("Notification", foreign_keys="[Notification.user_id]", back_populates="user")

    following: Mapped[List["User"]] = relationship(
        "User", 
        secondary=follows,
        primaryjoin=id==follows.c.follower_id,
        secondaryjoin=id==follows.c.followed_id,
        back_populates="followers"
    )
    
    followers: Mapped[List["User"]] = relationship(
        "User", 
        secondary=follows,
        primaryjoin=id==follows.c.followed_id,
        secondaryjoin=id==follows.c.follower_id,
        back_populates="following"
    )

class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True)
    category: Mapped[SubjectCategory] = mapped_column(PgEnum(SubjectCategory), default=SubjectCategory.PERSON)
    image_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    memes: Mapped[List["Meme"]] = relationship(back_populates="subject")

class Tag(Base):
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    memes: Mapped[List["Meme"]] = relationship(secondary=meme_tags, back_populates="tags")

class Meme(Base):
    __tablename__ = "memes"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    subject_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_url: Mapped[str] = mapped_column(String)
    thumbnail_url: Mapped[str] = mapped_column(String)
    original_audio_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    duration: Mapped[float] = mapped_column(Float, default=0.0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[MemeStatus] = mapped_column(PgEnum(MemeStatus), default=MemeStatus.PENDING, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="memes")
    subject: Mapped[Optional["Subject"]] = relationship(back_populates="memes")
    tags: Mapped[List["Tag"]] = relationship(secondary=meme_tags, back_populates="memes")
    likes: Mapped[List["Like"]] = relationship(back_populates="meme", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="meme")

class Like(Base):
    __tablename__ = "likes"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    meme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("memes.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user: Mapped["User"] = relationship(back_populates="likes")
    meme: Mapped["Meme"] = relationship(back_populates="likes")

class Comment(Base):
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    meme_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("memes.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user: Mapped["User"] = relationship(back_populates="comments")
    meme: Mapped["Meme"] = relationship(back_populates="comments")

# НОВОЕ: Модель Уведомления
class Notification(Base):
    __tablename__ = "notifications"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id")) # Получатель
    sender_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True) # Инициатор (кто лайкнул/подписался)
    
    type: Mapped[NotificationType] = mapped_column(PgEnum(NotificationType))
    meme_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("memes.id"), nullable=True) # Ссылка на мем (для лайков/комментов)
    text: Mapped[Optional[str]] = mapped_column(String, nullable=True) # Текст (для системных или комментов)
    
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Связи
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    sender: Mapped[Optional["User"]] = relationship("User", foreign_keys=[sender_id])
    meme: Mapped[Optional["Meme"]] = relationship("Meme")