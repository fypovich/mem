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

UNREAD_COUNT_TTL = 300  # 5 минут

def _unread_key(user_id) -> str:
    return f"unread_count:{user_id}"

# --- WEBSOCKET ENDPOINT ---
@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    await websocket.accept()

    user = None
    try:
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

    pubsub = redis_client.pubsub()
    channel = f"notify:{user.id}"
    await pubsub.subscribe(channel)
    print(f"WS Connected: {user.username} -> {channel}")

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)

            if message:
                print(f"WS Sending to {user.username}: {message['data']}")
                await websocket.send_text(message["data"])

            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
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
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .options(
            selectinload(Notification.sender),
            selectinload(Notification.meme).selectinload(Meme.tags)
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
    # Пробуем из Redis кэша
    cache_key = _unread_key(current_user.id)
    try:
        cached = await redis_client.get(cache_key)
        if cached is not None:
            return {"count": int(cached)}
    except Exception:
        pass

    # Идем в БД
    query = select(func.count()).select_from(Notification).where(
        (Notification.user_id == current_user.id) &
        (Notification.is_read == False)
    )
    count = await db.scalar(query)

    # Кэшируем
    try:
        await redis_client.set(cache_key, str(count), ex=UNREAD_COUNT_TTL)
    except Exception:
        pass

    return {"count": count}

@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await db.execute(
        update(Notification)
        .where(
            (Notification.user_id == current_user.id) &
            (Notification.is_read == False)
        )
        .values(is_read=True)
    )
    await db.commit()

    # Инвалидируем кэш
    try:
        await redis_client.delete(_unread_key(current_user.id))
    except Exception:
        pass

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
        selectinload(Notification.meme).selectinload(Meme.tags)
    )
    result = await db.execute(query)
    notification = result.scalars().first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    # Инвалидируем кэш
    try:
        await redis_client.delete(_unread_key(current_user.id))
    except Exception:
        pass

    return notification
