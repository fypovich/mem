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
    """Обработка инлайн-запросов (Поиск + Режимы)"""
    raw_query = update.inline_query.query.strip()
    
    # 1. ОПРЕДЕЛЯЕМ РЕЖИМ (Видео по умолчанию или Картинки #img)
    force_images = False
    clean_query = raw_query
    
    if raw_query.endswith("#img"):
        force_images = True
        clean_query = raw_query.replace("#img", "").strip()
    
    # Параметры поиска для бэкенда
    params = {"limit": 60} # Берем побольше
    
    if not clean_query:
        params["q"] = ""
        params["sort"] = "new" 
    else:
        params["q"] = clean_query

    video_results = []
    image_results = []

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/search/", params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    # 2. РАЗДЕЛЯЕМ РЕЗУЛЬТАТЫ
                    temp_videos = []
                    temp_images = []

                    for meme in memes:
                        media_path = meme.get('media_url', '')
                        ext = media_path.split('.')[-1].lower()
                        if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                            temp_images.append(meme)
                        else:
                            temp_videos.append(meme)

                    # Подсчитываем количество для кнопок
                    img_count = len(temp_images)
                    vid_count = len(temp_videos)

                    # 3. ФОРМИРУЕМ ОТВЕТ В ЗАВИСИМОСТИ ОТ РЕЖИМА
                    
                    # --- РЕЖИМ: КАРТИНКИ (Если запросили #img ИЛИ если видео вообще нет) ---
                    if force_images or (not temp_videos and temp_images):
                        
                        # Кнопка "Назад к видео" (если видео вообще существуют по этому запросу)
                        back_btn = None
                        if vid_count > 0:
                            # switch_inline_query_current_chat вставляет текст в поле ввода
                            back_btn = InlineKeyboardMarkup([[
                                InlineKeyboardButton(f"📹 К видео ({vid_count})", switch_inline_query_current_chat=clean_query)
                            ]])

                        for meme in temp_images:
                            meme_id = str(meme.get("id"))
                            title = meme.get("title", "Meme")
                            shares = meme.get("shares_count", 0)
                            
                            media_path = meme.get('media_url', '')
                            thumb_path = meme.get('thumbnail_url', '')
                            width = meme.get("width")
                            height = meme.get("height")
                            
                            media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                            thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                            
                            # Для GIF показываем стату в заголовке
                            ext = media_path.split('.')[-1].lower()
                            display_title = title if ext not in ['gif'] else f"🎞 {title} (🔥 {shares})"

                            if ext in ['gif']:
                                image_results.append(
                                    InlineQueryResultGif(
                                        id=meme_id,
                                        gif_url=media_url,
                                        thumbnail_url=thumb_url,
                                        gif_width=width,
                                        gif_height=height,
                                        title=display_title,
                                        reply_markup=back_btn # Кнопка возврата
                                    )
                                )
                            else:
                                image_results.append(
                                    InlineQueryResultPhoto(
                                        id=meme_id,
                                        photo_url=media_url,
                                        thumbnail_url=thumb_url,
                                        photo_width=width,
                                        photo_height=height,
                                        title=f"🖼 {display_title}",
                                        reply_markup=back_btn # Кнопка возврата
                                    )
                                )
                        
                        await update.inline_query.answer(image_results, cache_time=1)

                    # --- РЕЖИМ: ВИДЕО (По умолчанию) ---
                    else:
                        # Кнопка "Перейти к фото" (если фото есть)
                        switch_btn = None
                        if img_count > 0:
                            # Добавляем #img к текущему запросу
                            new_query = f"{clean_query} #img".strip()
                            switch_btn = InlineKeyboardMarkup([[
                                InlineKeyboardButton(f"📸 Фото/GIF ({img_count})", switch_inline_query_current_chat=new_query)
                            ]])

                        for meme in temp_videos:
                            meme_id = str(meme.get("id"))
                            title = meme.get("title", "Meme")
                            shares = meme.get("shares_count", 0)
                            
                            media_path = meme.get('media_url', '')
                            thumb_path = meme.get('thumbnail_url', '')
                            
                            duration = int(meme.get("duration", 0) or 0)
                            width = meme.get("width")
                            height = meme.get("height")

                            media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                            thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                            
                            tags = meme.get('tags', [])
                            tag_str = ""
                            if tags:
                                t_list = [t['name'] for t in tags] if isinstance(tags[0], dict) else tags
                                tag_str = " ".join([f"#{t}" for t in t_list[:3]])

                            list_description = f"🔥 Отправлено: {shares} раз\n{tag_str}"

                            video_results.append(
                                InlineQueryResultVideo(
                                    id=meme_id,
                                    video_url=media_url,
                                    mime_type="video/mp4",
                                    thumbnail_url=thumb_url,
                                    video_width=width,
                                    video_height=height,
                                    video_duration=duration,
                                    title=f"📹 {title}",
                                    description=list_description,
                                    reply_markup=switch_btn # 👈 Кнопка переключения на фото
                                )
                            )
                        
                        # Если видео нет, но есть фото - логика выше (force_images) сработает, 
                        # но здесь на всякий случай страховка
                        if not video_results and image_results:
                             await update.inline_query.answer(image_results, cache_time=1)
                        else:
                             await update.inline_query.answer(video_results, cache_time=1)

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