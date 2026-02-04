import os
import logging
import aiohttp
from telegram import (
    Update, 
    InlineKeyboardButton, 
    InlineKeyboardMarkup, 
    WebAppInfo,
    InlineQueryResultVideo,
    InlineQueryResultPhoto,
    InlineQueryResultGif
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

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
WEB_APP_URL = os.getenv("WEB_APP_URL")
API_INTERNAL_URL = os.getenv("API_INTERNAL_URL", "http://backend:8000/api/v1") 
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
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/memes/random") as resp:
                if resp.status == 200:
                    meme = await resp.json()
                    
                    media_path = meme.get('media_url', '')
                    # Формируем полный URL
                    if media_path.startswith("http"):
                        media_url = media_path
                    else:
                        media_url = f"{API_PUBLIC_URL}{media_path}"

                    title = meme.get('title', 'Meme')
                    tags = " ".join([f"#{t['name']}" for t in meme.get('tags', [])])
                    caption = f"{title}\n{tags}\n\nVia MemeHUB"
                    
                    # Определяем тип для отправки
                    ext = media_path.split('.')[-1].lower()
                    
                    if ext in ['jpg', 'jpeg', 'png', 'webp']:
                        await update.message.reply_photo(photo=media_url, caption=caption)
                    elif ext in ['gif']:
                        await update.message.reply_animation(animation=media_url, caption=caption)
                    else:
                        await update.message.reply_video(video=media_url, caption=caption)
                else:
                    await update.message.reply_text("Не удалось найти мемы 😔")
    except Exception as e:
        logger.error(f"Error fetching random meme: {e}")
        await update.message.reply_text("Произошла ошибка при поиске мема.")

async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.inline_query.query.strip()
    if not query:
        return

    results = []
    try:
        async with aiohttp.ClientSession() as session:
            # Запрашиваем поиск
            async with session.get(f"{API_INTERNAL_URL}/search/", params={"q": query, "limit": 20}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    for meme in memes:
                        meme_id = str(meme.get("id"))
                        title = meme.get("title", "Meme")
                        
                        media_path = meme.get('media_url', '')
                        thumb_path = meme.get('thumbnail_url', '')
                        
                        # Формируем полные ссылки
                        media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                        thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                        
                        # Обработка тегов
                        # Meilisearch может возвращать теги просто списком строк или объектами
                        raw_tags = meme.get('tags', [])
                        if raw_tags and isinstance(raw_tags[0], dict):
                             tag_str = " ".join([f"#{t['name']}" for t in raw_tags])
                        else:
                             tag_str = " ".join([f"#{t}" for t in raw_tags])
                        
                        description = f"{tag_str}\n{meme.get('description', '')}"
                        caption = f"{title}\n{tag_str}\nVia @{context.bot.username}"

                        # Определяем тип контента для Telegram Inline
                        ext = media_path.split('.')[-1].lower()
                        
                        if ext in ['jpg', 'jpeg', 'png', 'webp']:
                            # КАРТИНКА 🖼️
                            results.append(
                                InlineQueryResultPhoto(
                                    id=meme_id,
                                    photo_url=media_url,
                                    thumbnail_url=thumb_url,
                                    title=f"🖼 {title}",
                                    caption=caption,
                                    description=description
                                )
                            )
                        elif ext in ['gif']:
                            # GIF 🎞️
                            results.append(
                                InlineQueryResultGif(
                                    id=meme_id,
                                    gif_url=media_url,
                                    thumbnail_url=thumb_url,
                                    title=f"🎞 {title}",
                                    caption=caption
                                )
                            )
                        else:
                            # ВИДЕО 🎥
                            results.append(
                                InlineQueryResultVideo(
                                    id=meme_id,
                                    video_url=media_url,
                                    mime_type="video/mp4",
                                    thumbnail_url=thumb_url,
                                    title=f"🎥 {title}",
                                    caption=caption,
                                    description=description
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
    print(f"🤖 Бот запущен!")
    app.run_polling()