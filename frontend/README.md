# MemeGiphy (Project Vibe)

Централизованная платформа для хостинга, поиска и создания коротких зацикленных видео-мемов (аналог Giphy, но с фокусом на видео со звуком).

## 🛠 Технический Стек

### Core
- **Frontend:** Next.js 14+ (App Router), React, TypeScript.
- **Styling:** Tailwind CSS, Lucide React (icons), Shadcn/UI (components).
- **Backend:** Python 3.11+, FastAPI.
- **Database:** PostgreSQL (via Supabase).
- **Auth:** Supabase Auth.
- **Storage:** Supabase Storage (S3 compatible) или MinIO (local dev).
- **Search Engine:** Meilisearch (синхронизация данных из PG).
- **Video Processing:** FFmpeg (через `ffmpeg-python`).

### External Integrations
- **Telegram Bot API:** (aiogram) - Inline mode для поиска мемов.
- **Discord Bot:** (discord.py или просто генерация oEmbed мета-тегов для превью).

---

## 🏗 Архитектура Данных (Database Schema)

Все таблицы должны быть в схеме `public`. Используем `SQLAlchemy` или чистый SQL для миграций.

### 1. `users` (Managed by Supabase Auth, mirrored in public)
- `id`: uuid (PK)
- `username`: string (unique)
- `avatar_url`: string
- `created_at`: timestamp

### 2. `memes`
- `id`: uuid (PK)
- `user_id`: uuid (FK -> users.id)
- `title`: string (max 100)
- `description`: text
- `media_url`: string (путь к финальному .mp4 файлу)
- `thumbnail_url`: string (путь к .jpg превью)
- `original_audio_url`: string (опционально, если звук накладывался отдельно)
- `duration`: float (секунды)
- `width`: int
- `height`: int
- `views_count`: int (default 0)
- `status`: enum ('pending', 'active', 'rejected') — для модерации
- `created_at`: timestamp

### 3. `subjects` (Персонажи/Объекты)
- `id`: int (PK)
- `name`: string (e.g., "Ryan Gosling", "Shrek")
- `slug`: string (unique)
- `image_url`: string (avatar for the subject)

### 4. `tags`
- `id`: int (PK)
- `name`: string (unique)

### 5. `meme_subjects` & `meme_tags` (Many-to-Many)
- Таблицы связей для нормализации.

### 6. `likes` & `comments`
- Стандартные социальные функции.

---

## 🚀 Основной Функционал (Features)

### 1. Upload Pipeline (The Core Logic)
Эндпоинт: `POST /api/upload`
Логика обработки медиа на Backend (FastAPI + FFmpeg):

**Сценарий А: Пользователь грузит Картинку + Аудио**
1. Картинка растягивается во времени под длительность аудио.
2. Конвертация в MP4 (H.264/AAC).

**Сценарий Б: Пользователь грузит GIF + Аудио**
1. GIF зацикливается (loop) до длительности аудио.
2. Конвертация в MP4.

**Сценарий В: Пользователь грузит Видео + Новое Аудио**
1. Из видео удаляется оригинальная дорожка.
2. Накладывается новая аудиодорожка.
3. Видео обрезается или зацикливается под длину наиболее короткого медиа (или по логике: приоритет длине аудио).

**Post-Processing:**
- Генерация `thumbnail` (первый кадр).
- Синхронизация данных с Meilisearch для поиска.

### 2. Лента и Просмотр
- **Masonry Grid:** Плитка, как на Pinterest/Giphy.
- **Hover behavior:** Видео проигрывается без звука при наведении мыши.
- **Single Page:** Плеер, кнопки "Like", "Share", блок комментариев, теги.

### 3. Поиск (Meilisearch)
- Поиск должен быть "typo-tolerant" (устойчив к опечаткам).
- Индексируемые поля: `title`, `description`, `tags`, `subject_name`.
- Фильтры: по дате, по популярности.

### 4. Интеграции с мессенджерами
- **Telegram:** Бот поддерживает `Inline Query`. Пользователь пишет `@bot gta 5` -> получает список видео -> кликает -> видео отправляется в чат.
- **Discord:** Страницы мемов должны иметь корректные OpenGraph теги (`og:video`, `og:video:type`, `og:image`), чтобы Discord разворачивал плеер прямо в чате.

---

## 📂 Структура Проекта (Monorepo-like)

```text
/
├── backend/
│   ├── app/
│   │   ├── api/            # Routes
│   │   ├── core/           # Config, Security
│   │   ├── services/       # FFmpeg logic, S3 uploaders
│   │   └── models/         # Pydantic & SQLAlchemy models
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── app/                # Next.js Pages
│   ├── components/         # Shadcn UI
│   ├── lib/                # API clients
│   └── public/
├── docker-compose.yml      # DB, Meilisearch, MinIO
└── README.md               # YOU ARE HERE