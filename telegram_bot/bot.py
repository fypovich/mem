import os
import logging
import hashlib
import aiohttp
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineQueryResultVideo, InputTextMessageContent
from aiogram.filters import Command
from aiogram.utils.markdown import hbold

# Настройки
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
# В Docker сети backend доступен по имени сервиса "backend"
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000/api/v1") 
# Публичный URL для файлов (чтобы Telegram мог скачать видео)
# Для локальной разработки используем ngrok или ip адрес, но пока поставим localhost
# ВНИМАНИЕ: Telegram НЕ увидит localhost:8000. 
# Для теста вам нужен публичный IP или туннель (ngrok).
# Либо, если вы деплоите на сервер - укажите домен.
BASE_MEDIA_URL = os.getenv("BASE_MEDIA_URL", "http://127.0.0.1:8000") 

logging.basicConfig(level=logging.INFO)

# Проверка токена перед стартом
if not TOKEN:
    raise ValueError(f"Токен не найден! Проверьте путь к файлу: {env_path}")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(f"Привет! Я бот {hbold('MemeHUB')}.\n\nНапиши @{await bot.me.username} и текст для поиска мемов!")

@dp.inline_query(F.query)
async def inline_search(inline_query: types.InlineQuery):
    query_text = inline_query.query
    if not query_text or len(query_text) < 2:
        return

    async with aiohttp.ClientSession() as session:
        try:
            # Запрашиваем поиск у нашего бэкенда
            async with session.get(f"{BACKEND_URL}/search/", params={"q": query_text, "limit": 10}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    results = []
                    for meme in memes:
                        # Формируем полный URL к видео
                        video_url = f"{BASE_MEDIA_URL}{meme['media_url']}"
                        thumb_url = f"{BASE_MEDIA_URL}{meme['thumbnail_url']}"
                        
                        # ID результата (должен быть уникальным)
                        result_id = hashlib.md5(meme['id'].encode()).hexdigest()
                        
                        item = InlineQueryResultVideo(
                            id=result_id,
                            video_url=video_url,
                            mime_type="video/mp4",
                            thumbnail_url=thumb_url,
                            title=meme['title'],
                            description=meme.get('description') or "Смотреть мем",
                            caption=f"{meme['title']} \n\n🔗 {BASE_MEDIA_URL}/meme/{meme['id']}" 
                        )
                        results.append(item)
                    
                    await inline_query.answer(results, cache_time=1, is_personal=False)
        except Exception as e:
            logging.error(f"Error searching memes: {e}")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())