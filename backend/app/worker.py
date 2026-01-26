import os
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from celery import shared_task

from app.core.config import settings
from app.models.models import Meme
from app.services.media import MediaProcessor

# Синхронный движок для воркера (меняем драйвер с asyncpg на psycopg2)
SYNC_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
engine = create_engine(SYNC_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@shared_task(name="app.worker.process_meme_task")
def process_meme_task(meme_id: str, file_path: str):
    """
    Фоновая задача:
    1. Генерирует превью
    2. Извлекает метаданные (длительность, размеры)
    3. Меняет статус мема на 'approved'
    """
    db = SessionLocal()
    try:
        processor = MediaProcessor(file_path)
        
        # 1. Генерируем превью
        thumb_path = f"{file_path.rsplit('.', 1)[0]}_thumb.jpg"
        processor.generate_thumbnail(thumb_path)
        
        # 2. Получаем метаданные
        duration, width, height = processor.get_metadata()
        has_audio = processor.has_audio_stream()

        # 3. Обновляем мем в БД
        meme = db.query(Meme).filter(Meme.id == meme_id).first()
        if meme:
            meme.thumbnail_url = f"/static/{os.path.basename(thumb_path)}"
            meme.duration = duration
            meme.width = width
            meme.height = height
            meme.has_audio = has_audio
            # Мем готов к показу!
            meme.status = "approved" 
            
            db.commit()
            print(f"✅ Meme {meme_id} processed successfully")
        else:
            print(f"❌ Meme {meme_id} not found in DB")

    except Exception as e:
        print(f"❌ Error processing meme {meme_id}: {e}")
        # Можно поставить статус 'failed'
        meme = db.query(Meme).filter(Meme.id == meme_id).first()
        if meme:
            meme.status = "failed"
            db.commit()
    finally:
        db.close()