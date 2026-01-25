import React from "react";
import Link from "next/link";
import { RefreshCw, Play, Heart, MessageCircle, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API_URL = "http://127.0.0.1:8000";

async function getNewMemes() {
  try {
    // Сортировка по умолчанию (new)
    const res = await fetch(`${API_URL}/api/v1/memes/?limit=50&sort=new`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

export default async function NewMemesPage() {
  const memes = await getNewMemes();

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <RefreshCw className="w-8 h-8 text-blue-500" /> Свежие мемы
      </h1>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {memes.map((meme: any) => {
            const preview = meme.thumbnail_url.startsWith('http') ? meme.thumbnail_url : `${API_URL}${meme.thumbnail_url}`;
            return (
            <Link href={`/meme/${meme.id}`} key={meme.id} className="block break-inside-avoid">
                <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
                    <div className="w-full relative">
                        <img src={preview} alt={meme.title} className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 min-h-[150px]" loading="lazy"/>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/30 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300">
                                <Play className="w-8 h-8 text-white fill-white" />
                            </div>
                        </div>
                        <Badge className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/70 text-white text-[10px] border-0">
                            {meme.duration ? Math.round(meme.duration) + "s" : "GIF"}
                        </Badge>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 drop-shadow-md">{meme.title}</h3>
                        <div className="flex items-center justify-between mt-3 text-white/80">
                            <div className="text-xs">{meme.views_count} просмотров</div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1"><Heart className="w-4 h-4" /> <span className="text-xs">{meme.likes_count}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
            );
        })}
      </div>
    </div>
  );
}