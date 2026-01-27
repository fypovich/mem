import os
import shutil
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from celery import shared_task

from app.core.config import settings
from app.models.models import Meme, Notification, NotificationType, follows
from app.services.media import MediaProcessor
from app.services.search import get_search_service

# Синхронный движок для воркера
SYNC_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
engine = create_engine(SYNC_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

UPLOAD_DIR = "uploads"

@shared_task(name="app.worker.process_meme_task")
def process_meme_task(meme_id: str, file_path: str, audio_path: str = None):
    db = SessionLocal()
    try:
        print(f"🚀 Processing meme {meme_id}...")
        
        # Находим мем
        meme = db.query(Meme).filter(Meme.id == meme_id).first()
        if not meme:
            print(f"❌ Meme {meme_id} not found")
            return

        file_id = meme_id # Используем ID мема как имя файла
        
        # Определяем расширение и тип
        original_ext = file_path.split('.')[-1].lower()
        is_image = original_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
        
        # Логика выходного файла
        # Если есть аудио или это видео -> MP4. Иначе -> Оригинал.
        is_final_video = True
        if is_image and not audio_path:
            is_final_video = False
            
        final_filename = f"{file_id}.mp4" if is_final_video else f"{file_id}.{original_ext}"
        final_path = os.path.join(UPLOAD_DIR, final_filename)
        thumbnail_path = os.path.join(UPLOAD_DIR, f"{file_id}_thumb.jpg")

        processor = MediaProcessor(file_path)

        # 1. КОНВЕРТАЦИЯ / СКЛЕЙКА
        if audio_path:
            # Склейка с аудио
            processor.process_video_with_audio(audio_path, final_path)
            # Удаляем временный аудио файл
            if os.path.exists(audio_path): os.remove(audio_path)
            processor = MediaProcessor(final_path) # Переключаемся на результат
            
        elif is_final_video and original_ext != 'mp4':
             # Если это видео, но не MP4 -> можно конвертировать (по желанию)
             # Пока просто копируем, если формат поддерживается
             shutil.copy(file_path, final_path)
             processor = MediaProcessor(final_path)
             
        elif not is_final_video:
             # Картинка/GIF -> просто копируем
             shutil.copy(file_path, final_path)
             processor = MediaProcessor(final_path)
        else:
             # Уже MP4
             shutil.copy(file_path, final_path)
             processor = MediaProcessor(final_path)

        # 2. МЕТАДАННЫЕ
        duration, width, height = processor.get_metadata()
        
        # Определяем has_audio
        has_audio = False
        if is_final_video:
            if audio_path: 
                has_audio = True
            else:
                has_audio = processor.has_audio_stream()
        
        # 3. ПРЕВЬЮ
        processor.generate_thumbnail(thumbnail_path)

        # 4. ОБНОВЛЕНИЕ БД
        meme.media_url = f"/static/{final_filename}"
        meme.thumbnail_url = f"/static/{os.path.basename(thumbnail_path)}"
        meme.duration = duration
        meme.width = width
        meme.height = height
        meme.has_audio = has_audio
        meme.status = "approved"
        
        db.commit()
        
        # 5. ИНДЕКСАЦИЯ (Meilisearch)
        # (в синхронном коде можно использовать requests или тот же клиент если он поддерживает sync)
        # Для простоты пропустим или добавим позже, т.к. клиент у нас async
        
        # 6. УВЕДОМЛЕНИЯ (Создаем записи в БД)
        # Получаем подписчиков (Raw SQL для скорости или через ORM)
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

        # Чистим исходник
        if os.path.exists(file_path): os.remove(file_path)
        
        print(f"✅ Meme {meme_id} ready!")

    except Exception as e:
        print(f"❌ Worker Error: {e}")
        # Ставим статус failed
        try:
            meme.status = "failed"
            db.commit()
        except:
            pass
    finally:
        db.close()