import os
import asyncio
import urllib.request

UPLOAD_DIR = "uploads"
DICEBEAR_BASE = "https://api.dicebear.com/9.x"


async def generate_default_avatar(user_id: str, username: str) -> str:
    """Download DiceBear fun-emoji SVG avatar and save locally."""
    url = f"{DICEBEAR_BASE}/fun-emoji/svg?seed={username}"
    filename = f"avatar_{user_id}.svg"
    filepath = os.path.join(UPLOAD_DIR, filename)

    await asyncio.to_thread(urllib.request.urlretrieve, url, filepath)
    return f"/static/{filename}"


async def generate_default_header(user_id: str, username: str) -> str:
    """Download DiceBear glass SVG header and save locally."""
    url = f"{DICEBEAR_BASE}/glass/svg?seed={username}"
    filename = f"header_{user_id}.svg"
    filepath = os.path.join(UPLOAD_DIR, filename)

    await asyncio.to_thread(urllib.request.urlretrieve, url, filepath)
    return f"/static/{filename}"
