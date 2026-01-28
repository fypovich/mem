import os
import asyncio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.api import memes, auth, users, notifications, search
from app.services.search import get_search_service
from app.core.database import AsyncSessionLocal 
from app.models.models import Meme, User, Tag

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# --- CORS ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "ws://localhost:3000", # Разрешаем WS с локалхоста
    "ws://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# Подключение роутеров
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(memes.router, prefix="/api/v1/memes", tags=["memes"])
# ВАЖНО: notifications должен быть подключен
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])

# --- ФУНКЦИЯ СИНХРОНИЗАЦИИ ---
async def sync_search_index():
    """Полная пересинхронизация данных в Meilisearch"""
    search_service = None
    
    # 1. Ждем подключения к Meilisearch
    for i in range(3):
        try:
            search_service = get_search_service()
            if search_service:
                search_service.client.health()
                break
        except Exception:
            print(f"⏳ Waiting for Meilisearch... ({i+1}/3)")
            await asyncio.sleep(2)
            
    if not search_service:
        print("⚠️ Search service not available, skipping sync.")
        return

    print("🔄 Starting background search sync...")
    
    try:
        async with AsyncSessionLocal() as db:
            # Очистка старого
            search_service.index_memes.delete_all_documents()
            search_service.index_users.delete_all_documents()
            search_service.index_tags.delete_all_documents()

            # 1. Мемы
            query = select(Meme).where(Meme.status == 'approved').options(
                selectinload(Meme.tags),
                selectinload(Meme.subject)
            )
            memes_list = (await db.execute(query)).scalars().all()

            if memes_list:
                documents = []
                for meme in memes_list:
                    tags_list = [t.name for t in meme.tags]
                    subject_name = meme.subject.name if meme.subject else None
                    
                    documents.append({
                        "id": str(meme.id),
                        "title": meme.title,
                        "description": meme.description,
                        "thumbnail_url": meme.thumbnail_url,
                        "media_url": meme.media_url,
                        "views_count": meme.views_count,
                        "tags": tags_list,
                        "subject": subject_name
                    })
                search_service.index_memes.add_documents(documents)
                print(f"✅ Synced {len(documents)} memes.")

            # 2. Юзеры
            user_list = (await db.execute(select(User))).scalars().all()
            if user_list:
                user_docs = [{
                    "id": str(u.id),
                    "username": u.username,
                    "full_name": u.full_name,
                    "avatar_url": u.avatar_url
                } for u in user_list]
                search_service.index_users.add_documents(user_docs)
                print(f"✅ Synced {len(user_docs)} users.")

            # 3. Теги (только используемые)
            tag_query = (
                select(Tag)
                .join(Tag.memes)
                .where(Meme.status == 'approved')
                .distinct()
            )
            tags_list = (await db.execute(tag_query)).scalars().all()
            
            if tags_list:
                tag_docs = [{"id": t.id, "name": t.name} for t in tags_list]
                search_service.index_tags.add_documents(tag_docs)
                print(f"✅ Synced {len(tag_docs)} active tags.")
            
    except Exception as e:
        print(f"❌ Search sync failed: {e}")

@app.on_event("startup")
async def startup_event():
    print("🚀 Starting up application...")
    asyncio.create_task(sync_search_index())