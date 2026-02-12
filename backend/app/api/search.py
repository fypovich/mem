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

@router.get("/", response_model=SearchResponse)
async def search_global(q: str = "", limit: int = 20): # <-- q теперь optional (по умолчанию "")
    
    # УБИРАЕМ или МЕНЯЕМ эту проверку:
    # if not q or len(q) < 1:
    #    return SearchResponse()
    
    # ПРАВИЛЬНЫЙ ВАРИАНТ:
    # Если q None, делаем пустой строкой. Проверку длины убираем, 
    # так как пустой q означает "дай мне просто новые мемы".
    q = q if q else ""

    # --- ОПТИМИЗАЦИЯ: Сохраняем популярность запроса в Redis ---
    try:
        clean_q = q.strip().lower()
        if len(clean_q) > 2: # Статистику пишем только для реальных слов
            await redis_client.zincrby("stats:search_terms", 1, clean_q)
    except Exception as e:
        print(f"Redis search stats error: {e}")
    # -----------------------------------------------------------

    search = get_search_service()
    if not search:
        return SearchResponse()

    results = search.search_multi(q, limit)
    
    return results