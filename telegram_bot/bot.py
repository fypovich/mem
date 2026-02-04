import os
import logging
import aiohttp
import requests
from telegram import (
    Update, 
    InlineKeyboardButton, 
    InlineKeyboardMarkup, 
    WebAppInfo,
    InlineQueryResultVideo,
    InlineQueryResultPhoto,
    InlineQueryResultGif,
    InlineQueryResultArticle,
    InputTextMessageContent,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove
)
from telegram.ext import (
    ApplicationBuilder, 
    CommandHandler, 
    ContextTypes, 
    InlineQueryHandler,
    ChosenInlineResultHandler,
    ConversationHandler,
    MessageHandler,
    filters
)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# --- КОНФИГУРАЦИЯ ---
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
WEB_APP_URL = os.getenv("WEB_APP_URL")
API_INTERNAL_URL = os.getenv("API_INTERNAL_URL", "http://backend:8000/api/v1") 
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", WEB_APP_URL)

# Данные для системного пользователя-бота
BOT_USERNAME = "bot_uploader"
BOT_PASSWORD = os.getenv("BOT_USER_PASSWORD", "super_secret_bot_password_123")
BOT_EMAIL = "bot@memehub.local"

# Глобальная переменная для хранения JWT токена
API_ACCESS_TOKEN = None

# --- СОСТОЯНИЯ ДИАЛОГА (Conversation) ---
UPLOAD_MEDIA, UPLOAD_TITLE, UPLOAD_TAGS, UPLOAD_AUDIO = range(4)

if not TOKEN:
    logger.error("❌ ОШИБКА: Переменная TELEGRAM_BOT_TOKEN не найдена.")
    exit(1)

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

