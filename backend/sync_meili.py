import asyncio
from sqlalchemy import select
# ИСПРАВЛЕНИЕ: Импортируем AsyncSessionLocal вместо несуществующего async_session_maker
from app.core.database import AsyncSessionLocal 
from app.models.models import Meme, User, Tag
from app.services.search import get_search_service

async def sync_data():
    print("Starting synchronization with Meilisearch...")
    search = get_search_service()
    
    # Если Meilisearch недоступен
    if not search:
        print("Error: Could not connect to Meilisearch service.")
        return

    # ИСПРАВЛЕНИЕ: Используем AsyncSessionLocal()
    async with AsyncSessionLocal() as db:
        # 1. МЕМЫ
        print("Syncing Memes...")
        memes = (await db.execute(select(Meme))).scalars().all()
        meme_docs = [
            {
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "thumbnail_url": m.thumbnail_url
            } for m in memes
        ]
        if meme_docs:
            search.index_memes.add_documents(meme_docs)
            print(f"Indexed {len(meme_docs)} memes.")

        # 2. ПОЛЬЗОВАТЕЛИ
        print("Syncing Users...")
        users = (await db.execute(select(User))).scalars().all()
        user_docs = [
            {
                "id": str(u.id),
                "username": u.username,
                "full_name": u.full_name,
                "avatar_url": u.avatar_url
            } for u in users
        ]
        if user_docs:
            search.index_users.add_documents(user_docs)
            print(f"Indexed {len(user_docs)} users.")

        # 3. ТЕГИ
        print("Syncing Tags...")
        tags = (await db.execute(select(Tag))).scalars().all()
        tag_docs = [{"id": t.id, "name": t.name} for t in tags]
        if tag_docs:
            search.index_tags.add_documents(tag_docs)
            print(f"Indexed {len(tag_docs)} tags.")

    print("Synchronization complete!")

if __name__ == "__main__":
    asyncio.run(sync_data())