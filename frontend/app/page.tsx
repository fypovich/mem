import React from "react";
import Link from "next/link";
import { Flame, Sparkles, Gamepad2, Tv, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemeCard } from "@/components/meme-card";
import { Badge } from "@/components/ui/badge";

// Функция для получения данных
async function getMemes() {
  // Обращаемся к нашему API. 
  // В Docker/Prod здесь был бы внутренний адрес, но для локалки используем 127.0.0.1
  const res = await fetch('http://127.0.0.1:8000/api/v1/memes/?limit=20', { 
    cache: 'no-store' // Отключаем кэш, чтобы всегда видеть свежие мемы при загрузке
  });

  if (!res.ok) {
    // В реальном проекте здесь нужна обработка ошибок
    return [];
  }

  return res.json();
}

export default async function Home() {
  // Получаем мемы
  const memes = await getMemes();
  
  // Базовый URL для картинок
  const API_URL = "http://127.0.0.1:8000";

  return (
    <div className="min-h-screen bg-background">
      
      {/* Hero Section (оставляем без изменений) */}
      <section className="relative overflow-hidden border-b border-border/50">
         {/* ... (ваш код Hero секции) ... */}
         {/* Для краткости я его пропущу, он не меняется, но не удаляйте его! */}
         <div className="container px-4 py-16 md:py-24 mx-auto max-w-7xl text-center relative z-10">
            <Badge variant="secondary" className="mb-6 px-4 py-1 text-sm border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              ✨ Тренды 2024
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-stone-200 to-stone-500">
               Найди свой <br className="hidden md:block" />
               <span className="text-primary">идеальный мем</span>
            </h1>
         </div>
      </section>

      {/* Categories (оставляем без изменений) */}
      {/* ... */}

      {/* ЛЕНТА МЕМОВ */}
      <div className="container px-4 py-12 mx-auto max-w-7xl">
         <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-2">
               <Flame className="w-6 h-6 text-orange-500 fill-orange-500" /> В тренде
            </h2>
            <div className="flex gap-2">
               <Button variant="secondary" size="sm">Сегодня</Button>
               <Button variant="ghost" size="sm" className="text-muted-foreground">За неделю</Button>
            </div>
         </div>

         {/* Masonry Grid */}
         <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {memes.length > 0 ? (
                memes.map((meme: any) => (
                   <MemeCard 
                      key={meme.id} 
                      meme={{
                        ...meme,
                        // Нам нужно приклеить домен к путям (они приходят как /static/...)
                        preview: meme.thumbnail_url.startsWith('http') 
                                 ? meme.thumbnail_url 
                                 : `${API_URL}${meme.thumbnail_url}`,
                        author: meme.user.username,
                        views: meme.views_count.toString() || "0",
                        // Высоту можно рассчитывать динамически или оставить дефолт
                        height: "h-auto" 
                      }} 
                   />
                ))
            ) : (
                <div className="col-span-full text-center py-20 text-muted-foreground">
                    Пока нет мемов. Будьте первым! 🚀
                </div>
            )}
         </div>
         
         <div className="mt-12 flex justify-center">
            <Button size="lg" variant="outline" className="min-w-[200px]">Загрузить еще</Button>
         </div>
      </div>

    </div>
  );
}