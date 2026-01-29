import uuid
import os
import aiofiles
import sqlalchemy as sa
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, insert, exists
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import User, follows, Notification, NotificationType, Block
from app.api.memes import get_optional_current_user
from app.api.deps import get_current_user
from app.schemas import UserResponse, UserProfile, UserUpdate, BlockResponse, ChangePasswordRequest, UserUpdateSettings 
from app.core.security import verify_password, get_password_hash
from app.utils.notifier import send_notification

router = APIRouter()
UPLOAD_DIR = "uploads"

# --- ЭНДПОИНТЫ ПОДПИСОК ---

@router.post("/{username}/follow")
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(User).where(User.username == username)
    result = await db.execute(query)
    target_user = result.scalars().first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow self")

    stmt = select(follows).where(
        (follows.c.follower_id == current_user.id) & 
        (follows.c.followed_id == target_user.id)
    )
    result = await db.execute(stmt)
    existing_follow = result.first()

    if existing_follow:
        # --- ОТПИСКА ---
        await db.execute(
            sa.delete(follows).where(
                (follows.c.follower_id == current_user.id) & 
                (follows.c.followed_id == target_user.id)
            )
        )
        # Удаляем уведомление о подписке при отписке
        await db.execute(
            sa.delete(Notification).where(
                (Notification.sender_id == current_user.id) &
                (Notification.user_id == target_user.id) &
                (Notification.type == NotificationType.FOLLOW)
            )
        )
        action = "unfollowed"
    else:
        # --- ПОДПИСКА ---
        await db.execute(
            sa.insert(follows).values(follower_id=current_user.id, followed_id=target_user.id)
        )
        action = "followed"
        
        if getattr(target_user, 'notify_on_new_follower', True):
             # ПРОВЕРКА: Есть ли уже уведомление о подписке от этого юзера?
             existing_notif = await db.scalar(
                select(Notification).where(
                    (Notification.sender_id == current_user.id) &
                    (Notification.user_id == target_user.id) &
                    (Notification.type == NotificationType.FOLLOW)
                )
             )
             
             if not existing_notif:
                 await send_notification(
                    db=db,
                    user_id=target_user.id,
                    sender_id=current_user.id,
                    type=NotificationType.FOLLOW,
                    sender=current_user
                )

    await db.commit()
    
    count_stmt = select(func.count()).select_from(follows).where(follows.c.followed_id == target_user.id)
    count = await db.execute(count_stmt)
    
    return {
        "action": action, 
        "followers_count": count.scalar()
    }

