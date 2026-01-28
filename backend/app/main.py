import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.api import memes, auth, users, notifications, search
from app.services.search import get_search_service
# ИСПРАВЛЕНО: Импортируем правильное имя фабрики сессий из вашего database.py
from app.core.database import AsyncSessionLocal 
from app.models.models import Meme

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# --- CORS ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])

# --- ФУНКЦИЯ СИНХРОНИЗАЦИИ ---
async def sync_search_index():
    """Синхронизирует мемы из БД в Meilisearch при старте"""
    try:
        search_service = get_search_service()
        if not search_service:
            print("⚠️ Search service not available, skipping sync.")
            return

        print("🔄 Starting background search sync...")
        
        # ИСПРАВЛЕНО: Используем AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            # Берем все одобренные мемы
            query = select(Meme).where(Meme.status == 'approved')
            result = await db.execute(query)
            memes = result.scalars().all()

            if not memes:
                print("ℹ️ No memes to sync.")
                return

            documents = []
            for meme in memes:
                documents.append({
                    "id": str(meme.id),
                    "title": meme.title,
                    "description": meme.description,
                    "thumbnail_url": meme.thumbnail_url,
                    "media_url": meme.media_url,
                    "views_count": meme.views_count,
                    # Можно добавить лайки, если нужно сортировать по ним в поиске
                })
            
            # Обновляем индекс (add_documents обновляет существующие или создает новые)
            search_service.index_memes.add_documents(documents)
            print(f"✅ Synced {len(documents)} memes to search index.")
            
    except Exception as e:
        print(f"❌ Search sync failed: {e}")

# --- ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ ---
@app.on_event("startup")
async def startup_event():
    print("🚀 Starting up application...")
    # Запускаем синхронизацию
    await sync_search_index()