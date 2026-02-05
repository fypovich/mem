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
# Если переменная не задана, берем WEB_APP_URL, но убираем слэш в конце если есть
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", WEB_APP_URL)
if API_PUBLIC_URL and API_PUBLIC_URL.endswith('/'):
    API_PUBLIC_URL = API_PUBLIC_URL[:-1]

# Данные для системного пользователя-бота
BOT_USERNAME = "bot"
BOT_PASSWORD = os.getenv("BOT_USER_PASSWORD", "SuperSecretBotPass123!")
BOT_EMAIL = "bot@tg.ru"

# Глобальная переменная для хранения JWT токена
API_ACCESS_TOKEN = None

# --- СОСТОЯНИЯ ДИАЛОГА ---
UPLOAD_MEDIA, UPLOAD_TITLE, UPLOAD_TAGS, UPLOAD_AUDIO = range(4)

if not TOKEN:
    logger.error("❌ ОШИБКА: Переменная TELEGRAM_BOT_TOKEN не найдена.")
    exit(1)

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

def ensure_bot_user_exists():
    global API_ACCESS_TOKEN
    login_url = f"{API_INTERNAL_URL}/auth/token"
    try:
        resp = requests.post(login_url, data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
        if resp.status_code == 200:
            API_ACCESS_TOKEN = resp.json().get("access_token")
            logger.info(f"✅ Bot authorized as '{BOT_USERNAME}'")
            return
        else:
            logger.warning(f"⚠️ Login failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.warning(f"Login connection failed: {e}")

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
            login_resp = requests.post(login_url, data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
            if login_resp.status_code == 200:
                API_ACCESS_TOKEN = login_resp.json().get("access_token")
                return
        else:
            logger.error(f"❌ Registration failed: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Failed to create bot user: {e}")

# --- ОБРАБОТЧИКИ ---

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

# --- ЗАГРУЗКА (WIZARD) ---

async def upload_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text(
        "📤 **Загрузка нового мема**\n\n"
        "Отправь мне:\n"
        "• Картинку 📸\n"
        "• Видео 📹\n"
        "• Или GIF (файлом) 🎞\n\n"
        "Или /cancel для отмены.",
        parse_mode="Markdown"
    )
    return UPLOAD_MEDIA

async def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    file_obj = None
    is_video = False
    
    # Очистка флага принудительного расширения
    if 'force_ext' in context.user_data:
        del context.user_data['force_ext']
    
    # 1. Проверяем ДОКУМЕНТ (Файл) - Самая частая проблема с GIF
    if message.document:
        file_obj = await message.document.get_file()
        fname = message.document.file_name or ""
        mime = message.document.mime_type or ""
        
        # Исправленная логика: проверяем, видео ли это. Если нет - считаем картинкой/гифкой.
        # Это позволяет принимать файлы без расширения или со странными MIME.
        if 'video' in mime and not 'gif' in mime and not fname.lower().endswith('.gif'):
             is_video = True
        else:
             # Это картинка или GIF
             is_video = False
             # Если явно GIF, ставим флаг для сохранения расширения
             if fname.lower().endswith('.gif') or 'gif' in mime:
                 context.user_data['force_ext'] = 'gif'
             # Если имени нет, но это документ, на всякий случай тоже можно пометить как gif или jpg
             # (Оставим бэкенду разбираться, главное приняли файл)

    # 2. Проверяем ВИДЕО (сжатое телеграмом)
    elif message.video:
        file_obj = await message.video.get_file()
        is_video = True

    # 3. Проверяем АНИМАЦИЮ (Telegram сжал GIF в MP4 без звука)
    elif message.animation:
        file_obj = await message.animation.get_file()
        is_video = False # Считаем контентом без звука

    # 4. Проверяем ФОТО
    elif message.photo:
        file_obj = await message.photo[-1].get_file()
        is_video = False
    
    else:
        await message.reply_text("❌ Формат не поддерживается. Пришли файл или медиа.")
        return UPLOAD_MEDIA

    context.user_data['file_id'] = file_obj.file_id
    context.user_data['is_video'] = is_video
    
    await message.reply_text("✅ Файл принят!\n\nТеперь напиши **заголовок**:", parse_mode="Markdown")
    return UPLOAD_TITLE

async def handle_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    title = update.message.text.strip()
    if len(title) < 2:
        await update.message.reply_text("Слишком короткий заголовок.")
        return UPLOAD_TITLE
    context.user_data['title'] = title
    await update.message.reply_text(
        "📝 Заголовок есть.\n\n"
        "Теперь напиши **теги** через запятую (например: `кот, смешно`):",
        parse_mode="Markdown"
    )
    return UPLOAD_TAGS

async def handle_tags(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tags = update.message.text.strip()
    context.user_data['tags'] = tags
    is_video = context.user_data.get('is_video', False)
    if is_video:
        await update.message.reply_text("⏳ Загружаю видео на сервер...")
        return await perform_upload(update, context)
    else:
        keyboard = [['/skip Пропустить']]
        reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)
        await update.message.reply_text(
            "🎤 **Добавить звук?**\n\n"
            "Отправь **Голосовое** или **Аудиофайл**.\n"
            "Или нажми /skip.",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return UPLOAD_AUDIO

async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    if message.voice:
        file_obj = await message.voice.get_file()
        context.user_data['audio_file_id'] = file_obj.file_id
    elif message.audio:
        file_obj = await message.audio.get_file()
        context.user_data['audio_file_id'] = file_obj.file_id
    else:
        await message.reply_text("Это не аудио. Отправь файл или /skip.")
        return UPLOAD_AUDIO
    await message.reply_text("🎵 Аудио принято! Обрабатываю...", reply_markup=ReplyKeyboardRemove())
    return await perform_upload(update, context)

async def skip_audio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Ок, без звука...", reply_markup=ReplyKeyboardRemove())
    return await perform_upload(update, context)

async def perform_upload(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global API_ACCESS_TOKEN
    if not API_ACCESS_TOKEN:
        ensure_bot_user_exists()
        if not API_ACCESS_TOKEN:
            await update.message.reply_text("❌ Ошибка: Бот не смог авторизоваться.")
            return ConversationHandler.END

    try:
        main_file = await context.bot.get_file(context.user_data['file_id'])
        main_buffer = await main_file.download_as_bytearray()
        
        file_path = main_file.file_path
        
        # ЛОГИКА РАСШИРЕНИЯ
        if context.user_data.get('force_ext') == 'gif':
            ext = 'gif'
        elif '.' in file_path:
            ext = file_path.split('.')[-1]
        else:
            ext = 'jpg' # Дефолт, если телеграм не дал расширения
            
        filename = f"upload.{ext}"

        form = aiohttp.FormData()
        form.add_field('title', context.user_data['title'])
        form.add_field('tags', context.user_data['tags'])
        form.add_field('file', main_buffer, filename=filename)
        
        if 'audio_file_id' in context.user_data:
            audio_file = await context.bot.get_file(context.user_data['audio_file_id'])
            audio_buffer = await audio_file.download_as_bytearray()
            form.add_field('audio_file', audio_buffer, filename="voice.ogg")

        headers = {"Authorization": f"Bearer {API_ACCESS_TOKEN}"}
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{API_INTERNAL_URL}/memes/upload", data=form, headers=headers) as resp:
                if resp.status in [200, 201]:
                    meme = await resp.json()
                    share_link = f"@{context.bot.username} {meme.get('title')}"
                    await update.message.reply_text(
                        f"🎉 **Готово!** Мем опубликован.\n"
                        f"Ищи его: `{share_link}`",
                        parse_mode="Markdown"
                    )
                else:
                    err = await resp.text()
                    logger.error(f"Upload error: {resp.status} {err}")
                    await update.message.reply_text(f"😔 Ошибка сервера: {resp.status}")

    except Exception as e:
        logger.error(f"Upload exception: {e}")
        await update.message.reply_text("Ошибка при отправке.")

    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("❌ Отменено.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END

# --- INLINE LOGIC (ПОИСК) ---

async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    raw_query = update.inline_query.query.strip()
    
    # Можно принудительно искать только картинки через #img, но лучше показывать всё
    clean_query = raw_query
    if raw_query.endswith("#img"):
        clean_query = raw_query.replace("#img", "").strip()
    
    params = {"limit": 60}
    if not clean_query:
        params["q"] = ""
        params["sort"] = "new" 
    else:
        params["q"] = clean_query

    results = [] # Единый список результатов

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_INTERNAL_URL}/search/", params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    memes = data.get("memes", [])
                    
                    if not API_PUBLIC_URL:
                        logger.warning("⚠️ API_PUBLIC_URL is not set!")

                    for meme in memes:
                        meme_id = str(meme.get("id"))
                        title = meme.get("title", "Meme")
                        shares = meme.get("shares_count", 0)
                        
                        media_path = meme.get('media_url', '')
                        thumb_path = meme.get('thumbnail_url', '')
                        
                        # Формируем полные ссылки (HTTPS обязательно для Telegram)
                        media_url = media_path if media_path.startswith("http") else f"{API_PUBLIC_URL}{media_path}"
                        thumb_url = thumb_path if thumb_path.startswith("http") else f"{API_PUBLIC_URL}{thumb_path}"
                        
                        width = meme.get("width")
                        height = meme.get("height")
                        duration = int(meme.get("duration", 0) or 0)
                        
                        ext = media_path.split('.')[-1].lower()
                        
                        # --- ЛОГИКА ОТОБРАЖЕНИЯ ---
                        # Добавляем ВСЁ в один список results
                        
                        if ext in ['jpg', 'jpeg', 'png', 'webp']:
                            # Картинка
                            results.append(InlineQueryResultPhoto(
                                id=meme_id, 
                                photo_url=media_url, 
                                thumbnail_url=thumb_url,
                                title=title, 
                                photo_width=width, 
                                photo_height=height
                            ))
                        
                        elif ext == 'gif':
                            # GIF
                            results.append(InlineQueryResultGif(
                                id=meme_id, 
                                gif_url=media_url, 
                                thumbnail_url=thumb_url,
                                title=f"🎞 {title}", 
                                gif_width=width, 
                                gif_height=height
                            ))
                        
                        else: 
                            # Видео (MP4)
                            # Telegram требует thumbnail_url для видео. Если его нет — используем заглушку или пропускаем
                            if not thumb_path:
                                # Можно использовать логотип бота или что-то дефолтное, если нет превью
                                # Но лучше попытаться показать хотя бы что-то
                                pass 
                            
                            tags = meme.get('tags', [])
                            tag_str = ""
                            if tags:
                                # Обработка разных форматов тегов (строки или объекты)
                                tag_names = [t.get('name', '') if isinstance(t, dict) else str(t) for t in tags[:3]]
                                tag_str = " ".join([f"#{t}" for t in tag_names if t])
                            
                            description = f"🔥 {shares} | {tag_str}"

                            results.append(InlineQueryResultVideo(
                                id=meme_id, 
                                video_url=media_url, 
                                mime_type="video/mp4",
                                thumbnail_url=thumb_url, 
                                title=f"📹 {title}",
                                description=description,
                                video_width=width, 
                                video_height=height,
                                video_duration=duration
                            ))

                    # Отправляем ВСЕ результаты сразу
                    # cache_time=1 ставим для тестов, чтобы не кешировалось надолго
                    await update.inline_query.answer(results, cache_time=1)
                else:
                    logger.error(f"Search API returned {resp.status}")
                    
    except Exception as e:
        logger.error(f"Inline error: {e}")

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
    ensure_bot_user_exists()
    
    app = ApplicationBuilder().token(TOKEN).build()
    
    upload_handler = ConversationHandler(
        entry_points=[CommandHandler("upload", upload_start)],
        states={
            UPLOAD_MEDIA: [
                # 🔥 ПРИНИМАЕМ ВСЁ: Фото, Видео, Анимации и любые Документы
                MessageHandler(filters.PHOTO | filters.VIDEO | filters.ANIMATION | filters.Document.ALL, handle_media)
            ],
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
    
    app.add_handler(InlineQueryHandler(inline_query))
    app.add_handler(ChosenInlineResultHandler(on_chosen_result))
    
    print(f"🤖 Бот запущен! Пользователь бота: {BOT_USERNAME}")
    app.run_polling()