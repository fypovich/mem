import os
import logging
import hashlib
import aiohttp
import asyncio
from pathlib import Path  # <-- Добавлен этот импорт
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineQueryResultVideo
from aiogram.filters import Command
from aiogram.utils.markdown import hbold

# --- ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ---
# Ищем .env в папке backend (на уровень выше)
# Текущая папка: .../test/telegram_bot
# Цель: .../test/backend/.env
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

# Настройки
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# ВАЖНО ДЛЯ ЛОКАЛЬНОГО ЗАПУСКА:
# Если запускаете бота локально (не в Docker), 'backend' как хост не сработает.
# Нужно использовать localhost.
# Docker внутри себя использует имя сервиса 'http://backend:8000/api/v1'
# Локально: 'http://127.0.0.1:8000/api/v1'

# Если переменная не задана в env, используем localhost для локального теста
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000/api/v1") 

# Для тестов с видео (ngrok или localhost)
# Убедитесь, что этот URL ведет туда, откуда Telegram сможет скачать файл
BASE_MEDIA_URL = os.getenv("BASE_MEDIA_URL", "http://127.0.0.1:8000") 

logging.basicConfig(level=logging.INFO)

# Проверка токена перед стартом
if not TOKEN:
    raise ValueError(f"Токен не найден! Проверьте файл .env по пути: {env_path}")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    # Используем get_me() для получения имени бота
    bot_info = await bot.get_me()
    await message.answer(f"Привет! Я бот {hbold('MemeHUB')}.\n\nНапиши @{bot_info.username} и текст для поиска мемов!")

@dp.inline_query(F.query)
async def inline_search(inline_query: types.InlineQuery):
    query_text = inline_query.query
    if not query_text or len(query_text) < 2:
        return

    async with aiohttp.ClientSession() as session:
        try:
            # Логируем запрос для отладки
            # Если BACKEND_URL заканчивается на /, убираем его, чтобы не было //search
            api_base = BACKEND_URL.rstrip('/')
            search_url = f"{api_base}/search/"
            
            logging.info(f"Searching at: {search_url} with q={query_text}")
            
            async with session.get(search_url, params={"q": query_text, "limit": 10}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    results = []
                    for meme in memes:
                        # Формируем полный URL к видео
                        base = BASE_MEDIA_URL.rstrip('/')
                        # Убираем ведущий слеш у путей из БД, чтобы не получить http://url//static...
                        media = meme['media_url'].lstrip('/')
                        thumb = meme['thumbnail_url'].lstrip('/')
                        
                        video_url = f"{base}/{media}"
                        thumb_url = f"{base}/{thumb}"
                        
                        result_id = hashlib.md5(meme['id'].encode()).hexdigest()
                        
                        item = InlineQueryResultVideo(
                            id=result_id,
                            video_url=video_url,
                            mime_type="video/mp4",
                            thumbnail_url=thumb_url,
                            title=meme['title'],
                            description=meme.get('description') or "Смотреть мем",
                            caption=f"{meme['title']} \n\n🔗 {base}/meme/{meme['id']}" 
                        )
                        results.append(item)
                    
                    await inline_query.answer(results, cache_time=1, is_personal=False)
                else:
                    logging.error(f"Backend error: {resp.status} - {await resp.text()}")
        except Exception as e:
            logging.error(f"Error searching memes: {e}")

async def main():
    print("Bot started!")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())