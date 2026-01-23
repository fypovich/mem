"use client";

import React, { use } from "react";
import { Flame, Sparkles, Gamepad2, Tv, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemeCard } from "@/components/meme-card";

// Обновленные данные с реальными GIF для категорий
const CATEGORY_MEMES = [
  { 
    id: 201, 
    title: "Эпичный момент в CS2", 
    author: "s1mple_fan", 
    views: "120k", 
    height: "h-56", 
    preview: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXExdTNwOTdpMDY4M2NlbDl0eDk1NDRpZ3VpcjF4eGZsb3d2Y2xleSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dilBP4FslWpm8/giphy.gif" // Gaming gif
  },
  { 
    id: 202, 
    title: "Баг в Cyberpunk", 
    author: "cd_projekt", 
    views: "3m", 
    height: "h-72", 
    preview: "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWFneTZlem5lYWI4cDVzbjZueW01aGp0a25mejhjM3Mzano4ZjgzMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KEf7gXqvQ8B3SWnUid/giphy.gif" // Keanu
  },
  { 
    id: 203, 
    title: "Спидран по Minecraft", 
    author: "dream", 
    views: "500k", 
    height: "h-64", 
    preview: "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTQ4MDM5Y2Y0aGJxZXBxcTQzejBubjd3eTc1MWh1eGZtNWx6cGhtaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ytu2GUYbvhz7zShGwS/giphy.gif" // Minecraft
  },
  { 
    id: 204, 
    title: "Dota 2 Rampage", 
    author: "pudge", 
    views: "12k", 
    height: "h-48", 
    preview: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXMydWI2ejdzaGdnbnVqNWZvM2pvcmRpOTRxNnRlZzkxMWJvZ21lbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KmXKSyoulpBXuu2Cx2/giphy.gif" // Dota
  },
  { 
    id: 205, 
    title: "GTA 6 Trailer reaction", 
    author: "rockstar", 
    views: "10m", 
    height: "h-80", 
    preview: "https://media.giphy.com/media/0Wzkc9iirQ4ZI7JoaD/giphy.gif" // GTA
  },
  { 
    id: 206, 
    title: "Ведьмак танцует", 
    author: "geralt", 
    views: "45k", 
    height: "h-60", 
    preview: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHk4ejU1M2pubWh2NjA5cGFwdTZoZmtkb20xOHlqZmEybXdhMjllMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7budMRwZvNGJ3pyE/giphy.gif" // Witcher
  },
];

// Хелпер для получения иконки и цвета по слагу
const getCategoryMeta = (slug: string) => {
  switch (slug) {
    case "gaming": return { icon: <Gamepad2 className="w-12 h-12" />, name: "Игры", color: "from-purple-600 to-blue-600" };
    case "anime": return { icon: <Sparkles className="w-12 h-12" />, name: "Аниме", color: "from-pink-500 to-rose-500" };
    case "movies": return { icon: <Film className="w-12 h-12" />, name: "Фильмы и Сериалы", color: "from-amber-500 to-red-600" };
    default: return { icon: <Flame className="w-12 h-12" />, name: slug, color: "from-gray-700 to-gray-900" };
  }
};

type Params = Promise<{ slug: string }>;

export default function CategoryPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const meta = getCategoryMeta(slug);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Категории */}
      <div className={`w-full py-16 bg-gradient-to-r ${meta.color} text-white`}>
        <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center text-center">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-full mb-4 shadow-xl">
                {meta.icon}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 uppercase">{meta.name}</h1>
            <p className="text-lg opacity-90 max-w-2xl">
              Лучшие мемы, хайлайты и приколы из категории {meta.name}.
            </p>
            <div className="mt-6 flex gap-3">
               <Button variant="secondary" className="font-bold">Подписаться</Button>
               <Button variant="outline" className="text-white border-white hover:bg-white/20">Поделиться</Button>
            </div>
        </div>
      </div>

      {/* Контент */}
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Популярное за неделю</h2>
            <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-muted-foreground">Новые</Button>
                <Button variant="secondary" size="sm">Топ</Button>
            </div>
        </div>

        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {CATEGORY_MEMES.map(meme => (
                <MemeCard key={meme.id} meme={meme} />
            ))}
        </div>
      </div>
    </div>
  );
}