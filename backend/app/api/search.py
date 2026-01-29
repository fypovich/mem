from typing import List, Any
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.search import get_search_service
from app.core.redis import redis_client

router = APIRouter()

class SearchResponse(BaseModel):
    memes: List[Any] = []
    users: List[Any] = []
    tags: List[Any] = []
    subjects: List[Any] = []

@router.get("/", response_model=SearchResponse)
async def search_global(q: str, limit: int = 20):
    if not q or len(q) < 1:
        return SearchResponse()

    # --- ОПТИМИЗАЦИЯ: Сохраняем популярность запроса в Redis ---
    # Эти данные потом заберет Celery (sync_search_stats_task) и сохранит в БД
    try:
        clean_q = q.strip().lower()
        if len(clean_q) > 2: # Игнорируем слишком короткие запросы
            # zincrby увеличивает счетчик в Sorted Set
            await redis_client.zincrby("stats:search_terms", 1, clean_q)
    except Exception as e:
        print(f"Redis search stats error: {e}")
    # -----------------------------------------------------------

    search = get_search_service()
    if not search:
        # Fallback если MeiliSearch недоступен
        return SearchResponse()

    results = search.search_multi(q, limit)
    
    return results