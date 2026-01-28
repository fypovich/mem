import uuid
import json
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Notification, User, Meme
from app.schemas import NotificationResponse
from app.api.deps import get_current_user
from app.core.redis import redis_client

router = APIRouter()

# --- WEBSOCKET ENDPOINT ---
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str = Query(...) 
):
    await websocket.accept()
    
    user = None
    try:
        # Импорт здесь, чтобы избежать циклических ссылок
        from app.core.security import get_current_user_ws
        user = await get_current_user_ws(token)
        
        if not user:
            print(f"WS Auth Failed: User not found for token")
            await websocket.close(code=1008)
            return
            
    except Exception as e:
        print(f"WS Auth Error: {e}")
        await websocket.close(code=1008)
        return

    # Подписка на Redis канал
    pubsub = redis_client.pubsub()
    channel = f"notify:{user.id}"
    await pubsub.subscribe(channel)
    print(f"WS Connected: {user.username} -> {channel}")

    try:
        while True:
            # Слушаем Redis
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message:
                print(f"WS Sending to {user.username}: {message['data']}")
                await websocket.send_text(message["data"])
            
            # Пингуем клиент, чтобы держать соединение (и обнаружить разрыв)
            # Встроенный ping/pong есть, но полезно просто отдать управление event loop
            try:
                # Ждем данные от клиента (он вряд ли что-то шлет, но если разорвет - вылетит тут)
                # Используем wait_for с таймаутом, чтобы не блокировать цикл
                await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass # Таймаут - это ок, просто идем дальше слушать Redis
            except WebSocketDisconnect:
                print(f"WS Disconnected client: {user.username}")
                break

    except Exception as e:
        print(f"WS Loop Error: {e}")
    finally:
        await pubsub.unsubscribe(channel)
        try:
            await websocket.close()
        except:
            pass


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0, 
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ИСПРАВЛЕНИЕ: Подгружаем вложенные связи для мема!
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .options(
            selectinload(Notification.sender),
            # Важно: загружаем Meme, а внутри него tags и subject
            selectinload(Notification.meme).selectinload(Meme.tags),
            selectinload(Notification.meme).selectinload(Meme.subject)
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
    # Здесь тоже нужно подгрузить связи, чтобы вернуть полный объект
    query = select(Notification).where(
        (Notification.id == notification_id) & 
        (Notification.user_id == current_user.id)
    ).options(
        selectinload(Notification.sender),
        selectinload(Notification.meme).selectinload(Meme.tags),
        selectinload(Notification.meme).selectinload(Meme.subject)
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