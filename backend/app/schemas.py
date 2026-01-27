import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, validator, EmailStr

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    avatar_url: Optional[str] = None
    header_url: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

# --- ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ---
class UserResponse(UserBase):
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    created_at: datetime
    
    # Статистика
    followers_count: int = 0
    following_count: int = 0
    
    # Флаги состояния
    is_following: bool = False
    is_me: bool = False       # <--- Добавлено
    is_blocked: bool = False  # <--- Добавлено

    # Настройки уведомлений (теперь они точно попадут в ответ)
    notify_on_like: bool = True
    notify_on_comment: bool = True
    notify_on_new_follower: bool = True
    notify_on_new_meme: bool = True

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    
# UserProfile используется для ЧУЖИХ профилей (без настроек и email)
class UserProfile(BaseModel):
    id: uuid.UUID
    username: str
    full_name: Optional[str]
    avatar_url: Optional[str]
    header_url: Optional[str]
    bio: Optional[str]
    website: Optional[str]
    created_at: datetime
    
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    is_me: bool = False
    is_blocked: bool = False

    class Config:
        from_attributes = True

# --- Tag & Subject ---
class TagResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class SubjectResponse(BaseModel):
    id: int
    name: str
    slug: str
    category: str
    image_url: Optional[str] = None
    class Config:
        from_attributes = True

# --- Comment ---
class CommentCreate(BaseModel):
    text: str
    parent_id: Optional[uuid.UUID] = None

class CommentResponse(BaseModel):
    id: uuid.UUID
    text: str
    created_at: datetime
    user: UserResponse # Можно заменить на UserProfile, если не хотим светить настройки автора коммента
    meme_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    class Config:
        from_attributes = True

# --- Meme ---
class MemeBase(BaseModel):
    title: str
    description: Optional[str] = None

class MemeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None 

class MemeResponse(MemeBase):
    id: uuid.UUID
    media_url: str
    thumbnail_url: str
    original_audio_url: Optional[str] = None
    
    duration: float
    width: int
    height: int
    
    has_audio: bool = False

    @validator('has_audio', pre=True)
    def parse_has_audio(cls, v):
        return v or False
    
    views_count: int
    status: str
    created_at: datetime
    
    user: UserResponse # Или UserProfile
    tags: List[TagResponse] = []
    subject: Optional[SubjectResponse] = None
    
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False

    class Config:
        from_attributes = True

# --- Notification ---
class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str 
    is_read: bool
    created_at: datetime
    text: Optional[str] = None
    
    sender: Optional[UserResponse] = None
    meme_id: Optional[uuid.UUID] = None
    meme: Optional[MemeResponse] = None 

    class Config:
        from_attributes = True

# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    user_id: Optional[str] = None

# --- Password Reset ---
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# --- Report ---
class ReportCreate(BaseModel):
    reason: str
    description: Optional[str] = None

# --- Block ---
class BlockResponse(BaseModel):
    is_blocked: bool
    user_id: uuid.UUID

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserUpdateSettings(BaseModel):
    notify_on_like: Optional[bool] = None
    notify_on_comment: Optional[bool] = None
    notify_on_new_follower: Optional[bool] = None
    notify_on_new_meme: Optional[bool] = None