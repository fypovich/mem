FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости
# libgl1 вместо libgl1-mesa-glx (для новых версий Debian)
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
    && rm -rf /var/lib/apt/lists/*

# Исправление политики ImageMagick для разрешения обработки текста
# Используем find, чтобы найти policy.xml где бы он ни лежал
RUN find /etc -name "policy.xml" -exec sed -i 's/none/read,write/g' {} +

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads

# Указываем переменную окружения для MoviePy
ENV MOVIEPY_ENV="docker"