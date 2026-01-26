FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные пакеты (ffmpeg и gcc для сборки psycopg2)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000