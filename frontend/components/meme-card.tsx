"use client";

import React from "react";
import Link from "next/link";
import { Play, Heart, MessageCircle, Volume2, Image as ImageIcon, FileVideo } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface MemeCardProps {
  meme: any;
}

export function MemeCard({ meme }: MemeCardProps) {
  // Определяем превью
  const preview = meme.thumbnail_url.startsWith('http') 
    ? meme.thumbnail_url 
    : `${API_URL}${meme.thumbnail_url}`;

  // --- ЛОГИКА ТИПОВ ---
  // 1. duration > 0.1 значит это видео-файл (mp4/webm).
  const isVideoFile = meme.duration > 0.1;
  
  // 2. Если это видео-файл, но нет звука -> считаем GIF.
  const isGif = isVideoFile && !meme.has_audio;
  
  // 3. Если это видео-файл и есть звук -> Полноценное видео.
  const isRealVideo = isVideoFile && meme.has_audio;

  // Форматирование времени (только для видео со звуком)
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Link href={`/meme/${meme.id}`} className="block break-inside-avoid mb-4">
      <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
        
        {/* Медиа (Картинка) */}
        <div className="w-full relative">
            <img 
                src={preview} 
                alt={meme.title} 
                className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 min-h-[100px]" 
                loading="lazy"
            />
            
            {/* --- ОВЕРЛЕИ --- */}

            {/* 1. ВИДЕО СО ЗВУКОМ */}
            {isRealVideo && (
                <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300 border border-white/20">
                            <Play className="w-8 h-8 text-white fill-white ml-1" />
                        </div>
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <Volume2 className="w-3 h-3 text-white" />
                    </div>
                    <Badge className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/70 text-white text-[10px] border-0 px-1.5 h-5">
                        {formatDuration(meme.duration)}
                    </Badge>
                </>
            )}

            {/* 2. GIF (Видео без звука) */}
            {isGif && (
                 <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70 border-0 font-bold tracking-wider text-[9px] px-1.5 py-0.5 h-5 backdrop-blur-md">
                        GIF
                    </Badge>
                 </div>
            )}

            {/* 3. ОБЫЧНАЯ КАРТИНКА (Не видео файл) */}
            {!isVideoFile && (
                 <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <ImageIcon className="w-3 h-3 text-white" />
                 </div>
            )}
        </div>

        {/* Инфо (ваш оригинальный градиент) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 drop-shadow-md">
                {meme.title}
            </h3>
            <div className="flex items-center justify-between mt-3 text-white/80">
                <div className="text-xs font-medium">{meme.views_count} просмотров</div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Heart className="w-4 h-4" /> <span className="text-xs font-bold">{meme.likes_count}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" /> <span className="text-xs font-bold">{meme.comments_count}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </Link>
  );
}