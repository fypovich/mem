from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from app.core.celery_app import celery_app
from app.api.deps import get_current_user
from app.models.models import User
from app.services.video import process_video_task
import uuid
import os
import json
import shutil  # <--- Добавлено
import aiofiles
from pydantic import BaseModel, Json  # <--- Добавлено Json
from celery.result import AsyncResult

router = APIRouter()
UPLOAD_DIR = "uploads"

if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# --- MODELS ---
class AnimationRequest(BaseModel):
    image_path: str
    animation: str

class CropOptions(BaseModel):
    x: int
    y: int
    width: int
    height: int

class TextOptions(BaseModel):
    text: str
    size: int = 50
    color: str = 'white'
    x: float = 0.5
    y: float = 0.8

class VideoProcessOptions(BaseModel):
    trim_start: Optional[float] = None
    trim_end: Optional[float] = None
    crop: Optional[CropOptions] = None
    remove_audio: bool = False
    text_config: Optional[TextOptions] = None
    filter_name: Optional[str] = None

# --- ENDPOINTS ---

@router.post("/process-image")
async def process_image(
    file: UploadFile = File(...),
    operation: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    input_path = os.path.join(UPLOAD_DIR, f"temp_{file_id}.{ext}")
    
    async with aiofiles.open(input_path, 'wb') as f:
        await f.write(await file.read())

    task = celery_app.send_task(
        "app.worker.process_sticker_image",
        args=[input_path, operation]
    )
    return {"task_id": task.id}

# Переименовали старый метод, чтобы избежать конфликта путей
@router.post("/video/process-sync")
async def process_video_sync(
    video: UploadFile = File(...),
    audio: UploadFile = File(None),
    options: str = Form(...) # JSON string с настройками
):
    """
    Устаревший синхронный метод. Рекомендуется использовать асинхронный вариант ниже.
    """
    # 1. Сохраняем исходник
    video_ext = video.filename.split('.')[-1]
    video_filename = f"{uuid.uuid4()}.{video_ext}"
    video_path = f"uploads/{video_filename}"
    
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)

    # 2. Сохраняем аудио если есть
    audio_path = None
    if audio:
        audio_filename = f"{uuid.uuid4()}.mp3"
        audio_path = f"uploads/{audio_filename}"
        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

    # 3. Парсим опции
    try:
        opts = json.loads(options)
    except:
        raise HTTPException(status_code=400, detail="Invalid options JSON")

    # 4. Обрабатываем
    output_filename = f"processed_{uuid.uuid4()}.mp4"
    output_path = f"uploads/{output_filename}"

    try:
        await process_video_task(
            file_path=video_path,
            output_path=output_path,
            trim_start=opts.get('trim_start'),
            trim_end=opts.get('trim_end'),
            crop=opts.get('crop'),
            remove_audio=opts.get('remove_audio', False),
            new_audio_path=audio_path,
            text_overlay=opts.get('text'),
            filter_name=opts.get('filter')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(video_path): os.remove(video_path)
        if audio_path and os.path.exists(audio_path): os.remove(audio_path)

    return {"url": f"/static/{output_filename}"} # Убедитесь, что /static раздается правильно

@router.post("/video/upload")
async def upload_video_for_editor(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Загрузка исходного видео для редактирования"""
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    filename = f"editor_video_{file_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(await file.read())
        
    return {"file_path": file_path, "url": f"/static/{filename}"}

# Это основной метод для редактора (через Celery)
@router.post("/video/process")
async def process_video_editor(
    video_path: str = Form(...),
    audio_file: UploadFile = File(None),
    options: Json[VideoProcessOptions] = Form(...), # Теперь VideoProcessOptions определен
    current_user: User = Depends(get_current_user)
):
    """Запуск обработки видео (асинхронно)"""
    
    # Если есть новый аудиофайл, сохраняем его
    audio_path = None
    if audio_file:
        file_id = str(uuid.uuid4())
        ext = audio_file.filename.split('.')[-1]
        audio_path = os.path.join(UPLOAD_DIR, f"editor_audio_{file_id}.{ext}")
        async with aiofiles.open(audio_path, 'wb') as f:
            await f.write(await audio_file.read())

    # Преобразуем Pydantic модель в dict для передачи в Celery
    options_dict = options.model_dump()

    task = celery_app.send_task(
        "app.worker.process_video_editor_task",
        args=[video_path, options_dict, audio_path]
    )
    
    return {"task_id": task.id}

@router.post("/create-sticker")
async def create_sticker(
    request: AnimationRequest,
    current_user: User = Depends(get_current_user)
):
    task = celery_app.send_task(
        "app.worker.animate_sticker_task",
        args=[request.image_path, request.animation]
    )
    return {"task_id": task.id}

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": task_result.status,
        "result": task_result.result if task_result.ready() else None
    }