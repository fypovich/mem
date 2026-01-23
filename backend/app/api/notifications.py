from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Notification, User, Meme
from app.schemas import NotificationResponse
from app.api.memes import get_current_user

router = APIRouter()

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0, 
    limit: int = 20, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .options(
            selectinload(Notification.sender),
            selectinload(Notification.meme)
        )
        .order_by(desc(Notification.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    # Формируем ответ, добавляя meme_thumbnail вручную, если есть мем
    response = []
    for notif in notifications:
        item = NotificationResponse.from_orm(notif)
        if notif.meme:
            item.meme_thumbnail = notif.meme.thumbnail_url
        response.append(item)
        
    return response

@router.patch("/{id}/read")
async def mark_as_read(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        update(Notification)
        .where((Notification.id == id) & (Notification.user_id == current_user.id))
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}

@router.post("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}

@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where((Notification.user_id == current_user.id) & (Notification.is_read == False))
    )
    return {"count": count}