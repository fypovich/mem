import uuid
import json
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Notification, User
from app.schemas import NotificationResponse
from app.api.memes import get_current_user
from app.core.security import get_current_user_ws # Нужно будет создать или адаптировать
from app.core.redis import redis_client

router = APIRouter()

# --- WEBSOCKET ENDPOINT ---
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str = Query(...) # Токен передаем в URL: ws://...?token=...
):
    await websocket.accept()
    
    # 1. Авторизация по токену
    try:
        # Импорт здесь, чтобы избежать циклических ссылок, если security.py импортирует что-то
        from app.core.security import get_current_user_ws
        async with AsyncSession(bind=None) as session: # Фиктивная сессия или DI хак, лучше использовать get_db внутри deps
             # В WebSockets сложнее с DI, используем прямую проверку токена
             pass
        
        user = await get_current_user_ws(token)
        if not user:
            await websocket.close(code=1008)
            return
    except Exception as e:
        print(f"WS Auth Error: {e}")
        await websocket.close(code=1008)
        return

    # 2. Подписка на Redis канал пользователя
    pubsub = redis_client.pubsub()
    channel = f"notify:{user.id}"
    await pubsub.subscribe(channel)

    try:
        while True:
            # Ждем сообщение из Redis (с таймаутом, чтобы цикл не вис намертво)
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message:
                # Отправляем данные клиенту
                await websocket.send_text(message["data"])
            
            # Также нужно слушать сам сокет, чтобы понять, если клиент отключился
            # Это простой способ (heartbeat), но для простоты можно просто ждать
            # await asyncio.sleep(0.1) 
            
            # Более правильный паттерн для asyncio + websockets + redis:
            # Запускаем listener в фоне, но так как starlette websocket блокирует поток на receive,
            # мы делаем простой поллинг redis внутри цикла.
            await asyncio.sleep(0.1) 

    except WebSocketDisconnect:
        await pubsub.unsubscribe(channel)
    except Exception as e:
        print(f"WS Error: {e}")
        await pubsub.unsubscribe(channel)


# ... (Остальные методы get_notifications, unread-count, read-all оставляем как есть) ...
# ... Только скопируйте их из предыдущего ответа ...

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0, 
    limit: int = 50,
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
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(func.count()).select_from(Notification).where(
        (Notification.user_id == current_user.id) & 
        (Notification.is_read == False)
    )
    count = await db.scalar(query)
    return {"count": count}

@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Notification).where(
        (Notification.id == notification_id) & 
        (Notification.user_id == current_user.id)
    ).options(
        selectinload(Notification.sender),
        selectinload(Notification.meme)
    )
    result = await db.execute(query)
    notification = result.scalars().first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification