FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости
# fonts-liberation - нужен для StickerService (наложение текста)
# curl - нужен для healthcheck в docker-compose
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    libglib2.0-0 \
    imagemagick \
    ghostscript \
    fonts-dejavu \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Исправление политики ImageMagick для MoviePy (разрешаем TextClip)
RUN find /etc -name "policy.xml" -exec sed -i 's/none/read,write/g' {} +

# Переменные окружения
# OMP_NUM_THREADS=1 критически важен для rembg на CPU внутри Docker/Celery
ENV OMP_NUM_THREADS=1
ENV MOVIEPY_ENV="docker"
ENV PYTHONUNBUFFERED=1

# Установка зависимостей Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads