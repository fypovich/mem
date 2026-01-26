import React from "react";
import Link from "next/link";
import { Play, Heart, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Meme {
  id: string;
  title: string;
  thumbnail_url: string;
  media_url: string;
  duration: number;
  has_audio: boolean; // <-- Новое поле
  likes_count: number;
  comments_count: number;
  views_count: number;
}

interface MemeCardProps {
  meme: Meme;
}

export function MemeCard({ meme }: MemeCardProps) {
  const thumbUrl = meme.thumbnail_url.startsWith("http") 
    ? meme.thumbnail_url 
    : `${API_URL}${meme.thumbnail_url}`;

  // ЛОГИКА ОТОБРАЖЕНИЯ БЕЙДЖЕЙ
  // 1. Если длительность > 0, но звука нет -> GIF
  // 2. Если длительность > 0 и есть звук -> Видео (тайминг)
  // 3. Иначе -> Картинка (ничего не пишем или IMG)
  
  const isVideoOrGif = meme.duration > 0.1;
  const isGif = isVideoOrGif && !meme.has_audio;

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Link href={`/meme/${meme.id}`} className="group block space-y-2">
      <div className="relative rounded-xl overflow-hidden aspect-[4/5] bg-muted">
        <img 
          src={thumbUrl} 
          alt={meme.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

        {/* БЕЙДЖИКИ */}
        {isVideoOrGif && (
            <div className="absolute top-2 right-2">
                {isGif ? (
                    <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70 border-0 font-bold tracking-wider text-[10px] px-1.5 py-0.5">
                        GIF
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70 border-0 flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                        <Play className="w-2 h-2 fill-current" />
                        {formatDuration(meme.duration)}
                    </Badge>
                )}
            </div>
        )}

        {/* Статистика при наведении */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-white text-xs">
           <div className="flex items-center gap-3 font-medium">
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 fill-current" /> {meme.likes_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 fill-current" /> {meme.comments_count}
              </span>
           </div>
        </div>
      </div>
      
      <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors px-1">
        {meme.title}
      </h3>
    </Link>
  );
}