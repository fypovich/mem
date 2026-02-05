import asyncio
import os
import sys

# Добавляем текущую директорию в путь, чтобы видеть пакет app
# Предполагается запуск из папки backend/
sys.path.append(os.getcwd())

from sqlalchemy import select
from sqlalchemy.orm import selectinload  # <--- Нужно для загрузки тегов
from app.core.database import AsyncSessionLocal
from app.models.models import Meme, User, Tag
from app.services.search import get_search_service

async def sync():
    print("🚀 Starting synchronization with Meilisearch...")
    
    try:
        search_service = get_search_service()
        if not search_service:
            print("❌ Error: Could not connect to Meilisearch service.")
            return

        async with AsyncSessionLocal() as db:
            # 1. МЕМЫ
            print("📦 Syncing Memes...")
            # Важно: используем selectinload для тегов, чтобы не получить ошибку или пустые теги
            query = select(Meme).where(Meme.status == 'approved').options(
                selectinload(Meme.tags),
                selectinload(Meme.user) 
            )
            memes = (await db.execute(query)).scalars().all()
            
            meme_docs = []
            for m in memes:
                # Собираем список тегов
                tag_list = [t.name for t in m.tags]

                username = m.user.username if m.user else "unknown"
                
                meme_docs.append({
                    "id": str(m.id),
                    "title": m.title,
                    "description": m.description,
                    "thumbnail_url": m.thumbnail_url,
                    "media_url": m.media_url,
                    "views_count": m.views_count,
                    "shares_count": getattr(m, 'shares_count', 0), # Используем getattr на случай, если миграция не прошла
                    "width": m.width,
                    "height": m.height,
                    "duration": m.duration,
                    "status": m.status,     # <--- КРИТИЧНО для фильтрации
                    "tags": tag_list,
                    "author_username": username
                })

            if meme_docs:
                # add_documents обновляет существующие документы, если ID совпадает
                search_service.index_memes.add_documents(meme_docs)
            print(f" -> ✅ Sent {len(meme_docs)} memes to index.")

            # 2. ПОЛЬЗОВАТЕЛИ
            print("👤 Syncing Users...")
            users = (await db.execute(select(User))).scalars().all()
            user_docs = [{
                "id": str(u.id),
                "username": u.username,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url
            } for u in users]
            if user_docs:
                search_service.index_users.add_documents(user_docs)
            print(f" -> ✅ Sent {len(user_docs)} users.")

            # 3. ТЕГИ (Словарь тегов)
            print("🏷️ Syncing Tags Dictionary...")
            tags = (await db.execute(select(Tag))).scalars().all()
            tag_docs = [{"id": t.id, "name": t.name} for t in tags]
            if tag_docs:
                search_service.index_tags.add_documents(tag_docs)
            print(f" -> ✅ Sent {len(tag_docs)} tags.")

        print("🎉 Synchronization complete! Search should work now.")

    except Exception as e:
        print(f"❌ Synchronization failed: {e}")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(sync())