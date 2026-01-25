from typing import List, Any
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.search import get_search_service

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

    search = get_search_service()
    if not search:
        # Fallback если Meili лежит (можно вернуть пустой или оставить старый SQL код)
        return SearchResponse()

    results = search.search_multi(q, limit)
    
    return results