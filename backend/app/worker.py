import os
import shutil
import json
import uuid
import redis
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from celery import shared_task

from app.core.config import settings
from app.models.models import Meme, Notification, NotificationType
from app.services.media import MediaProcessor
from app.services.search import get_search_service

# Настройка БД (синхронная для воркера)
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# JSON Encoder для корректной передачи дат и UUID в Redis
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            # ВАЖНО: ISO формат, чтобы Frontend (JS) мог это распарсить
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if hasattr(obj, 'value'):
            # Для Enum (NotificationType)
            return obj.value
        return super().default(obj)

@shared_task(bind=True, max_retries=3, name="app.worker.process_meme_task")
def process_meme_task(self, meme_id_str: str, file_path: str, audio_path: str = None):
    print(f"🚀 Processing meme {meme_id_str}...")
    
    # --- ВАЖНОЕ ИСПРАВЛЕНИЕ ---
    # Создаем соединение с Redis ВНУТРИ задачи.
    # Глобальные соединения в Celery часто ломаются при форке процессов.
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    
    db = SessionLocal()
    try:
        meme_id = meme_id_str 
        meme = db.query(Meme).filter(Meme.id == meme_id).first()
        if not meme:
            print(f"❌ Meme {meme_id} not found in DB")
            return

        processor = MediaProcessor(file_path)
        final_filename = f"{meme_id}.mp4"
        final_path = os.path.join("uploads", final_filename)
        thumbnail_path = os.path.join("uploads", f"{meme_id}_thumb.jpg")

        # 1. ОБРАБОТКА МЕДИА
        if audio_path:
            processor.process_video_with_audio(audio_path, final_path)
            if os.path.exists(audio_path): os.remove(audio_path)
            processor = MediaProcessor(final_path)
        else:
            processor.convert_to_mp4(final_path)
            processor = MediaProcessor(final_path)

        # 2. ПРЕВЬЮ И МЕТАДАННЫЕ
        processor.generate_thumbnail(thumbnail_path)
        duration, width, height = processor.get_metadata()
        has_audio = processor.has_audio_stream()

        # 3. ОБНОВЛЕНИЕ БД
        meme.duration = duration
        meme.width = width
        meme.height = height
        meme.has_audio = has_audio
        meme.status = "approved"
        meme.media_url = f"/static/{final_filename}"
        meme.thumbnail_url = f"/static/{meme_id}_thumb.jpg"
        
        db.commit()

        # 4. ИНДЕКСАЦИЯ
        try:
            search = get_search_service()
            if search:
                search.add_meme({
                    "id": str(meme.id),
                    "title": meme.title,
                    "description": meme.description,
                    "thumbnail_url": meme.thumbnail_url,
                    "media_url": meme.media_url,
                    "views_count": meme.views_count
                })
        except Exception as e:
            print(f"Search index error: {e}")

        # 5. УВЕДОМЛЕНИЯ ПОДПИСЧИКАМ (Real-time)
        try:
            # Данные отправителя
            sender_info = db.execute(
                text("SELECT username, avatar_url FROM users WHERE id = :uid"), 
                {"uid": meme.user_id}
            ).fetchone()
            
            # Список подписчиков
            followers = db.execute(
                text("SELECT follower_id FROM follows WHERE followed_id = :uid"), 
                {"uid": meme.user_id}
            ).fetchall()
            
            for row in followers:
                # А. Запись в БД
                now = datetime.utcnow()
                notif = Notification(
                    user_id=row.follower_id, 
                    sender_id=meme.user_id, 
                    type=NotificationType.NEW_MEME, 
                    meme_id=meme.id,
                    is_read=False,
                    created_at=now
                )
                db.add(notif)
                db.commit() 
                db.refresh(notif)

                # Б. Отправка в Redis (WebSocket)
                try:
                    payload = {
                        "id": str(notif.id),
                        "type": NotificationType.NEW_MEME.value,
                        "is_read": False,
                        "created_at": notif.created_at.isoformat(),
                        "text": None,
                        "sender": {
                            "username": sender_info.username,
                            "avatar_url": sender_info.avatar_url
                        },
                        "meme": {
                            "id": str(meme.id),
                            "thumbnail_url": meme.thumbnail_url,
                            "media_url": meme.media_url
                        },
                        "meme_id": str(meme.id)
                    }
                    
                    channel = f"notify:{str(row.follower_id)}"
                    # Публикуем и получаем кол-во активных слушателей
                    sub_count = redis_client.publish(channel, json.dumps(payload, cls=DateTimeEncoder))
                    print(f"📡 Notification sent to {channel}. Subscribers receiving: {sub_count}")
                    
                except Exception as e:
                    print(f"Redis publish error for user {row.follower_id}: {e}")
        
        except Exception as e:
            print(f"Notification logic error: {e}")

        # Удаляем исходный файл
        if os.path.exists(file_path) and file_path != final_path:
            os.remove(file_path)

        print(f"✅ Meme {meme_id} ready!")

    except Exception as e:
        print(f"❌ Worker Error: {e}")
        try:
            meme.status = "failed"
            db.commit()
        except: pass
    finally:
        db.close()
        # Обязательно закрываем соединение с Redis
        if 'redis_client' in locals():
            redis_client.close()