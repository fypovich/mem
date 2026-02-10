import os
import shutil
import json
import uuid
import redis
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from celery import shared_task

# --- Импорты ---
from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.models import Meme, Notification, NotificationType, SearchTerm
from app.services.media import MediaProcessor
from app.services.search import get_search_service
from app.services.ai import AIService
from app.services.sticker import StickerService
from app.services.video_editor import VideoEditorService

# Настройка БД
engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

# ==========================================
# 1. ЗАДАЧИ ДЛЯ ОСНОВНОГО САЙТА (MEMES)
# ==========================================

@shared_task(bind=True, max_retries=3, name="app.worker.process_meme_task")
def process_meme_task(self, meme_id_str: str, file_path: str, audio_path: str = None):
    print(f"🚀 Processing meme {meme_id_str}...")
    
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    db = SessionLocal()
    meme = None
    
    try:
        meme_id = meme_id_str 
        meme = db.query(Meme).filter(Meme.id == meme_id).first()
        if not meme:
            print(f"❌ Meme {meme_id} not found in DB")
            return

        # 1. Анализируем исходный файл
        processor = MediaProcessor(file_path)
        has_audio_stream = processor.has_audio_stream()
        
        # 2. Определяем формат вывода
        # Если есть оригинальный звук ИЛИ добавили новый звук -> MP4
        # Иначе -> GIF
        if has_audio_stream or audio_path:
            output_ext = "mp4"
            is_gif = False
        else:
            output_ext = "gif"
            is_gif = True

        final_filename = f"{meme_id_str}.{output_ext}"
        upload_dir = os.path.dirname(file_path)
        final_path = os.path.join(upload_dir, final_filename)
        
        # Определяем расширение для превью
        # Если мем GIF -> превью GIF (анимированное)
        # Если мем MP4 -> превью JPG (статичное)
        if is_gif:
            thumbnail_ext = "gif"
        else:
            thumbnail_ext = "jpg"
            
        thumbnail_path = os.path.join(upload_dir, f"{meme_id_str}_thumb.{thumbnail_ext}")

        print(f"ℹ️ Detected format: {output_ext}, Thumb: {thumbnail_ext} (Audio: {has_audio_stream}, New Audio: {bool(audio_path)})")

        # --- ОБРАБОТКА ---
        if audio_path:
            # Если есть новое аудио, это точно MP4
            processor.process_video_with_audio(audio_path, final_path)
            if os.path.exists(audio_path): os.remove(audio_path)
            # Пересоздаем процессор на готовом файле для метаданных
            processor = MediaProcessor(final_path)
            
        elif is_gif:
            # Конвертируем в оптимизированный GIF
            processor.convert_to_gif(final_path)
            processor = MediaProcessor(final_path)
            
        else:
            # Конвертируем в MP4 (стандартизация)
            processor.convert_to_mp4(final_path)
            processor = MediaProcessor(final_path)

        # --- ГЕНЕРАЦИЯ ПРЕВЬЮ ---
        if is_gif:
            # 🔥 ВАЖНО: Копируем готовый GIF в превью, чтобы оно двигалось
            if os.path.exists(final_path):
                shutil.copy(final_path, thumbnail_path)
        else:
            # Для видео генерируем статичную картинку
            processor.generate_thumbnail(thumbnail_path)
        
        # Получаем метаданные финального файла
        duration, width, height = processor.get_metadata()
        
        # Для GIF длительность часто определяется криво, но has_audio точно False
        final_has_audio = True if output_ext == "mp4" else False

        # --- СОХРАНЕНИЕ В БД ---
        meme.duration = duration
        meme.width = width
        meme.height = height
        meme.has_audio = final_has_audio
        meme.status = "approved"
        meme.media_url = f"/static/{final_filename}"
        meme.thumbnail_url = f"/static/{meme_id_str}_thumb.{thumbnail_ext}" # .gif или .jpg
        
        db.commit()

        # --- ИНДЕКСАЦИЯ ---
        try:
            tags_list = [t.name for t in meme.tags] if meme.tags else []
            
            # 👇 Получаем имя автора
            author_username = "unknown"
            # Мы уже делали запрос к базе выше (meme = db.query...), 
            # но user может быть не подгружен. Лучше подгрузить или сделать запрос.
            # Самый надежный вариант тут - простой SQL, так как sessionmaker синхронный
            if meme.user_id:
                user_res = db.execute(text("SELECT username FROM users WHERE id = :uid"), {"uid": meme.user_id}).fetchone()
                if user_res:
                    author_username = user_res.username
            
            index_meme_task.delay({
                "id": str(meme.id),
                "title": meme.title,
                "description": meme.description,
                "thumbnail_url": meme.thumbnail_url,
                "media_url": meme.media_url,
                "views_count": meme.views_count,
                "shares_count": meme.shares_count,
                "width": meme.width,
                "height": meme.height,
                "duration": meme.duration,
                "status": meme.status,
                "tags": tags_list,
                "author_username": author_username
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

        # Удаляем исходник
        if os.path.exists(file_path) and os.path.abspath(file_path) != os.path.abspath(final_path):
            os.remove(file_path)

        print(f"✅ Meme {meme_id} ready as {output_ext.upper()}!")

    except Exception as e:
        print(f"❌ Worker Error: {e}")
        try:
            if meme:
                meme.status = "failed"
                db.commit()
        except: pass
    finally:
        db.close()
        redis_client.close()

# ==========================================
# 2. ЗАДАЧИ ДЛЯ STICKER MAKER (НОВЫЕ)
# ==========================================

@shared_task(bind=True, name="app.worker.process_sticker_image")
def process_sticker_image(self, file_path: str, operation: str, **kwargs):
    """
    Обработка стикера: удаление фона или обводка.
    """
    try:
        # Меняем расширение на .png
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        dir_name = os.path.dirname(file_path)
        
        if operation == "remove_bg":
            output_filename = f"bg_removed_{base_name}.png"
            output_path = os.path.join(dir_name, output_filename)
            
            with open(file_path, "rb") as f:
                data = f.read()
            processed = AIService.remove_background(data)
            
            with open(output_path, "wb") as f:
                f.write(processed)
        
        elif operation == "outline":
            output_filename = f"outlined_{base_name}.png"
            output_path = os.path.join(dir_name, output_filename)
            
            color = kwargs.get("color", (255, 255, 255))
            width = kwargs.get("width", 10)
            
            with open(file_path, "rb") as f:
                data = f.read()
            processed = AIService.add_outline(data, color=tuple(color), thickness=width)
            
            with open(output_path, "wb") as f:
                f.write(processed)
        else:
            return {"error": "Unknown operation"}

        # Возвращаем URL и Путь
        return {"url": f"/static/{output_filename}", "server_path": output_path}

    except Exception as e:
        print(f"Error processing sticker: {e}")
        raise e

@shared_task(bind=True, name="app.worker.animate_sticker_task")
def animate_sticker_task(self, image_path: str, animation: str,
                         outline_color: str = None,
                         outline_width: int = 0,
                         text: str = None,
                         text_color: str = "white",
                         text_size: int = 15,
                         text_x: float = 0.5,
                         text_y: float = 0.8,
                         crop: dict = None):
    """Создает анимированный GIF или PNG (если без анимации)"""
    try:
        file_id = str(uuid.uuid4())
        gif_path = os.path.join("uploads", f"sticker_{file_id}.gif")

        service = StickerService(gif_path)
        result_path = service.create_animated_sticker(
            image_path,
            animation=animation,
            outline_color=outline_color,
            outline_width=outline_width,
            text=text,
            text_color=text_color,
            text_size=text_size,
            text_x=text_x,
            text_y=text_y,
            crop=crop,
        )

        result_filename = os.path.basename(result_path)
        return {"url": f"/static/{result_filename}"}
    except Exception as e:
        print(f"Worker Error: {e}")
        raise e
    
# --- ИСПРАВЛЕНИЕ: Используем shared_task и redis_client внутри ---
@shared_task(bind=True, name="app.worker.process_video_editor_task")
def process_video_editor_task(self, video_path: str, options: dict, audio_path: str = None):
    """
    Обработка видео с использованием нового VideoEditorService (MoviePy + NumPy)
    """
    task_id = self.request.id
    
    # Создаем соединение внутри задачи, чтобы не зависеть от глобального контекста
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    
    # Обновляем статус: STARTED
    redis_client.set(f"task:{task_id}", json.dumps({"status": "PROCESSING", "progress": 0}))

    try:
        # Инициализируем новый сервис
        editor_service = VideoEditorService(output_dir="uploads")
        
        # Генерируем имя выходного файла
        output_filename = f"edited_{uuid.uuid4()}.mp4"
        
        # Запускаем обработку (это займет время)
        result_path = editor_service.process_video(
            input_path=video_path,
            output_filename=output_filename,
            trim_start=options.get('trim_start'),
            trim_end=options.get('trim_end'),
            crop=options.get('crop'),
            remove_audio=options.get('remove_audio', False),
            new_audio_path=audio_path,
            text_config=options.get('text_config'),
        )

        # Формируем URL результата
        result_url = f"/static/{output_filename}"

        # Обновляем статус: SUCCESS
        result_data = {"status": "SUCCESS", "url": result_url}
        redis_client.set(f"task:{task_id}", json.dumps(result_data))
        
        return result_data

    except Exception as e:
        print(f"Error processing video: {e}")
        error_data = {"status": "FAILURE", "error": str(e)}
        redis_client.set(f"task:{task_id}", json.dumps(error_data))
        # Возвращаем ошибку как результат (но не рейзим, чтобы Celery не перезапускал задачу бесконечно)
        return error_data
    finally:
        redis_client.close()

# ==========================================
# 3. ФОНОВЫЕ ЗАДАЧИ (Index, Views, Search)
# ==========================================

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
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    db = SessionLocal()
    updated_count = 0
    try:
        for key in redis_client.scan_iter(match="meme:views:*"):
            try:
                views_str = redis_client.getset(key, 0)
                if views_str and int(views_str) > 0:
                    views = int(views_str)
                    meme_id = key.split(":")[-1]
                    db.execute(
                        text("UPDATE memes SET views_count = views_count + :val WHERE id = :mid"),
                        {"val": views, "mid": meme_id}
                    )
                    updated_count += 1
            except Exception: pass
        if updated_count > 0: db.commit()
    except Exception: db.rollback()
    finally:
        db.close()
        redis_client.close()

@shared_task(name="app.worker.sync_search_stats_task")
def sync_search_stats_task():
    redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
    db = SessionLocal()
    try:
        terms = redis_client.zrange("stats:search_terms", 0, -1, withscores=True)
        if not terms: return
        for term, score in terms:
            count = int(score)
            if count > 0:
                s_term = db.query(SearchTerm).filter(SearchTerm.term == term).first()
                if s_term: 
                    s_term.count += count
                    s_term.last_searched_at = datetime.utcnow()
                else: 
                    db.add(SearchTerm(term=term, count=count))
                redis_client.zincrby("stats:search_terms", -count, term)
        db.commit()
        redis_client.zremrangebyscore("stats:search_terms", "-inf", 0)
    except Exception: db.rollback()
    finally:
        db.close()
        redis_client.close()