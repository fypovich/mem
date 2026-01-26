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
  // Определяем URL
  const mediaUrl = meme.media_url.startsWith('http') ? meme.media_url : `${API_URL}${meme.media_url}`;
  const thumbUrl = meme.thumbnail_url.startsWith('http') ? meme.thumbnail_url : `${API_URL}${meme.thumbnail_url}`;

  // --- ЛОГИКА ТИПОВ ---
  const isVideoFile = meme.duration > 0.1;
  const isGif = isVideoFile && !meme.has_audio;
  const isRealVideo = isVideoFile && meme.has_audio;
  
  // Является ли файл MP4 (нужен тег <video>) или картинкой (тег <img>)
  // Важно: для MP4-гифок мы хотим использовать <video>, чтобы они двигались
  const isMp4Format = meme.media_url.endsWith('.mp4');

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Link href={`/meme/${meme.id}`} className="block break-inside-avoid mb-4">
      <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
        
        <div className="w-full relative min-h-[100px] bg-muted/10">
            {/* ЕСЛИ ЭТО MP4 (даже без звука) -> Рендерим Video для "живого" превью 
               ЕСЛИ ЭТО GIF/WEBP -> Рендерим Img (они сами анимируются)
            */}
            {isMp4Format ? (
                <video
                    src={mediaUrl}
                    className="w-full h-auto object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                    // Отключаем controls, чтобы выглядело как гифка
                />
            ) : (
                <img 
                    // Для GIF используем thumbUrl, так как бэкенд копирует туда оригинал gif
                    // Для WebP тоже
                    src={thumbUrl} 
                    alt={meme.title} 
                    className="w-full h-auto object-cover"
                    loading="lazy"
                />
            )}
            
            {/* --- ОВЕРЛЕИ --- */}

            {/* 1. ВИДЕО СО ЗВУКОМ */}
            {isRealVideo && (
                <>
                    <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Volume2 className="w-3 h-3 text-white" />
                    </div>
                    <Badge className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/70 text-white text-[10px] border-0 px-1.5 h-5 z-10">
                        {formatDuration(meme.duration)}
                    </Badge>
                </>
            )}

            {/* 2. GIF (Видео без звука) */}
            {isGif && (
                 <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70 border-0 font-bold tracking-wider text-[9px] px-1.5 py-0.5 h-5 backdrop-blur-md">
                        GIF
                    </Badge>
                 </div>
            )}
        </div>

        {/* Инфо (градиент) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20">
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