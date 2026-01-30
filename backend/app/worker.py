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
from app.models.models import Meme, Notification, NotificationType, SearchTerm
from app.services.media import MediaProcessor
from app.services.search import get_search_service
from app.services.ai import AIService
from app.services.editor import VideoEditorService
from app.services.sticker import StickerService

# Настройка БД (синхронная для воркера)
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

@shared_task(bind=True, max_retries=3, name="app.worker.process_meme_task")
def process_meme_task(self, meme_id_str: str, file_path: str, audio_path: str = None):
    print(f"🚀 Processing meme {meme_id_str}...")
    
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

        # --- ОБРАБОТКА ---
        if audio_path:
            processor.process_video_with_audio(audio_path, final_path)
            if os.path.exists(audio_path): os.remove(audio_path)
            processor = MediaProcessor(final_path)
        else:
            processor.convert_to_mp4(final_path)
            processor = MediaProcessor(final_path)

        processor.generate_thumbnail(thumbnail_path)
        duration, width, height = processor.get_metadata()
        has_audio = processor.has_audio_stream()

        # --- СОХРАНЕНИЕ В БД ---
        meme.duration = duration
        meme.width = width
        meme.height = height
        meme.has_audio = has_audio
        meme.status = "approved"
        meme.media_url = f"/static/{final_filename}"
        meme.thumbnail_url = f"/static/{meme_id}_thumb.jpg"
        
        db.commit()

        # --- ИНДЕКСАЦИЯ ---
        try:
            index_meme_task.delay({
                "id": str(meme.id),
                "title": meme.title,
                "description": meme.description,
                "thumbnail_url": meme.thumbnail_url,
                "media_url": meme.media_url,
                "views_count": meme.views_count
            })
        except Exception as e:
            print(f"Search index trigger error: {e}")

        # --- УВЕДОМЛЕНИЯ ---
        try:
            sender_info = db.execute(
                text("SELECT username, avatar_url FROM users WHERE id = :uid"), 
                {"uid": meme.user_id}
            ).fetchone()
            
            followers = db.execute(
                text("SELECT follower_id FROM follows WHERE followed_id = :uid"), 
                {"uid": meme.user_id}
            ).fetchall()
            
            for row in followers:
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

                try:
                    payload = {
                        "id": str(notif.id),
                        "type": NotificationType.NEW_MEME, 
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
                    redis_client.publish(channel, json.dumps(payload, cls=DateTimeEncoder))
                except Exception as e:
                    print(f"Redis publish error: {e}")
                    
        except Exception as e:
             print(f"Notification error: {e}")

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
        redis_client.close()

# --- ВСПОМОГАТЕЛЬНЫЕ ЗАДАЧИ ---

@shared_task(name="app.worker.index_meme_task")
def index_meme_task(meme_data: dict):
    try:
        search = get_search_service()
        if search:
            search.add_meme(meme_data)
            print(f"🔍 Indexed meme {meme_data.get('id')}")
    except Exception as e:
        print(f"Index error: {e}")

@shared_task(name="app.worker.delete_index_task")
def delete_index_task(meme_id: str):
    try:
        search = get_search_service()
        if search:
            search.index_memes.delete_document(meme_id)
            print(f"🗑️ Deleted from index {meme_id}")
    except Exception as e:
        print(f"Delete index error: {e}")

@shared_task(name="app.worker.sync_views_task")
def sync_views_task():
    """Синхронизация просмотров из Redis в Postgres"""
    print("⏳ Starting views sync...")
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    db = SessionLocal()
    updated_count = 0
    
    try:
        # ИСПОЛЬЗУЕМ scan_iter ВМЕСТО scan - ЭТО НАДЕЖНЕЕ
        # Это предотвращает бесконечные циклы и ошибки типов курсора
        for key in redis_client.scan_iter(match="meme:views:*"):
            try:
                # Атомарно получаем значение и сбрасываем его в 0
                views_str = redis_client.getset(key, 0)
                
                if views_str and int(views_str) > 0:
                    views = int(views_str)
                    meme_id = key.split(":")[-1]
                    
                    # Прямой SQL запрос для скорости
                    db.execute(
                        text("UPDATE memes SET views_count = views_count + :val WHERE id = :mid"),
                        {"val": views, "mid": meme_id}
                    )
                    updated_count += 1
            except Exception as e:
                print(f"Error processing key {key}: {e}")

        if updated_count > 0:
            db.commit()
            print(f"✅ Synced views for {updated_count} memes.")
        else:
            print("💤 No new views to sync.")
            
    except Exception as e:
        print(f"❌ Sync views error: {e}")
        db.rollback()
    finally:
        db.close()
        redis_client.close()


@shared_task(name="app.worker.sync_search_stats_task")
def sync_search_stats_task():
    """Синхронизация поисковых запросов из Redis в Postgres"""
    print("⏳ Starting search stats sync...")
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    db = SessionLocal()
    
    try:
        # Забираем топ-100 популярных запросов из Redis
        # ZRANGE возвращает список [(term, score), ...]
        terms_with_scores = redis_client.zrange("stats:search_terms", 0, -1, withscores=True)
        
        if not terms_with_scores:
            print("💤 No search stats to sync.")
            return

        for term, score in terms_with_scores:
            count = int(score)
            if count > 0:
                # Upsert (Вставка или Обновление)
                # Пытаемся найти существующий термин
                search_term = db.query(SearchTerm).filter(SearchTerm.term == term).first()
                
                if search_term:
                    search_term.count += count
                    search_term.last_searched_at = datetime.utcnow()
                else:
                    new_term = SearchTerm(term=term, count=count, last_searched_at=datetime.utcnow())
                    db.add(new_term)
                
                # Удаляем обработанный счетчик из Redis (или уменьшаем его на count)
                # Для простоты можно просто удалять ключ после обработки, 
                # но лучше zincrby на отрицательное число, чтобы не потерять новые клики
                redis_client.zincrby("stats:search_terms", -count, term)

        db.commit()
        # Чистим Redis от записей с 0 или меньше (мусор)
        redis_client.zremrangebyscore("stats:search_terms", "-inf", 0)
        
        print(f"✅ Synced {len(terms_with_scores)} search terms.")
            
    except Exception as e:
        print(f"❌ Sync search stats error: {e}")
        db.rollback()
    finally:
        db.close()
        redis_client.close()

@shared_task(bind=True, name="app.worker.remove_bg_task")
def remove_bg_task(self, file_path: str, output_path: str, add_outline: bool = False):
    """Задача удаления фона"""
    print(f"🎨 Removing background for {file_path}")
    try:
        with open(file_path, "rb") as f:
            input_data = f.read()
        
        # 1. Удаляем фон
        result_data = AIService.remove_background(input_data)
        
        # 2. Добавляем обводку если нужно
        if add_outline:
            result_data = AIService.add_outline(result_data)
            
        with open(output_path, "wb") as f:
            f.write(result_data)
            
        # Удаляем исходник
        if os.path.exists(file_path):
            os.remove(file_path)
            
        print(f"✅ Background removed: {output_path}")
        return output_path
    except Exception as e:
        print(f"❌ Remove BG Error: {e}")
        raise e


@shared_task(bind=True, name="app.worker.process_sticker_image")
def process_sticker_image(self, file_path: str, operation: str, **kwargs):
    """
    Обрабатывает изображение (удаление фона или обводка).
    operation: 'remove_bg' | 'outline'
    """
    try:
        output_path = file_path # Перезаписываем или создаем новый? Лучше новый
        if operation == "remove_bg":
            output_path = file_path.replace("temp_", "bg_removed_")
            with open(file_path, "rb") as f:
                data = f.read()
            processed = AIService.remove_background(data)
            with open(output_path, "wb") as f:
                f.write(processed)
        
        elif operation == "outline":
            output_path = file_path.replace(".png", "_outlined.png")
            color = kwargs.get("color", (255, 255, 255))
            width = kwargs.get("width", 10)
            with open(file_path, "rb") as f:
                data = f.read()
            processed = AIService.add_outline(data, color=tuple(color), thickness=width)
            with open(output_path, "wb") as f:
                f.write(processed)

        # Возвращаем путь относительно статики для фронта
        filename = os.path.basename(output_path)
        return {"url": f"/static/{filename}", "server_path": output_path}
    except Exception as e:
        print(f"Error processing sticker: {e}")
        raise e

@shared_task(bind=True, name="app.worker.animate_sticker_task")
def animate_sticker_task(self, image_path: str, animation: str, format: str = "gif"):
    """
    Создает GIF/WebP
    """
    try:
        output_filename = f"sticker_{uuid.uuid4()}.{format}"
        output_path = os.path.join("uploads", output_filename)
        
        service = StickerService(output_path)
        service.create_animated_sticker(image_path, animation_type=animation)
        
        return {"url": f"/static/{output_filename}"}
    except Exception as e:
        raise e