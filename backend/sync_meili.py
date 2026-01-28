import asyncio
import os
import sys

# Добавляем текущую директорию в путь, чтобы видеть пакет app
sys.path.append(os.getcwd())

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import Meme, User, Tag
from app.services.search import get_search_service

async def sync():
    print("Starting synchronization with Meilisearch...")
    
    try:
        search_service = get_search_service()
        if not search_service:
            print("Error: Could not connect to Meilisearch service.")
            return

        async with AsyncSessionLocal() as db:
            # 1. Мемы
            print("Syncing Memes...")
            memes = (await db.execute(select(Meme).where(Meme.status == 'approved'))).scalars().all()
            meme_docs = [{
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "thumbnail_url": m.thumbnail_url,
                "media_url": m.media_url,
                "views_count": m.views_count
            } for m in memes]
            if meme_docs:
                search_service.index_memes.add_documents(meme_docs)
            print(f" -> Sent {len(meme_docs)} memes.")

            # 2. Пользователи
            print("Syncing Users...")
            users = (await db.execute(select(User))).scalars().all()
            user_docs = [{
                "id": str(u.id),
                "username": u.username,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url
            } for u in users]
            if user_docs:
                search_service.index_users.add_documents(user_docs)
            print(f" -> Sent {len(user_docs)} users.")

            # 3. Теги
            print("Syncing Tags...")
            tags = (await db.execute(select(Tag))).scalars().all()
            tag_docs = [{"id": t.id, "name": t.name} for t in tags]
            if tag_docs:
                search_service.index_tags.add_documents(tag_docs)
            print(f" -> Sent {len(tag_docs)} tags.")

        print("✅ Synchronization complete!")

    except Exception as e:
        print(f"❌ Synchronization failed: {e}")

if __name__ == "__main__":
    asyncio.run(sync())