import redis.asyncio as redis
from app.core.config import settings

# Используем тот же URL, что и для Celery
redis_client = redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)

async def get_redis():
    return redis_client