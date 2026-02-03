from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from app.core.celery_app import celery_app
from app.api.deps import get_current_user
from app.models.models import User
from app.services.video import process_video_task
import uuid
import os
import json
import aiofiles
from pydantic import BaseModel
from celery.result import AsyncResult

router = APIRouter()
UPLOAD_DIR = "uploads"

class AnimationRequest(BaseModel):
    image_path: str
    animation: str

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

@router.post("/video/process")
async def process_video_endpoint(
    video: UploadFile = File(...),
    audio: UploadFile = File(None),
    options: str = Form(...) # JSON string с настройками (crop, trim, text, etc)
):
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

    # 4. Обрабатываем (в реальном продакшене лучше через Celery/RabbitMQ)
    output_filename = f"processed_{uuid.uuid4()}.mp4"
    output_path = f"uploads/{output_filename}"

    try:
        # Вызываем сервис напрямую (блокирующе), чтобы сразу вернуть результат 
        # В идеале переделать на BackgroundTasks или Celery
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
        # Чистим исходники (опционально)
        if os.path.exists(video_path): os.remove(video_path)
        if audio_path and os.path.exists(audio_path): os.remove(audio_path)

    # Возвращаем URL на обработанный файл
    # Убедись, что папка uploads раздается через StaticFiles в main.py
    return {"url": f"/uploads/{output_filename}"}

@router.post("/video/upload")
async def upload_video_for_editor(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Загрузка исходного видео для редактирования"""
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1]
    # Используем префикс editor_video_ чтобы отличать
    filename = f"editor_video_{file_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(await file.read())
        
    return {"file_path": file_path, "url": f"/static/{filename}"}

@router.post("/video/process")
async def process_video_editor(
    video_path: str = Form(...),
    audio_file: UploadFile = File(None),
    options: Json[VideoProcessOptions] = Form(...), # JSON строка с настройками
    current_user: User = Depends(get_current_user)
):
    """Запуск обработки видео"""
    
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