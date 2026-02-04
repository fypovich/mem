import os
import logging
import uuid
import aiohttp
from telegram import (
    Update, 
    InlineKeyboardButton, 
    InlineKeyboardMarkup, 
    WebAppInfo,
    InlineQueryResultVideo,
    InputTextMessageContent
)
from telegram.ext import (
    ApplicationBuilder, 
    CommandHandler, 
    ContextTypes, 
    InlineQueryHandler,
    filters
)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# КОНФИГУРАЦИЯ
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
# URL веб-приложения (Front)
WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:3000")
# URL API для запросов бота (Back)
API_URL = os.getenv("API_INTERNAL_URL", "http://backend:8000/api/v1") 
# Публичный URL (ngrok) для формирования ссылок на видео
PUBLIC_URL = os.getenv("API_PUBLIC_URL", "http://localhost:8000")

if not TOKEN:
    logger.error("❌ ОШИБКА: Переменная TELEGRAM_BOT_TOKEN не найдена.")
    exit(1)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    logger.info(f"User {user.id} ({user.username}) started bot")
    
    keyboard = [
        [InlineKeyboardButton("📱 Открыть MemeHUB", web_app=WebAppInfo(url=WEB_APP_URL))],
        [InlineKeyboardButton("🎲 Случайный мем", callback_data="random_meme")] # Можно добавить callback handler
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"Привет, {user.first_name}! 👋\n\n"
        "Я бот MemeHUB. Вот что я умею:\n"
        "🔍 Пиши @мой_бот текст — чтобы найти мем\n"
        "🎲 /random — случайный мем\n"
        "📤 /upload — загрузить свой мем",
        reply_markup=reply_markup
    )

async def upload_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /upload"""
    upload_url = f"{WEB_APP_URL}/upload"
    keyboard = [[InlineKeyboardButton("📤 Загрузить мем", url=upload_url)]]
    await update.message.reply_text(
        "Чтобы загрузить мем, перейди в наше приложение:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def random_meme_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /random"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_URL}/memes/random") as resp:
                if resp.status == 200:
                    meme = await resp.json()
                    
                    # Формируем полный URL для видео/картинки
                    video_url = f"{PUBLIC_URL}{meme['media_url']}"
                    caption = f"{meme['title']}\n\nVia @{context.bot.username}"
                    
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
    
    if not query:
        return

    results = []
    try:
        async with aiohttp.ClientSession() as session:
            # Используем твой Search API
            # search_global возвращает {"memes": [...], ...}
            async with session.get(f"{API_URL}/search/", params={"q": query, "limit": 20}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    for meme in memes:
                        # В MeiliSearch хранятся данные мема
                        meme_id = meme.get("id")
                        title = meme.get("title", "Meme")
                        # Ссылки должны быть HTTPS (ngrok)
                        video_url = f"{PUBLIC_URL}{meme.get('media_url')}"
                        thumb_url = f"{PUBLIC_URL}{meme.get('thumbnail_url')}"
                        
                        # Создаем результат для видео
                        results.append(
                            InlineQueryResultVideo(
                                id=meme_id,
                                title=title,
                                video_url=video_url,
                                mime_type="video/mp4",
                                thumbnail_url=thumb_url,
                                caption=f"{title}\nVia @{context.bot.username}",
                                description=meme.get("description", "")
                            )
                        )

        await update.inline_query.answer(results, cache_time=5) # cache_time=0 для тестов

    except Exception as e:
        logger.error(f"Inline error: {e}")

if __name__ == '__main__':
    # Создаем приложение
    app = ApplicationBuilder().token(TOKEN).build()
    
    # Хендлеры
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("upload", upload_command))
    app.add_handler(CommandHandler("random", random_meme_command))
    
    # Инлайн режим
    app.add_handler(InlineQueryHandler(inline_query))
    
    print(f"🤖 Бот запущен! API: {API_URL} | PUBLIC: {PUBLIC_URL}")
    app.run_polling()