def ensure_bot_user_exists():
    """
    Регистрирует или логинит пользователя 'bot', чтобы получить токен для API.
    Выполняется синхронно при старте.
    """
    global API_ACCESS_TOKEN
    
    # 1. Пробуем войти
    login_url = f"{API_INTERNAL_URL}/auth/login"
    try:
        resp = requests.post(login_url, data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
        if resp.status_code == 200:
            API_ACCESS_TOKEN = resp.json().get("access_token")
            logger.info(f"✅ Bot authorized as '{BOT_USERNAME}'")
            return
    except Exception as e:
        logger.warning(f"Login failed (server might be down yet): {e}")

    # 2. Если не вышло (401/404), пробуем зарегистрировать
    register_url = f"{API_INTERNAL_URL}/auth/register"
    try:
        payload = {
            "email": BOT_EMAIL,
            "username": BOT_USERNAME,
            "password": BOT_PASSWORD,
            "full_name": "Telegram Bot"
        }
        resp = requests.post(register_url, json=payload)
        if resp.status_code in [200, 201]:
            logger.info(f"✅ Created user '{BOT_USERNAME}'")
            # Сразу логинимся
            login_resp = requests.post(login_url, data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
            if login_resp.status_code == 200:
                API_ACCESS_TOKEN = login_resp.json().get("access_token")
                return
    except Exception as e:
        logger.error(f"Failed to create bot user: {e}")

# --- ОБРАБОТЧИКИ КОМАНД ---

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
        "🔎 Ищи мемы: `@mem_baza_bot запрос`\n"
        "📤 Загружай мемы: /upload",
        reply_markup=reply_markup
    )

# --- WIZARD ЗАГРУЗКИ (CONVERSATION) ---

async def upload_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начало загрузки: просим медиа"""
    # Очищаем контекст пользователя
    context.user_data.clear()
    
    await update.message.reply_text(
        "📤 **Загрузка нового мема**\n\n"
        "Отправь мне:\n"
        "• Картинку 📸\n"
        "• Видео 📹\n"
        "• Или GIF 🎞\n\n"
        "Или напиши /cancel для отмены.",
        parse_mode="Markdown"
    )
    return UPLOAD_MEDIA

async def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Шаг 1: Получаем файл"""
    message = update.message
    
    # Определяем тип и берем самый качественный файл
    file_obj = None
    is_video = False
    
    if message.video:
        file_obj = await message.video.get_file()
        is_video = True
    elif message.animation: # GIF
        file_obj = await message.animation.get_file()
        # GIF в телеге это часто mp4 без звука
        is_video = False 
    elif message.photo:
        file_obj = await message.photo[-1].get_file() # Берем хайрез
        is_video = False
    else:
        await message.reply_text("❌ Это не похоже на медиа-файл. Попробуй еще раз.")
        return UPLOAD_MEDIA

    # Сохраняем file_id и тип
    context.user_data['file_id'] = file_obj.file_id
    context.user_data['file_unique_id'] = file_obj.file_unique_id
    context.user_data['is_video'] = is_video
    
    await message.reply_text("✅ Файл принят!\n\nТеперь напиши **заголовок** для мема:", parse_mode="Markdown")
    return UPLOAD_TITLE

async def handle_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Шаг 2: Заголовок"""
    title = update.message.text.strip()
    if len(title) < 2:
        await update.message.reply_text("Слишком короткий заголовок. Давай подлиннее.")
        return UPLOAD_TITLE
        
    context.user_data['title'] = title
    
    # 🔥 ИСПРАВЛЕНА ОШИБКА ЗДЕСЬ (Убрано присваивание к await)
    await update.message.reply_text(
        "📝 Заголовок сохранен.\n\n"
        "Теперь напиши **теги** через запятую (например: `кот, смешно, мем`):",
        parse_mode="Markdown"
    )
    return UPLOAD_TAGS

async def handle_tags(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Шаг 3: Теги и развилка (Аудио или Финиш)"""
    tags = update.message.text.strip()
    context.user_data['tags'] = tags
    
    is_video = context.user_data.get('is_video', False)
    
    # Если это Видео, сразу грузим (пока без аудио-монтажа для видео)
    if is_video:
        await update.message.reply_text("⏳ Обрабатываю видео и загружаю на сервер...")
        return await perform_upload(update, context)
    else:
        # Предлагаем наложить аудио на картинку/гиф
        keyboard = [['/skip Пропустить']]
        reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)
        
        await update.message.reply_text(
            "🎤 **Хочешь добавить звук?**\n\n"
            "Отправь мне **Голосовое сообщение** или **Аудиофайл**, и я наложу его на мем.\n"
            "Если не хочешь — нажми /skip.",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return UPLOAD_AUDIO

async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Шаг 4: Получение аудио"""
    message = update.message
    
    if message.voice:
        file_obj = await message.voice.get_file()
        context.user_data['audio_file_id'] = file_obj.file_id
    elif message.audio:
        file_obj = await message.audio.get_file()
        context.user_data['audio_file_id'] = file_obj.file_id
    else:
        await message.reply_text("Это не аудио. Отправь голосовое или нажми /skip.")
        return UPLOAD_AUDIO
        
    await message.reply_text("🎵 Аудио получено! Начинаю магию монтажа...", reply_markup=ReplyKeyboardRemove())
    return await perform_upload(update, context)

async def skip_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Пропуск аудио"""
    await update.message.reply_text("Ок, загружаем без звука...", reply_markup=ReplyKeyboardRemove())
    return await perform_upload(update, context)

# --- ФИНАЛЬНАЯ ЗАГРУЗКА НА API ---

async def perform_upload(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отправка данных на Backend"""
    global API_ACCESS_TOKEN
    if not API_ACCESS_TOKEN:
        ensure_bot_user_exists()
        if not API_ACCESS_TOKEN:
            await update.message.reply_text("❌ Ошибка авторизации бота на сервере.")
            return ConversationHandler.END

    try:
        # 1. Скачиваем основной файл
        main_file = await context.bot.get_file(context.user_data['file_id'])
        main_buffer = await main_file.download_as_bytearray()
        
        file_path = main_file.file_path
        ext = file_path.split('.')[-1]
        filename = f"upload.{ext}"

        # 2. Скачиваем аудио (если есть)
        audio_buffer = None
        audio_filename = None
        if 'audio_file_id' in context.user_data:
            audio_file = await context.bot.get_file(context.user_data['audio_file_id'])
            audio_buffer = await audio_file.download_as_bytearray()
            audio_filename = "voice.ogg"

        # 3. Формируем запрос
        form = aiohttp.FormData()
        form.add_field('title', context.user_data['title'])
        form.add_field('tags', context.user_data['tags'])
        form.add_field('file', main_buffer, filename=filename)
        
        if audio_buffer:
            form.add_field('audio_file', audio_buffer, filename=audio_filename)

        headers = {"Authorization": f"Bearer {API_ACCESS_TOKEN}"}

        # 4. Отправляем
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{API_INTERNAL_URL}/memes/upload", data=form, headers=headers) as resp:
                if resp.status in [200, 201]:
                    meme = await resp.json()
                    share_link = f"@{context.bot.username} {meme.get('title')}"
                    
                    await update.message.reply_text(
                        f"🎉 **Мем успешно опубликован!**\n\n"
                        f"🆔 ID: `{meme['id']}`\n"
                        f"Попробуй найти его в поиске: `{share_link}`",
                        parse_mode="Markdown"
                    )
                else:
                    err_text = await resp.text()
                    logger.error(f"Upload failed: {resp.status} - {err_text}")
                    await update.message.reply_text(f"😔 Ошибка сервера: {resp.status}")

    except Exception as e:
        logger.error(f"Bot upload exception: {e}")
        await update.message.reply_text("Произошла ошибка при загрузке.")

    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ Загрузка отменена.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END

async def random_meme_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/memes/random") as resp:
                if resp.status == 200:
                    meme = await resp.json()
                    media_path = meme.get('media_url', '')
                    media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                    caption = f"{meme.get('title')}\nVia @{context.bot.username}"
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
    
    force_images = False
    clean_query = raw_query
    
    if raw_query.endswith("#img"):
        force_images = True
        clean_query = raw_query.replace("#img", "").strip()
    
    params = {"limit": 60}
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
                    
                    # Разделение результатов
                    temp_videos = []
                    temp_images = []

                    for meme in memes:
                        media_path = meme.get('media_url', '')
                        ext = media_path.split('.')[-1].lower()
                        if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                            temp_images.append(meme)
                        else:
                            temp_videos.append(meme)

                    img_count = len(temp_images)
                    vid_count = len(temp_videos)

                    # --- РЕЖИМ: КАРТИНКИ ---
                    if force_images or (not temp_videos and temp_images):
                        back_btn = None
                        if vid_count > 0:
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
                            ext = media_path.split('.')[-1].lower()
                            display_title = title if ext not in ['gif'] else f"🎞 {title} (🔥 {shares})"

                            if ext in ['gif']:
                                image_results.append(InlineQueryResultGif(
                                    id=meme_id, gif_url=media_url, thumbnail_url=thumb_url,
                                    gif_width=width, gif_height=height, title=display_title,
                                    reply_markup=back_btn
                                ))
                            else:
                                # Можно использовать Article для списка или Photo для сетки. Оставим Photo.
                                image_results.append(InlineQueryResultPhoto(
                                    id=meme_id, photo_url=media_url, thumbnail_url=thumb_url,
                                    photo_width=width, photo_height=height, title=f"🖼 {display_title}",
                                    reply_markup=back_btn
                                ))
                        
                        await update.inline_query.answer(image_results, cache_time=1)

                    # --- РЕЖИМ: ВИДЕО ---
                    else:
                        switch_btn = None
                        if img_count > 0:
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
                            tag_str = " ".join([f"#{t['name']}" for t in tags[:3]]) if tags else ""
                            list_description = f"🔥 Отправлено: {shares} раз\n{tag_str}"

                            video_results.append(InlineQueryResultVideo(
                                id=meme_id, video_url=media_url, mime_type="video/mp4",
                                thumbnail_url=thumb_url, video_width=width, video_height=height,
                                video_duration=duration, title=f"📹 {title}", description=list_description,
                                reply_markup=switch_btn
                            ))
                        
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
    # 1. Авторизация бота
    ensure_bot_user_exists()
    
    app = ApplicationBuilder().token(TOKEN).build()
    
    # 2. Настраиваем загрузку
    upload_handler = ConversationHandler(
        entry_points=[CommandHandler("upload", upload_start)],
        states={
            UPLOAD_MEDIA: [MessageHandler(filters.PHOTO | filters.VIDEO | filters.ANIMATION, handle_media)],
            UPLOAD_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_title)],
            UPLOAD_TAGS: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_tags)],
            UPLOAD_AUDIO: [
                MessageHandler(filters.VOICE | filters.AUDIO, handle_audio),
                CommandHandler("skip", skip_audio)
            ]
        },
        fallbacks=[CommandHandler("cancel", cancel)]
    )
    
    app.add_handler(upload_handler)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("random", random_meme_command))
    
    # 3. Инлайн
    app.add_handler(InlineQueryHandler(inline_query)) # 🔥 Имя функции исправлено!
    app.add_handler(ChosenInlineResultHandler(on_chosen_result))
    
    print(f"🤖 Бот запущен! Пользователь бота: {BOT_USERNAME}")
    app.run_polling()