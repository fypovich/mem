FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные утилиты: ffmpeg, компилятор gcc и libpq для Postgres
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000