@router.get("/{username}/followers", response_model=List[UserProfile])
async def get_followers(username: str, db: AsyncSession = Depends(get_db)):
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalars().first()
    if not user: return []

    stmt = (
        select(User)
        .join(follows, follows.c.follower_id == User.id)
        .where(follows.c.followed_id == user.id)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{username}/following", response_model=List[UserProfile])
async def get_following(username: str, db: AsyncSession = Depends(get_db)):
    user_res = await db.execute(select(User).where(User.username == username))
    user = user_res.scalars().first()
    if not user: return []

    stmt = (
        select(User)
        .join(follows, follows.c.followed_id == User.id)
        .where(follows.c.follower_id == user.id)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{user_id}/check-follow")
async def check_follow(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(follows).where(
        (follows.c.follower_id == current_user.id) & 
        (follows.c.followed_id == user_id)
    )
    result = await db.execute(stmt)
    return {"is_following": result.first() is not None}

# --- ПРОФИЛЬ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ---

@router.get("/me", response_model=UserResponse) # <--- ИСПРАВЛЕНО: UserResponse (содержит настройки)
async def read_users_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    followers = await db.scalar(select(func.count()).select_from(follows).where(follows.c.followed_id == current_user.id))
    following = await db.scalar(select(func.count()).select_from(follows).where(follows.c.follower_id == current_user.id))
    
    current_user.followers_count = followers
    current_user.following_count = following
    
    # Явно проставляем флаги для схемы
    current_user.is_me = True
    current_user.is_following = False
    current_user.is_blocked = False

    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_user_me(
    full_name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    avatar_file: UploadFile = File(None),
    header_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if full_name is not None: current_user.full_name = full_name
    if bio is not None: current_user.bio = bio
    if website is not None: current_user.website = website

    if avatar_file:
        ext = avatar_file.filename.split('.')[-1]
        filename = f"avatar_{current_user.id}.{ext}"
        path = os.path.join(UPLOAD_DIR, filename)
        async with aiofiles.open(path, 'wb') as f:
            await f.write(await avatar_file.read())
        current_user.avatar_url = f"/static/{filename}"

    if header_file:
        ext = header_file.filename.split('.')[-1]
        filename = f"header_{current_user.id}.{ext}"
        path = os.path.join(UPLOAD_DIR, filename)
        async with aiofiles.open(path, 'wb') as f:
            await f.write(await header_file.read())
        current_user.header_url = f"/static/{filename}"

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    # Для ответа
    current_user.is_me = True
    
    return current_user

@router.post("/me/password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    
    current_user.hashed_password = get_password_hash(body.new_password)
    db.add(current_user)
    await db.commit()
    return None

@router.patch("/me/settings", response_model=UserResponse)
async def update_settings(
    settings: UserUpdateSettings,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    update_data = settings.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    current_user.is_me = True
    return current_user

# --- ПУБЛИЧНЫЙ ПРОФИЛЬ ---

@router.get("/{username}", response_model=UserProfile) # <--- ЧУЖОЙ ПРОФИЛЬ (БЕЗ НАСТРОЕК)
async def read_user(
    username: str, 
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    query = select(User).where(User.username == username)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    followers = await db.scalar(select(func.count()).select_from(follows).where(follows.c.followed_id == user.id))
    following = await db.scalar(select(func.count()).select_from(follows).where(follows.c.follower_id == user.id))
    
    user.followers_count = followers
    user.following_count = following

    if current_user:
        user.is_me = (user.id == current_user.id)
        
        # Проверка подписки
        is_following_query = select(follows).where(
            (follows.c.follower_id == current_user.id) & 
            (follows.c.followed_id == user.id)
        )
        user.is_following = (await db.execute(is_following_query)).first() is not None
        
        # Проверка блокировки
        is_blocked_query = select(Block).where(
            (Block.blocker_id == current_user.id) & 
            (Block.blocked_id == user.id)
        )
        user.is_blocked = (await db.execute(is_blocked_query)).first() is not None
    else:
        user.is_me = False
        user.is_following = False
        user.is_blocked = False

    return user

# --- БЛОКИРОВКИ ---

@router.post("/{user_id}/block", response_model=BlockResponse)
async def block_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block self")

    # Проверяем, есть ли уже блок
    query = select(Block).where((Block.blocker_id == current_user.id) & (Block.blocked_id == user_id))
    existing = await db.execute(query)
    if existing.scalars().first():
        return {"is_blocked": True, "user_id": user_id} 

    # Создаем блок
    new_block = Block(blocker_id=current_user.id, blocked_id=user_id)
    db.add(new_block)
    
    # При блокировке нужно отписаться друг от друга
    await db.execute(sa.delete(follows).where(
        (follows.c.follower_id == current_user.id) & (follows.c.followed_id == user_id)
    ))
    await db.execute(sa.delete(follows).where(
        (follows.c.follower_id == user_id) & (follows.c.followed_id == current_user.id)
    ))

    await db.commit()
    return {"is_blocked": True, "user_id": user_id}

@router.post("/{user_id}/unblock", response_model=BlockResponse)
async def unblock_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Block).where((Block.blocker_id == current_user.id) & (Block.blocked_id == user_id))
    result = await db.execute(query)
    block = result.scalars().first()
    
    if block:
        await db.delete(block)
        await db.commit()
    
    return {"is_blocked": False, "user_id": user_id}