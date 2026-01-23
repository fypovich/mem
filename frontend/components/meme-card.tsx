"use client";

import Link from "next/link";
import { Play, Volume2, Heart, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface MemeProps {
  id: number | string;
  title: string;
  author: string;
  views: string;
  height: string; // Tailwind class (например h-64)
  preview: string; // Ссылка на картинку/gif
}

export function MemeCard({ meme }: { meme: MemeProps }) {
  return (
    <Link href={`/meme/${meme.id}`} className="block break-inside-avoid mb-4">
      <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
        
        {/* Container */}
        <div className={`${meme.height} w-full relative`}>
          {/* REAL IMAGE / GIF */}
          <img 
            src={meme.preview} 
            alt={meme.title} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
            loading="lazy"
          />

          {/* Icon overlay (Play button) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="bg-black/30 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300">
                <Play className="w-8 h-8 text-white fill-white" />
             </div>
          </div>
          
          <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <Volume2 className="w-3 h-3 text-white" />
          </div>
          
          <Badge className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/70 text-[10px] border-0">
              0:14
          </Badge>
        </div>

        {/* Info Overlay (Gradient) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-md mb-2">
            {meme.title}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 border border-white/20">
                <AvatarFallback className="text-[8px] bg-primary text-white">
                  {meme.author[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-white/90 font-medium hover:underline truncate max-w-[80px]">
                @{meme.author}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-white/80">
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                <span className="text-[10px] font-bold">420</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}