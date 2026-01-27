FROM python:3.11-slim

WORKDIR /app

# Обновляем pip и ставим зависимости принудительно
RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "bot.py"]