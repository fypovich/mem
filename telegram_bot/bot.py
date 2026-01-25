import os
import logging
import hashlib
import aiohttp
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineQueryResultVideo
from aiogram.filters import Command
from aiogram.utils.markdown import hbold

# --- ЗАГРУЗКА ПЕРЕМЕННЫХ ---
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Локальный адрес для связи Бот -> Бэкенд (API)
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000/api/v1")

# ПУБЛИЧНЫЙ адрес для Telegram (чтобы он мог скачать видео)
# Если вы тестируете локально без Ngrok, видео не будут грузиться в Telegram!
BASE_MEDIA_URL = os.getenv("BASE_MEDIA_URL", "http://127.0.0.1:8000")

logging.basicConfig(level=logging.INFO)

if not TOKEN:
    raise ValueError(f"Токен не найден! Проверьте файл: {env_path}")

bot = Bot(token=TOKEN)
dp = Dispatcher()

# --- ХЕНДЛЕРЫ ---

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    bot_info = await bot.get_me()
    await message.answer(
        f"Привет! Я бот {hbold('MemeHUB')}.\n\n"
        f"Я работаю в инлайн-режиме. Не нужно отправлять мне сообщения!\n\n"
        f"👉 Просто начни писать в любом чате: `@{bot_info.username} ` и текст поиска.",
        parse_mode="Markdown"
    )

# Обработчик обычных сообщений (если юзер нажал Enter вместо выбора)
@dp.message()
async def cmd_help_inline(message: types.Message):
    bot_info = await bot.get_me()
    await message.answer(
        f"👋 Я инлайн-бот.\n"
        f"Напиши `@{bot_info.username} ` (с пробелом) в поле ввода и подожди меню!",
        parse_mode="Markdown"
    )

@dp.inline_query(F.query)
async def inline_search(inline_query: types.InlineQuery):
    query_text = inline_query.query.strip()
    if len(query_text) < 1:
        return

    # Логгируем для отладки
    logging.info(f"Ищу мем: {query_text}")

    async with aiohttp.ClientSession() as session:
        try:
            # Чистим URL от лишних слешей
            api_url = f"{BACKEND_URL.rstrip('/')}/search/"
            
            async with session.get(api_url, params={"q": query_text, "limit": 20}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    results = []
                    for meme in memes:
                        # Формируем ссылки
                        base = BASE_MEDIA_URL.rstrip('/')
                        media_link = f"{base}{meme['media_url']}"
                        thumb_link = f"{base}{meme['thumbnail_url']}"
                        
                        # Уникальный ID результата
                        result_id = hashlib.md5(meme['id'].encode()).hexdigest()
                        
                        item = InlineQueryResultVideo(
                            id=result_id,
                            video_url=media_link,
                            mime_type="video/mp4",
                            thumbnail_url=thumb_link,
                            title=meme['title'],
                            caption=f"{meme['title']}\n\nСмотреть на MemeHUB: {base}/meme/{meme['id']}"
                        )
                        results.append(item)
                    
                    await inline_query.answer(results, cache_time=5, is_personal=False)
                else:
                    logging.error(f"Backend error {resp.status}: {await resp.text()}")
        except Exception as e:
            logging.error(f"Bot Error: {e}")

async def main():
    print("Бот запущен...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())