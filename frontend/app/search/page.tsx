"use client"; // Search часто клиентский

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hash, User, Search as SearchIcon, Image as ImageIcon, Play, Heart, MessageCircle, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const API_URL = "http://127.0.0.1:8000";

// Компонент карточки мема (как в профиле)
const MemeGridItem = ({ meme }: { meme: any }) => {
    const preview = meme.thumbnail_url.startsWith('http') ? meme.thumbnail_url : `${API_URL}${meme.thumbnail_url}`;
    return (
        <Link href={`/meme/${meme.id}`} className="block break-inside-avoid">
            <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
                <div className="w-full relative">
                    <img 
                        src={preview} 
                        alt={meme.title} 
                        className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 min-h-[150px]" 
                        loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/30 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300">
                            <Play className="w-8 h-8 text-white fill-white" />
                        </div>
                    </div>
                    {/* (Опционально) Длительность и звук, если есть в индексе */}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 drop-shadow-md">
                        {meme.title}
                    </h3>
                    {/* Если в Meilisearch вы не сохраняли likes_count, этот блок можно скрыть или показывать 0 */}
                </div>
            </div>
        </Link>
    );
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/search/?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                setData(await res.json());
            }
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };
    fetchData();
  }, [q]);

  if (!q) return <div className="container py-20 text-center text-muted-foreground">Введите запрос для поиска</div>;
  if (loading) return <div className="container py-20 text-center text-muted-foreground">Поиск... 🚀</div>;
  if (!data) return null;

  const { memes, users, tags } = data;
  const isEmpty = memes.length === 0 && users.length === 0 && tags.length === 0;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <SearchIcon className="w-8 h-8" /> Результаты для "{q}"
      </h1>

      {isEmpty ? (
        <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
            Ничего не найдено 🕵️‍♂️
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-8 w-full justify-start h-12 bg-transparent border-b rounded-none p-0 gap-8">
                <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 pb-3 text-base">Все</TabsTrigger>
                {memes.length > 0 && <TabsTrigger value="memes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 pb-3 text-base">Мемы ({memes.length})</TabsTrigger>}
                {users.length > 0 && <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 pb-3 text-base">Люди ({users.length})</TabsTrigger>}
            </TabsList>

            {/* Вкладка ВСЕ */}
            <TabsContent value="all" className="space-y-12">
                
                {/* Люди */}
                {users.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground"><User className="w-5 h-5"/> Люди</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {users.map((user: any) => (
                                <Link href={`/user/${user.username}`} key={user.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors group">
                                    <Avatar className="w-12 h-12">
                                        <AvatarImage src={user.avatar_url ? `${API_URL}${user.avatar_url}` : undefined} />
                                        <AvatarFallback>{user.username[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="overflow-hidden">
                                        <div className="font-bold truncate group-hover:text-primary transition-colors">{user.full_name || `@${user.username}`}</div>
                                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Теги */}
                {tags.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground"><Hash className="w-5 h-5"/> Теги</h2>
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag: any) => (
                                <Link href={`/tag/${tag.name}`} key={tag.id} className="px-4 py-2 bg-secondary/50 border rounded-full text-sm hover:bg-primary hover:text-white transition-all">
                                    #{tag.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Мемы */}
                {memes.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground"><ImageIcon className="w-5 h-5"/> Мемы</h2>
                        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                            {memes.map((meme: any) => (
                                <MemeGridItem key={meme.id} meme={meme} />
                            ))}
                        </div>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="memes">
                 <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                    {memes.map((meme: any) => <MemeGridItem key={meme.id} meme={meme} />)}
                 </div>
            </TabsContent>
            
            <TabsContent value="users">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.map((user: any) => (
                        <Link href={`/user/${user.username}`} key={user.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors">
                            <Avatar className="w-12 h-12">
                                <AvatarImage src={user.avatar_url ? `${API_URL}${user.avatar_url}` : undefined} />
                                <AvatarFallback>{user.username[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-bold">{user.full_name || `@${user.username}`}</div>
                                <div className="text-sm text-muted-foreground">@{user.username}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}