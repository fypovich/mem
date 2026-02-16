from celery import Celery
from app.core.config import settings

celery_app = Celery("worker", broker=settings.CELERY_BROKER_URL)

celery_app.conf.update(
    # ВАЖНО: Явно указываем, где лежат наши задачи, чтобы Celery их нашел
    imports=['app.worker'],
    
    # УБРАЛИ task_routes: теперь все задачи идут в стандартную очередь 'celery',
    # которую воркер слушает по умолчанию.
    
    beat_schedule={
        "sync-views-every-30-seconds": {
            "task": "app.worker.sync_views_task",
            "schedule": 30.0,
        },
        "sync-search-stats-every-5-minutes": {
            "task": "app.worker.sync_search_stats_task",
            "schedule": 300.0,
        },
        "sync-denormalized-counts-every-hour": {
            "task": "app.worker.sync_denormalized_counts_task",
            "schedule": 3600.0,
        },
    },
    timezone="UTC"
)