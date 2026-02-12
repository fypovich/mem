import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности MemeHUB. Как мы собираем, используем и защищаем ваши данные.",
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-3xl font-bold">Политика конфиденциальности</h1>
      <p className="text-muted-foreground">Последнее обновление: 26 января 2026</p>
      
      <div className="prose dark:prose-invert max-w-none">
        <p>Мы уважаем вашу конфиденциальность и обязуемся защищать вашу личную информацию.</p>
        <h3>1. Сбор данных</h3>
        <p>Мы собираем только те данные, которые необходимы для функционирования сервиса: email, имя пользователя и загруженный контент.</p>
        <h3>2. Использование данных</h3>
        <p>Данные используются для предоставления доступа к сервису, персонализации контента и отправки уведомлений.</p>
        <h3>3. Безопасность</h3>
        <p>Мы принимаем разумные меры для защиты ваших данных от несанкционированного доступа.</p>
      </div>
    </div>
  );
}