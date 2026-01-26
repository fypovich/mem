import os
import uuid
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
from app.api.memes import get_current_user, get_optional_current_user
from app.schemas import UserResponse, UserProfile, UserUpdate, BlockResponse 

router = APIRouter()
UPLOAD_DIR = "uploads"

# --- ЭНДПОИНТЫ ПОДПИСОК ---

# ... импорты ...
from app.models.models import User, follows, Notification, NotificationType

@router.post("/{username}/follow")
async def follow_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Ищем цель подписки (переменная target_user)
    query = select(User).where(User.username == username)
    result = await db.execute(query)
    target_user = result.scalars().first() # <-- Было target_user
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow self")

    # 2. Проверяем подписку
    stmt = select(follows).where(
        (follows.c.follower_id == current_user.id) & 
        (follows.c.followed_id == target_user.id) # <-- Используем target_user
    )
    result = await db.execute(stmt)
    existing_follow = result.first()

    if existing_follow:
        await db.execute(
            delete(follows).where(
                (follows.c.follower_id == current_user.id) & 
                (follows.c.followed_id == target_user.id) # <-- Используем target_user
            )
        )
        action = "unfollowed"
    else:
        await db.execute(
            insert(follows).values(follower_id=current_user.id, followed_id=target_user.id) # <-- Используем target_user
        )
        action = "followed"
        
        # --- УВЕДОМЛЕНИЕ ---
        notif = Notification(
            user_id=target_user.id,          # Кому: target_user
            sender_id=current_user.id,
            type=NotificationType.FOLLOW
        )
        db.add(notif)

    await db.commit()
    
    count_stmt = select(func.count()).select_from(follows).where(follows.c.followed_id == target_user.id)
    count = await db.execute(count_stmt)
    
    return {
        "action": action, 
        "followers_count": count.scalar()
    }

# --- ПОЛУЧЕНИЕ СПИСКОВ ---

@router.get("/{username}/followers", response_model=List[UserProfile])
async def get_user_followers(username: str, db: AsyncSession = Depends(get_db)):
    # Находим пользователя
    user_stmt = select(User).where(User.username == username)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user: raise HTTPException(status_code=404)

    # Выбираем всех юзеров, которые являются фолловерами
    query = (
        select(User)
        .join(follows, User.id == follows.c.follower_id)
        .where(follows.c.followed_id == user.id)
    )
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/{username}/following", response_model=List[UserProfile])
async def get_user_following(username: str, db: AsyncSession = Depends(get_db)):
    # Находим пользователя
    user_stmt = select(User).where(User.username == username)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if not user: raise HTTPException(status_code=404)

    # Выбираем всех юзеров, на которых подписан user
    query = (
        select(User)
        .join(follows, User.id == follows.c.followed_id)
        .where(follows.c.follower_id == user.id)
    )
    res = await db.execute(query)
    return res.scalars().all()


# --- ЧТЕНИЕ ПРОФИЛЯ ---

@router.get("/me", response_model=UserProfile)
async def read_users_me(current_user: User = Depends(get_current_user)):
    # Для /me статистика тоже нужна, но пока вернем как есть, можно расширить
    current_user.is_me = True
    return current_user

@router.get("/{username}", response_model=UserProfile)
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

    # 1. Считаем подписчиков
    followers_count = await db.scalar(
        select(func.count()).select_from(follows).where(follows.c.followed_id == user.id)
    )
    
    # 2. Считаем подписки
    following_count = await db.scalar(
        select(func.count()).select_from(follows).where(follows.c.follower_id == user.id)
    )

    # 3. Проверяем подписку и БЛОКИРОВКУ
    is_following = False
    is_me = False
    is_blocked = False # <--- Новая переменная
    
    if current_user:
        if current_user.id == user.id:
            is_me = True
        else:
            # Проверка подписки
            check_follow = await db.scalar(
                select(exists().where(
                    (follows.c.follower_id == current_user.id) & 
                    (follows.c.followed_id == user.id)
                ))
            )
            is_following = check_follow

            # Проверка блокировки (Я заблокировал ЕГО?)
            check_block = await db.scalar(
                select(exists().where(
                    (Block.blocker_id == current_user.id) & 
                    (Block.blocked_id == user.id)
                ))
            )
            is_blocked = check_block

    # Заполняем поля
    user_response = UserProfile.from_orm(user)
    user_response.followers_count = followers_count or 0
    user_response.following_count = following_count or 0
    user_response.is_following = is_following
    user_response.is_me = is_me
    user_response.is_blocked = is_blocked # <--- Передаем статус
    
    return user_response

# --- ОБНОВЛЕНИЕ ПРОФИЛЯ ---
@router.patch("/me", response_model=UserProfile)
async def update_user_me(
    full_name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    avatar_file: UploadFile = File(None),
    header_file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if avatar_file:
        file_ext = avatar_file.filename.split(".")[-1]
        filename = f"avatar_{current_user.id}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await avatar_file.read()
            await out_file.write(content)
        current_user.avatar_url = f"/static/{filename}"

    if header_file:
        file_ext = header_file.filename.split(".")[-1]
        filename = f"header_{current_user.id}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await header_file.read()
            await out_file.write(content)
        current_user.header_url = f"/static/{filename}"

    if full_name is not None: current_user.full_name = full_name
    if bio is not None: current_user.bio = bio
    if website is not None: current_user.website = website

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return current_user

@router.post("/{user_id}/block", response_model=BlockResponse)
async def block_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Заблокировать пользователя"""
    if user_id == current_user.id:
        raise HTTPException(400, "Cannot block yourself")
    
    # Проверяем существование
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(404, "User not found")

    # Проверяем, есть ли уже блок
    query = select(Block).where((Block.blocker_id == current_user.id) & (Block.blocked_id == user_id))
    existing = await db.execute(query)
    if existing.scalars().first():
        return {"is_blocked": True, "user_id": user_id} # Уже заблокирован

    # Создаем блок
    new_block = Block(blocker_id=current_user.id, blocked_id=user_id)
    db.add(new_block)
    
    # ВАЖНО: При блокировке нужно отписаться друг от друга
    # 1. Я отписываюсь от него
    await db.execute(sa.delete(follows).where(
        (follows.c.follower_id == current_user.id) & (follows.c.followed_id == user_id)
    ))
    # 2. Он отписывается от меня (принудительно)
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
    """Разблокировать пользователя"""
    query = select(Block).where((Block.blocker_id == current_user.id) & (Block.blocked_id == user_id))
    result = await db.execute(query)
    block_entry = result.scalars().first()

    if block_entry:
        await db.delete(block_entry)
        await db.commit()
    
    return {"is_blocked": False, "user_id": user_id}