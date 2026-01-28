import json
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Notification, User, Meme
from app.schemas import NotificationResponse
from app.core.redis import redis_client

# Хелпер для сериализации datetime и UUID в JSON
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
    sender: User = None, # Передаем объекты, чтобы не делать лишних запросов
    meme: Meme = None
):
    # 1. Сохраняем в БД (PostgreSQL)
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

    # 2. Формируем данные для WebSocket (Redis)
    # Нам нужно отправить JSON, похожий на NotificationResponse
    notification_data = {
        "id": str(new_notif.id),
        "type": type,
        "is_read": False,
        "created_at": new_notif.created_at.isoformat(),
        "text": text,
        "sender": {
            "username": sender.username if sender else "Unknown",
            "avatar_url": sender.avatar_url if sender else None
        },
        "meme": {
            "id": str(meme.id) if meme else None,
            "thumbnail_url": meme.thumbnail_url if meme else None
        } if meme else None,
        "meme_id": str(meme_id) if meme_id else None
    }

    # 3. Публикуем в Redis канал пользователя
    # Канал называется "notify:{user_id}"
    channel = f"notify:{user_id}"
    await redis_client.publish(channel, json.dumps(notification_data, cls=DateTimeEncoder))
    
    return new_notif