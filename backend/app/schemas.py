import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    avatar_url: Optional[str] = None

class UserResponse(UserBase):
    id: uuid.UUID
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# --- НОВАЯ СХЕМА УВЕДОМЛЕНИЙ ---
class NotificationResponse(BaseModel):
    id: int
    type: str # 'follow', 'like', 'comment', 'new_meme', 'system'
    is_read: bool
    created_at: datetime
    text: Optional[str] = None
    
    # Вложенные объекты (Optional, так как могут отсутствовать)
    sender: Optional[UserResponse] = None
    meme_id: Optional[uuid.UUID] = None
    meme_thumbnail: Optional[str] = None # Для отображения превью мема

    class Config:
        from_attributes = True

# --- Tag & Subject Schemas (ДОБАВЛЕНО) ---
class TagResponse(BaseModel):
    name: str
    class Config:
        from_attributes = True

class SubjectResponse(BaseModel):
    name: str
    slug: str
    class Config:
        from_attributes = True

# --- Meme Schemas ---
class MemeBase(BaseModel):
    title: str
    description: Optional[str] = None

class MemeCreate(MemeBase):
    pass

class MemeResponse(MemeBase):
    id: uuid.UUID
    media_url: str
    thumbnail_url: str
    duration: float
    width: int
    height: int
    views_count: int
    created_at: datetime
    user: UserResponse

    # Теперь эти классы определены выше, ошибки не будет
    tags: List[TagResponse] = []        
    subject: Optional[SubjectResponse] = None 
    
    # --- СТАТИСТИКА ---
    likes_count: int = 0
    comments_count: int = 0 
    is_liked: bool = False
    # ------------------
    
    class Config:
        from_attributes = True

# --- Comment Schemas ---
class CommentBase(BaseModel):
    text: str

class CommentCreate(BaseModel):
    text: str
    parent_id: Optional[uuid.UUID] = None

class CommentResponse(BaseModel):
    id: uuid.UUID
    text: str
    created_at: datetime
    user: UserResponse
    meme_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None # <-- Добавили

    class Config:
        from_attributes = True


class UserProfile(BaseModel):
    id: uuid.UUID
    username: str
    email: str # Email можно скрывать для чужих, но пока оставим
    full_name: Optional[str]
    avatar_url: Optional[str]
    header_url: Optional[str]
    bio: Optional[str]
    website: Optional[str]
    created_at: datetime
    
    # --- НОВЫЕ ПОЛЯ ---
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False  # Подписан ли текущий юзер на этого?
    is_me: bool = False         # Это мой профиль?
    # ------------------

    class Config:
        from_attributes = True