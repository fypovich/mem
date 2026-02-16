"""
Миграция thumbnails: перегенерация в оптимизированные форматы.

- Картинки (jpg/png/bmp) → WebP static thumbnail (640px)
- GIF → Animated WebP thumbnail (480px, 15fps)
- MP4 → WebM preview (полное видео, без звука, 480px) + WebP poster (640px)

Запуск: python -m app.scripts.migrate_thumbnails
"""
import os
import sys

# Добавляем корень проекта в path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.services.media import MediaProcessor

UPLOAD_DIR = "uploads"


def migrate():
    engine = create_engine(settings.DATABASE_URL.replace("+asyncpg", ""))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        rows = db.execute(text(
            "SELECT id, media_url, thumbnail_url FROM memes WHERE status = 'approved'"
        )).fetchall()

        total = len(rows)
        print(f"Migrating thumbnails for {total} memes...")

        success = 0
        skipped = 0
        errors = 0

        for i, row in enumerate(rows):
            meme_id = str(row.id)
            media_url = row.media_url
            filename = media_url.split("/")[-1]
            media_path = os.path.join(UPLOAD_DIR, filename)
            ext = filename.split(".")[-1].lower()

            if not os.path.exists(media_path):
                print(f"  [{i+1}/{total}] SKIP {meme_id} — file missing: {filename}")
                skipped += 1
                continue

            new_thumb_path = os.path.join(UPLOAD_DIR, f"{meme_id}_thumb.webp")
            new_thumb_url = f"/static/{meme_id}_thumb.webp"
            new_preview_url = None

            # Пропускаем если WebP thumb уже существует
            if os.path.exists(new_thumb_path):
                print(f"  [{i+1}/{total}] SKIP {meme_id} — already migrated")
                skipped += 1
                continue

            try:
                processor = MediaProcessor(media_path)

                if ext == "gif":
                    processor.generate_animated_webp_thumbnail(new_thumb_path)
                    print(f"  [{i+1}/{total}] OK {meme_id} (GIF → animated WebP)")

                elif ext == "mp4":
                    preview_path = os.path.join(UPLOAD_DIR, f"{meme_id}_preview.webm")
                    processor.generate_video_preview(preview_path, new_thumb_path)
                    new_preview_url = f"/static/{meme_id}_preview.webm"
                    print(f"  [{i+1}/{total}] OK {meme_id} (MP4 → WebM + WebP poster)")

                else:
                    # Статичная картинка (jpg, png, webp, bmp)
                    processor.generate_webp_thumbnail(new_thumb_path)
                    print(f"  [{i+1}/{total}] OK {meme_id} ({ext} → WebP thumb)")

                # Обновляем БД
                if new_preview_url:
                    db.execute(text(
                        "UPDATE memes SET thumbnail_url = :thumb, preview_url = :preview WHERE id = :id"
                    ), {"thumb": new_thumb_url, "preview": new_preview_url, "id": meme_id})
                else:
                    db.execute(text(
                        "UPDATE memes SET thumbnail_url = :thumb WHERE id = :id"
                    ), {"thumb": new_thumb_url, "id": meme_id})

                db.commit()
                success += 1

            except Exception as e:
                print(f"  [{i+1}/{total}] ERROR {meme_id}: {e}")
                db.rollback()
                errors += 1
                continue

        print(f"\nDone! Success: {success}, Skipped: {skipped}, Errors: {errors}")

    finally:
        db.close()


if __name__ == "__main__":
    migrate()
