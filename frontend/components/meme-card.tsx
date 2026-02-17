"use client";

import React from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Volume2,
  Image as ImageIcon,
  Film,
  Play
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// 1. Адрес для отображения (через прокси Next.js или прямой)
const DISPLAY_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface MemeCardProps {
  meme: any;
}

export function MemeCard({ meme }: MemeCardProps) {
  // Формируем правильную ссылку на медиа и превью
  const mediaUrl = meme.media_url.startsWith("http") 
    ? meme.media_url 
    : `${DISPLAY_API_URL}${meme.media_url}`;

  const thumbUrl = meme.thumbnail_url
    ? (meme.thumbnail_url.startsWith("http") ? meme.thumbnail_url : `${DISPLAY_API_URL}${meme.thumbnail_url}`)
    : mediaUrl; // Если превью нет, пробуем оригинал (для картинок)

  // WebM preview для видео в grid (вместо полного MP4)
  const previewUrl = meme.preview_url
    ? (meme.preview_url.startsWith("http") ? meme.preview_url : `${DISPLAY_API_URL}${meme.preview_url}`)
    : null;

  // Получаем расширение файла
  const ext = meme.media_url.split('.').pop()?.toLowerCase();

  // Определяем технический тип для выбора тега (video или img)
  const isMp4Format = ext === "mp4" || ext === "webm" || ext === "mov";

  // --- ЛОГИКА ОПРЕДЕЛЕНИЯ ИКОНКИ ---
  const getTypeIcon = () => {
    // 1. Это GIF (настоящий gif файл)
    if (ext === "gif") {
        return <span className="text-[10px] font-bold leading-none text-white tracking-widest">GIF</span>;
    }

    // 2. Это WebP (Анимированный)
    // Бэкенд ставит duration=1.0 для анимированных webp, и 0 для статики
    if (ext === "webp" && meme.duration > 0) {
        return <span className="text-[10px] font-bold leading-none text-white tracking-widest">ANIM</span>;
    }

    // 3. Это Видео (MP4/WebM)
    if (isMp4Format) {
      if (meme.has_audio) {
        return <Volume2 className="w-3 h-3 text-white" />; // Видео со звуком
      }
      // Видео без звука (или сконвертированный gif)
      return <Film className="w-3 h-3 text-white" />; 
    }

    // 4. Обычная картинка (jpg, png, статичный webp)
    return <ImageIcon className="w-3 h-3 text-white" />;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Link href={`/meme/${meme.id}`} className="block">
      <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
        
        <div
            className="w-full relative bg-muted/10"
            style={meme.width && meme.height ? { aspectRatio: `${meme.width}/${meme.height}` } : { minHeight: 100 }}
        >
            {isMp4Format ? (
                <video
                    src={previewUrl || mediaUrl}
                    poster={thumbUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    style={{ pointerEvents: 'none' }}
                />
            ) : (
                <img
                    src={thumbUrl}
                    alt={meme.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            )}
            
            {/* --- ОВЕРЛЕИ --- */}

            {/* Бейдж типа контента (Верхний правый угол) */}
            <div className="absolute top-2 right-2 z-20">
               <Badge variant="secondary" className="bg-black/60 hover:bg-black/70 backdrop-blur-sm border-0 px-2 py-1 h-6 flex items-center justify-center">
                  {getTypeIcon()}
               </Badge>
            </div>

            {/* Длительность (только для видео со звуком) */}
            {isMp4Format && meme.has_audio && (
                <Badge className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/70 text-white text-[10px] border-0 px-1.5 h-5 z-20">
                    {formatDuration(meme.duration)}
                </Badge>
            )}

            {/* Иконка Play по центру (только для видео, появляется при наведении) */}
            {isMp4Format && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                   <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
                </div>
              </div>
            )}
        </div>

        {/* Инфо (градиент снизу) */}
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

const SKELETON_HEIGHTS = [200, 280, 180, 320, 240, 260];

export function MemeCardSkeleton({ index = 0 }: { index?: number }) {
  const height = SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length];
  return (
    <div className="rounded-xl overflow-hidden bg-stone-900 border border-border/50">
      <Skeleton className="w-full bg-muted/20" style={{ height }} />
    </div>
  );
}