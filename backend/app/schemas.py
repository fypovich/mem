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

class UserResponse(UserBase):
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    is_following: bool = False
    followers_count: int = 0
    following_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    website: Optional[str] = None
    # Password update is usually handled separately or requires logic
    
class UserProfile(BaseModel):
    id: uuid.UUID
    username: str
    email: str 
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
    user: UserResponse
    meme_id: uuid.UUID
    parent_id: Optional[uuid.UUID] = None
    
    class Config:
        from_attributes = True

# --- Meme ---
class MemeBase(BaseModel):
    title: str
    description: Optional[str] = None

# Схема для обновления мема
class MemeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None # Принимаем строку через запятую для упрощения

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
    
    user: UserResponse
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
    reason: str # spam, violence, etc.
    description: Optional[str] = None

# --- Block ---
class BlockResponse(BaseModel):
    is_blocked: bool
    user_id: uuid.UUID