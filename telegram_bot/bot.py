import os
import logging
import aiohttp
from telegram import (
    Update, 
    InlineKeyboardButton, 
    InlineKeyboardMarkup, 
    WebAppInfo,
    InlineQueryResultVideo
)
from telegram.ext import (
    ApplicationBuilder, 
    CommandHandler, 
    ContextTypes, 
    InlineQueryHandler
)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# КОНФИГУРАЦИЯ
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
WEB_APP_URL = os.getenv("WEB_APP_URL")

# Адреса API (в Docker они придут через env vars)
# Внутренний адрес для запросов (backend:8000)
API_INTERNAL_URL = os.getenv("API_INTERNAL_URL", "http://backend:8000/api/v1") 
# Публичный адрес для ссылок (ngrok)
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", WEB_APP_URL)

if not TOKEN:
    logger.error("❌ ОШИБКА: Переменная TELEGRAM_BOT_TOKEN не найдена.")
    exit(1)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    logger.info(f"User {user.id} ({user.username}) started bot")
    
    keyboard = [
        [InlineKeyboardButton("📱 Открыть MemeHUB", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("🎲 Случайный мем", callback_data="random_meme")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"Привет, {user.first_name}! 👋\n\n"
        "Я бот MemeHUB. Вот что я умею:\n"
        "🔍 Пиши @mem_baza_bot текст — чтобы найти мем\n"
        "🎲 /random — случайный мем",
        reply_markup=reply_markup
    )

async def random_meme_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /random — запрашивает мем у Backend"""
    try:
        async with aiohttp.ClientSession() as session:
            # Обращаемся к backend внутри сети Docker
            async with session.get(f"{API_INTERNAL_URL}/memes/random") as resp:
                if resp.status == 200:
                    meme = await resp.json()
                    
                    # Формируем публичную ссылку для Telegram (через ngrok)
                    # Если media_url уже полный, используем его, иначе клеим к API_PUBLIC_URL
                    media_path = meme.get('media_url', '')
                    if media_path.startswith("http"):
                        video_url = media_path
                    else:
                        # Убираем /static/ если он есть, чтобы не дублировать пути, если нужно
                        # Но обычно media_url = "/static/file.mp4"
                        # Нужно убедиться, что nginx или backend раздает статику по этому пути
                        video_url = f"{API_PUBLIC_URL}{media_path}"

                    caption = f"{meme.get('title', 'Meme')}\n\nVia MemeHUB"
                    
                    await update.message.reply_video(
                        video=video_url,
                        caption=caption,
                        supports_streaming=True
                    )
                else:
                    await update.message.reply_text("Не удалось найти мемы 😔")
    except Exception as e:
        logger.error(f"Error fetching random meme: {e}")
        await update.message.reply_text("Произошла ошибка при поиске мема.")

async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка инлайн-запросов (@bot query)"""
    query = update.inline_query.query.strip()
    
    # Если запрос пустой, можно ничего не возвращать или вернуть популярные (если реализуешь)
    if not query:
        return

    results = []
    try:
        async with aiohttp.ClientSession() as session:
            # Поиск через твой API
            async with session.get(f"{API_INTERNAL_URL}/search/", params={"q": query, "limit": 20}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    for meme in memes:
                        meme_id = meme.get("id")
                        title = meme.get("title", "Meme")
                        
                        # Ссылки для Telegram должны быть HTTPS (твои ngrok ссылки)
                        media_path = meme.get('media_url', '')
                        thumb_path = meme.get('thumbnail_url', '')
                        
                        video_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                        thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                        
                        results.append(
                            InlineQueryResultVideo(
                                id=str(meme_id),
                                title=title,
                                video_url=video_url,
                                mime_type="video/mp4",
                                thumbnail_url=thumb_url,
                                caption=f"{title}\nVia MemeHUB",
                                description=meme.get("description", "")
                            )
                        )

        await update.inline_query.answer(results, cache_time=5)

    except Exception as e:
        logger.error(f"Inline error: {e}")

if __name__ == '__main__':
    app = ApplicationBuilder().token(TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("random", random_meme_command))
    app.add_handler(InlineQueryHandler(inline_query))
    
    print(f"🤖 Бот запущен! API: {API_INTERNAL_URL} | PUBLIC: {API_PUBLIC_URL}")
    app.run_polling()