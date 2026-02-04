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
        "Я бот MemeHUB. Вот что я умею:\n"
        "🔍 Пиши @mem_baza_bot текст — чтобы найти мем\n"
        "🎲 /random — случайный мем",
        reply_markup=reply_markup
    )

async def random_meme_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /random"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/memes/random") as resp:
                if resp.status == 200:
                    meme = await resp.json()
                    
                    media_path = meme.get('media_url', '')
                    if media_path.startswith("http"):
                        media_url = media_path
                    else:
                        media_url = f"{API_PUBLIC_URL}{media_path}"

                    # ПУСТАЯ ПОДПИСЬ (как ты просил)
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
    """Поиск мемов"""
    query = update.inline_query.query.strip()
    
    if not query:
        return

    results = []
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/search/", params={"q": query, "limit": 20}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    for meme in memes:
                        meme_id = str(meme.get("id"))
                        base_title = meme.get("title", "Meme")
                        shares = meme.get("shares_count", 0) # Получаем количество отправок
                        
                        media_path = meme.get('media_url', '')
                        thumb_path = meme.get('thumbnail_url', '')
                        
                        media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                        thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                        
                        # --- ФОРМИРОВАНИЕ ОПИСАНИЯ ---
                        # Чтобы на ПК это выглядело как список, нужно всегда заполнять description
                        tags = meme.get('tags', [])
                        # Упрощаем вывод тегов
                        tag_str = ""
                        if tags:
                             tag_names = [t['name'] for t in tags] if isinstance(tags[0], dict) else tags
                             tag_str = " ".join([f"#{t}" for t in tag_names[:3]]) # Берем первые 3 тега

                        # 👇 ВОТ ЗДЕСЬ МАГИЯ СПИСКА
                        # Первая строка описания - статистика. Вторая - теги/описание.
                        clean_description = meme.get('description', '') or ""
                        list_description = f"🔥 Отправлено: {shares} раз\n{tag_str} {clean_description}"[:100]

                        # Заголовок делаем жирным и понятным
                        display_title = base_title

                        ext = media_path.split('.')[-1].lower()
                        
                        if ext in ['jpg', 'jpeg', 'png', 'webp']:
                            results.append(
                                InlineQueryResultPhoto(
                                    id=meme_id,
                                    photo_url=media_url,
                                    thumbnail_url=thumb_url,
                                    title=f"🖼 {display_title}", 
                                    description=list_description, # Описание выведется под заголовком
                                    caption="" 
                                )
                            )
                        elif ext in ['gif']:
                            results.append(
                                InlineQueryResultGif(
                                    id=meme_id,
                                    gif_url=media_url,
                                    thumbnail_url=thumb_url,
                                    title=f"🎞 {display_title}",
                                    caption=""
                                )
                            )
                        else:
                            # Для видео на ПК Telegram показывает список, если есть title/description
                            results.append(
                                InlineQueryResultVideo(
                                    id=meme_id,
                                    video_url=media_url,
                                    mime_type="video/mp4",
                                    thumbnail_url=thumb_url,
                                    title=f"📹 {display_title}",
                                    description=list_description,
                                    caption=""
                                )
                            )

        await update.inline_query.answer(results, cache_time=5) # Кэш поменьше, чтобы цифры обновлялись

    except Exception as e:
        logger.error(f"Inline error: {e}")

async def on_chosen_result(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Срабатывает, когда пользователь нажал на мем в списке"""
    result = update.chosen_inline_result
    meme_id = result.result_id
    user_id = result.from_user.id
    
    # query = result.query # Текст поиска, который ввел юзер (можно сохранить для аналитики)
    
    logger.info(f"User {user_id} shared meme {meme_id}")

    try:
        # Отправляем запрос на Backend, чтобы увеличить счетчик
        async with aiohttp.ClientSession() as session:
            url = f"{API_INTERNAL_URL}/memes/{meme_id}/share"
            async with session.post(url) as resp:
                if resp.status != 200:
                    logger.error(f"Failed to track share for {meme_id}: {resp.status}")
    except Exception as e:
        logger.error(f"Error tracking share: {e}")

if __name__ == '__main__':
    app = ApplicationBuilder().token(TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("random", random_meme_command))
    
    # Обработчик поиска
    app.add_handler(InlineQueryHandler(inline_query))
    
    # 👇 ВАЖНО: Обработчик клика (Feedback)
    app.add_handler(ChosenInlineResultHandler(on_chosen_result))
    
    print(f"🤖 Бот запущен! API: {API_INTERNAL_URL}")
    app.run_polling()