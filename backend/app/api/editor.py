from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
import uuid
import os
import aiofiles
from pydantic import BaseModel

from app.core.celery_app import celery_app
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()
UPLOAD_DIR = "uploads"

# --- НОВАЯ МОДЕЛЬ ДЛЯ ОТВЕТА ---
class TempUploadResponse(BaseModel):
    filename: str
    server_path: str
    public_url: str

class RenderRequest(BaseModel):
    project_data: dict

# --- 1. ВРЕМЕННАЯ ЗАГРУЗКА ---
@router.post("/upload-temp", response_model=TempUploadResponse)
async def upload_temp_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Загружает файл во временное хранилище. 
    Возвращает путь, который нужен для VideoEditorService.
    """
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    filename = f"temp_source_{file_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(await file.read())

    # Возвращаем полный путь (для Python) и URL (для превью на фронте)
    return {
        "filename": filename,
        "server_path": file_path, # Этот путь отправим в project_data
        "public_url": f"/static/{filename}"
    }

# --- 2. УДАЛЕНИЕ ФОНА ---
@router.post("/remove-bg")
async def remove_background(
    file: UploadFile = File(...),
    outline: bool = Form(False),
    current_user: User = Depends(get_current_user)
):
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    input_path = os.path.join(UPLOAD_DIR, f"temp_bg_{file_id}.{ext}")
    output_filename = f"sticker_{file_id}.png"
    output_path = os.path.join(UPLOAD_DIR, output_filename)

    async with aiofiles.open(input_path, 'wb') as f:
        await f.write(await file.read())

    task = celery_app.send_task(
        "app.worker.remove_bg_task", 
        args=[input_path, output_path, outline]
    )
    
    return {"task_id": task.id, "result_url": f"/static/{output_filename}"}

# --- 3. РЕНДЕР ---
@router.post("/render")
async def render_video(
    request: RenderRequest,
    current_user: User = Depends(get_current_user)
):
    file_id = str(uuid.uuid4())
    
    task = celery_app.send_task(
        "app.worker.render_video_task",
        args=[request.project_data, file_id]
    )
    
    return {
        "task_id": task.id, 
        "output_url": f"/static/{file_id}.mp4",
        "status": "processing"
    }

# --- 4. СТАТУС ЗАДАЧИ ---
from celery.result import AsyncResult
@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    result = task_result.result if task_result.ready() else None
    
    # Если результат - это путь к файлу (строка), превращаем его в URL
    if isinstance(result, str) and "uploads" in result:
        filename = os.path.basename(result)
        result = f"/static/{filename}"

    return {
        "task_id": task_id,
        "status": task_result.status,
        "result": result
    }

# Добавьте новые эндпоинты или обновите старые
@router.post("/process-image")
async def process_image(
    file: UploadFile = File(...),
    operation: str = Form(...), # 'remove_bg' or 'outline'
    current_user: User = Depends(get_current_user)
):
    # Сохраняем входящий файл
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    input_path = os.path.join(UPLOAD_DIR, f"temp_{file_id}.{ext}")
    async with aiofiles.open(input_path, 'wb') as f:
        await f.write(await file.read())

    # Запускаем задачу
    task = celery_app.send_task(
        "app.worker.process_sticker_image",
        args=[input_path, operation]
    )
    return {"task_id": task.id}

@router.post("/create-sticker")
async def create_sticker(
    request: dict, # { "image_path": "...", "animation": "zoom_in", "format": "gif" }
    current_user: User = Depends(get_current_user)
):
    task = celery_app.send_task(
        "app.worker.animate_sticker_task",
        args=[request.get("image_path"), request.get("animation"), request.get("format")]
    )
    return {"task_id": task.id}