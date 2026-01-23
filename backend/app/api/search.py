from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import Meme, User, Tag, Subject
from app.schemas import MemeResponse, UserResponse, TagResponse, SubjectResponse

router = APIRouter()

class SearchResponse(BaseModel):
    memes: List[MemeResponse] = []
    users: List[UserResponse] = []
    tags: List[TagResponse] = []
    subjects: List[SubjectResponse] = []

@router.get("/", response_model=SearchResponse)
async def search_global(
    q: str, 
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    if not q or len(q) < 2:
        return SearchResponse()

    search_term = f"%{q}%"

    # 1. Поиск мемов (по заголовку или описанию)
    memes_res = await db.execute(
        select(Meme)
        .where(or_(Meme.title.ilike(search_term), Meme.description.ilike(search_term)))
        .limit(limit)
    )
    
    # 2. Поиск пользователей
    users_res = await db.execute(
        select(User)
        .where(or_(User.username.ilike(search_term), User.full_name.ilike(search_term)))
        .limit(limit)
    )

    # 3. Поиск тегов
    tags_res = await db.execute(
        select(Tag).where(Tag.name.ilike(search_term)).limit(limit)
    )

    # 4. Поиск персонажей
    subjects_res = await db.execute(
        select(Subject).where(Subject.name.ilike(search_term)).limit(limit)
    )

    return {
        "memes": memes_res.scalars().all(),
        "users": users_res.scalars().all(),
        "tags": tags_res.scalars().all(),
        "subjects": subjects_res.scalars().all(),
    }