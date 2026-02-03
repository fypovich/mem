from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from app.core.celery_app import celery_app
from app.api.deps import get_current_user
from app.models.models import User
import uuid
import os
import json
import shutil
import aiofiles
from pydantic import BaseModel, Json
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

@router.post("/video/process")
async def process_video_editor(
    video_path: str = Form(...),
    audio_file: UploadFile = File(None),
    options: str = Form(...), # <--- ИЗМЕНЕНИЕ: Принимаем как строку (str)
    current_user: User = Depends(get_current_user)
):
    """Запуск обработки видео (асинхронно)"""
    
    # 1. Сохраняем аудио (если есть)
    audio_path = None
    if audio_file:
        file_id = str(uuid.uuid4())
        ext = audio_file.filename.split('.')[-1]
        audio_path = os.path.join(UPLOAD_DIR, f"editor_audio_{file_id}.{ext}")
        async with aiofiles.open(audio_path, 'wb') as f:
            await f.write(await audio_file.read())

    # 2. Парсим JSON опции вручную (это решает 422 ошибку)
    try:
        # Pydantic v2: model_validate_json или parse_raw
        # Но чтобы не зависеть от версии, сделаем через dict:
        options_dict = json.loads(options)
        # Валидируем через модель (опционально, для проверки типов)
        validated_options = VideoProcessOptions(**options_dict)
        # Превращаем обратно в чистый dict для Celery (чтобы не было конфликтов версий Pydantic в воркере)
        final_options_dict = validated_options.model_dump()
    except Exception as e:
        print(f"JSON Parse Error: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid JSON options: {str(e)}")

    # 3. Отправляем в Celery
    task = celery_app.send_task(
        "app.worker.process_video_editor_task",
        args=[video_path, final_options_dict, audio_path]
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