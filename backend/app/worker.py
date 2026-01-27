import os
import shutil
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from celery import shared_task

from app.core.config import settings
from app.models.models import Meme, Notification, NotificationType, follows
from app.services.media import MediaProcessor
from app.services.search import get_search_service

# Настройка БД (синхронная для Celery)
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@shared_task(bind=True, max_retries=3, name="app.worker.process_meme_task")
def process_meme_task(self, meme_id_str: str, file_path: str, audio_path: str = None):
    print(f"🚀 Processing meme {meme_id_str}...")
    db = SessionLocal()
    try:
        meme_id = meme_id_str 
        # (Если у вас в базе UUID, алхимия сама преобразует строку, или можно uuid.UUID(meme_id_str))

        # Ищем мем
        meme = db.query(Meme).filter(Meme.id == meme_id).first()
        if not meme:
            print(f"❌ Meme {meme_id} not found in DB")
            return

        processor = MediaProcessor(file_path)
        final_filename = f"{meme_id}.mp4"
        final_path = os.path.join("uploads", final_filename)
        thumbnail_path = os.path.join("uploads", f"{meme_id}_thumb.jpg")

        # 1. ОБРАБОТКА ВИДЕО
        if audio_path:
            # Склейка с аудио
            processor.process_video_with_audio(audio_path, final_path)
            # Удаляем временный аудиофайл
            if os.path.exists(audio_path): os.remove(audio_path)
            processor = MediaProcessor(final_path) # Обновляем процессор на новый файл
        else:
            # ПРОСТО ВИДЕО: КОНВЕРТИРУЕМ В H.264 ОБЯЗАТЕЛЬНО
            processor.convert_to_mp4(final_path)
            processor = MediaProcessor(final_path)

        # 2. ГЕНЕРАЦИЯ ПРЕВЬЮ
        processor.generate_thumbnail(thumbnail_path)
        
        # 3. МЕТАДАННЫЕ
        duration, width, height = processor.get_metadata()
        has_audio = processor.has_audio_stream()

        # 4. ОБНОВЛЕНИЕ БД
        meme.duration = duration
        meme.width = width
        meme.height = height
        meme.has_audio = has_audio
        meme.status = "approved"
        
        # Генерируем правильные URL
        meme.media_url = f"/static/{final_filename}"
        meme.thumbnail_url = f"/static/{meme_id}_thumb.jpg"
        
        db.commit()

        # 5. ИНДЕКСАЦИЯ И УВЕДОМЛЕНИЯ
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

        # Уведомления подписчикам
        followers = db.execute(
            text("SELECT follower_id FROM follows WHERE followed_id = :uid"), 
            {"uid": meme.user_id}
        ).fetchall()
        
        for row in followers:
            notif = Notification(
                user_id=row.follower_id, 
                sender_id=meme.user_id, 
                type=NotificationType.NEW_MEME, 
                meme_id=meme.id
            )
            db.add(notif)
        db.commit()

        # Удаляем исходник
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