import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Notification, User, Meme
from app.core.redis import redis_client

# Хелпер для JSON
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, uuid.UUID)):
            return str(obj)
        return super().default(obj)

async def send_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    sender_id: uuid.UUID,
    type: str,
    meme_id: uuid.UUID = None,
    text: str = None,
    sender: User = None, 
    meme: Meme = None
):
    # 1. Сохраняем в БД
    new_notif = Notification(
        user_id=user_id,
        sender_id=sender_id,
        type=type,
        meme_id=meme_id,
        text=text,
        is_read=False
    )
    db.add(new_notif)
    await db.commit()
    await db.refresh(new_notif)

    # 2. Формируем данные для WebSocket
    # ВАЖНО: Мы берем данные из переданных объектов sender/meme, 
    # а не лезем в lazy-loaded поля new_notif, чтобы избежать ошибок Greenlet
    
    sender_data = None
    if sender:
        sender_data = {
            "username": sender.username,
            "avatar_url": sender.avatar_url
        }
    
    meme_data = None
    if meme:
        meme_data = {
            "id": str(meme.id),
            "thumbnail_url": meme.thumbnail_url,
            "media_url": meme.media_url
        }

    notification_payload = {
        "id": str(new_notif.id),
        "type": type,
        "is_read": False,
        "created_at": new_notif.created_at.isoformat(),
        "text": text,
        "sender": sender_data,
        "meme": meme_data,
        "meme_id": str(meme_id) if meme_id else None
    }

    # 3. Публикуем в Redis
    channel = f"notify:{user_id}"
    # Используем json.dumps с нашим энкодером
    await redis_client.publish(channel, json.dumps(notification_payload, cls=DateTimeEncoder))
    
    return new_notif