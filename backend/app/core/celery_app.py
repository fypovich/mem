from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery("worker", broker=settings.CELERY_BROKER_URL)

celery_app.conf.update(
    task_routes={
        "app.worker.process_meme_task": "main-queue",
        "app.worker.index_meme_task": "main-queue",
        "app.worker.delete_index_task": "main-queue",
        "app.worker.sync_views_task": "main-queue",
    },
    beat_schedule={
        "sync-views-every-30-seconds": {
            "task": "app.worker.sync_views_task",
            "schedule": 30.0, # Каждые 30 секунд
        },
    },
    timezone="UTC"
)