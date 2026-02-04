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
    InlineQueryHandler,
    ChosenInlineResultHandler
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
        "Я бот MemeHUB. \n"
        "🔎 Просто начни писать @mem_baza_bot в любом чате!",
        reply_markup=reply_markup
    )

async def random_meme_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/memes/random") as resp:
                if resp.status == 200:
                    meme = await resp.json()
                    
                    media_path = meme.get('media_url', '')
                    media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                    caption = "" 
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
        await update.message.reply_text("Ошибка при поиске.")

async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка инлайн-запросов (Поиск)"""
    query = update.inline_query.query.strip()
    
    # ПАРАМЕТРЫ ПОИСКА
    params = {"limit": 20}
    
    if not query:
        # Если запрос пустой, запрашиваем "свежие" мемы (пустой q + сортировка)
        # Убедись, что твой Search API нормально реагирует на пустой q (возвращает placeholder search)
        # Если Search API требует q, можно передать "*", если MeiliSearch настроен так
        params["q"] = "" 
    else:
        params["q"] = query

    results = []
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/search/", params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    for meme in memes:
                        meme_id = str(meme.get("id"))
                        base_title = meme.get("title", "Meme")
                        shares = meme.get("shares_count", 0) 
                        
                        media_path = meme.get('media_url', '')
                        thumb_path = meme.get('thumbnail_url', '')
                        
                        # Метаданные
                        duration = int(meme.get("duration", 0) or 0)
                        width = meme.get("width")
                        height = meme.get("height")

                        media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                        thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                        
                        # --- ТЕГИ ---
                        raw_tags = meme.get('tags', [])
                        tag_str = ""
                        if raw_tags:
                            if isinstance(raw_tags[0], dict):
                                tag_list = [t['name'] for t in raw_tags]
                            else:
                                tag_list = raw_tags
                            tag_str = " ".join([f"#{t}" for t in tag_list[:3]])

                        # --- ОПИСАНИЕ (для Видео и Фото) ---
                        list_description = f"🔥 Отправлено: {shares} раз\n{tag_str}"

                        ext = media_path.split('.')[-1].lower()
                        
                        if ext in ['jpg', 'jpeg', 'png', 'webp']:
                            results.append(
                                InlineQueryResultPhoto(
                                    id=meme_id,
                                    photo_url=media_url,
                                    thumbnail_url=thumb_url,
                                    photo_width=width,
                                    photo_height=height,
                                    title=f"🖼 {base_title}", 
                                    description=list_description, 
                                    caption=""
                                )
                            )
                        elif ext in ['gif']:
                            # ДЛЯ GIF: Статистику пишем в TITLE, т.к. description нет
                            gif_title = f"🎞 {base_title} (🔥 {shares})"
                            results.append(
                                InlineQueryResultGif(
                                    id=meme_id,
                                    gif_url=media_url,
                                    thumbnail_url=thumb_url,
                                    gif_width=width,
                                    gif_height=height,
                                    title=gif_title, # <--- Сюда статистику
                                    caption=""
                                )
                            )
                        else:
                            results.append(
                                InlineQueryResultVideo(
                                    id=meme_id,
                                    video_url=media_url,
                                    mime_type="video/mp4",
                                    thumbnail_url=thumb_url,
                                    video_width=width,
                                    video_height=height,
                                    video_duration=duration,
                                    title=f"📹 {base_title}",
                                    description=list_description, 
                                    caption=""
                                )
                            )

        # cache_time=0 или 1, чтобы новые загруженные мемы появлялись сразу
        await update.inline_query.answer(results, cache_time=1)

    except Exception as e:
        logger.error(f"Inline error: {e}")

async def on_chosen_result(update: Update, context: ContextTypes.DEFAULT_TYPE):
    result = update.chosen_inline_result
    meme_id = result.result_id
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{API_INTERNAL_URL}/memes/{meme_id}/share"
            async with session.post(url) as resp:
                if resp.status == 200:
                    logger.info(f"✅ Share counted for meme {meme_id}")
    except Exception as e:
        logger.error(f"Error tracking share: {e}")

if __name__ == '__main__':
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("random", random_meme_command))
    app.add_handler(InlineQueryHandler(inline_query))
    app.add_handler(ChosenInlineResultHandler(on_chosen_result))
    print(f"🤖 Бот запущен! API: {API_INTERNAL_URL}")
    app.run_polling()