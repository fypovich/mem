# Используем Node.js (Alpine версия легче)
FROM node:18-alpine

# Рабочая директория
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем в режиме разработки
CMD ["npm", "run", "dev"]