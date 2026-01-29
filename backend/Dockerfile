FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости
# libgl1-mesa-glx заменен на libgl1 и libglib2.0-0 для новых версий Debian
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код
COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads

# Указываем переменную для ImageMagick
ENV MOVIEPY_ENV="docker"