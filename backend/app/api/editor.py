from fastapi import APIRouter, UploadFile, File, Form, Depends
from app.core.celery_app import celery_app
from app.api.deps import get_current_user
from app.models.models import User
import uuid
import os
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