"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Hash, User, Search as SearchIcon, Image as ImageIcon, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input"; 
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const MemeGridItem = ({ meme }: { meme: any }) => {
    const preview = meme.thumbnail_url.startsWith('http') ? meme.thumbnail_url : `${API_URL}${meme.thumbnail_url}`;
    const isVideo = meme.media_url.endsWith('.mp4') || meme.media_url.endsWith('.webm');

    return (
        <Link href={`/meme/${meme.id}`} className="block break-inside-avoid mb-4">
            <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
                <div className="w-full relative min-h-[150px]">
                    <img 
                        src={preview} 
                        alt={meme.title} 
                        className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" 
                        loading="lazy"
                    />
                    
                    {isVideo && (
                        <div className="absolute top-2 right-2">
                             <Badge variant="secondary" className="bg-black/60 hover:bg-black/70 backdrop-blur-sm border-0 px-1.5 py-0.5 h-5">
                                 <Play className="w-3 h-3 text-white" />
                             </Badge>
                        </div>
                    )}

                    {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/40 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 drop-shadow-md">
                        {meme.title}
                    </h3>
                </div>
            </div>
        </Link>
    );
};

// 1. ВЫНОСИМ ЛОГИКУ В ОТДЕЛЬНЫЙ КОМПОНЕНТ
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || "";
  
  const [q, setQ] = useState(initialQuery);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
        setQ(query); 
        fetchData(query);
    }
  }, [searchParams]);

  const fetchData = async (query: string) => {
    setLoading(true);
    try {
        const res = await fetch(`${API_URL}/api/v1/search/?q=${encodeURIComponent(query)}`);
        if (res.ok) {
            setData(await res.json());
        }
    } catch(e) { 
        console.error(e); 
    } finally { 
        setLoading(false); 
    }
  };

  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      if (q.trim()) {
          router.push(`/search?q=${encodeURIComponent(q)}`);
      }
  };

  const memes = data?.memes || [];
  const users = data?.users || [];
  const tags = data?.tags || [];
  
  const hasResults = memes.length > 0 || users.length > 0 || tags.length > 0;
  const isInitial = !data && !loading;

  return (
    <>
      <form onSubmit={handleSearch} className="mb-8 flex gap-2 max-w-xl mx-auto">
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Поиск мемов, людей, тегов..." 
            className="h-12 text-lg"
          />
          <Button type="submit" size="lg" className="h-12 px-6">
              <SearchIcon className="w-5 h-5" />
          </Button>
      </form>

      {loading && (
           <div className="container py-20 text-center text-muted-foreground animate-pulse">
               Ищем годноту... 🚀
           </div>
      )}

      {!loading && data && !hasResults && (
        <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
             Ничего не найдено 🕵️‍♂️
             <br/>Попробуйте другой запрос
        </div>
      )}
      
      {isInitial && !loading && (
          <div className="text-center py-20 text-muted-foreground">
              Введите запрос выше, чтобы начать поиск
          </div>
      )}

      {hasResults && (
        <>
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                 Результаты для <span className="text-primary">"{searchParams.get('q')}"</span>
            </h1>

            <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-8 w-full justify-start h-12 bg-transparent border-b rounded-none p-0 gap-6 overflow-x-auto">
                    <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base">Все</TabsTrigger>
                    {memes.length > 0 && <TabsTrigger value="memes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base">Мемы ({memes.length})</TabsTrigger>}
                    {users.length > 0 && <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base">Люди ({users.length})</TabsTrigger>}
                    {tags.length > 0 && <TabsTrigger value="tags" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base">Теги ({tags.length})</TabsTrigger>}
                </TabsList>

                <TabsContent value="all" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {users.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground"><User className="w-5 h-5"/> Люди</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {users.slice(0, 6).map((user: any) => (
                                    <Link href={`/user/${user.username}`} key={user.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors group">
                                        <Avatar className="w-12 h-12 border border-border group-hover:border-primary transition-colors">
                                            <AvatarImage src={user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`) : undefined} className="object-cover" />
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

                    {memes.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground"><ImageIcon className="w-5 h-5"/> Мемы</h2>
                            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                                {memes.map((meme: any) => (
                                    <MemeGridItem key={meme.id} meme={meme} />
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="memes">
                     <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        {memes.map((meme: any) => <MemeGridItem key={meme.id} meme={meme} />)}
                     </div>
                </TabsContent>
                
                <TabsContent value="users">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map((user: any) => (
                            <Link href={`/user/${user.username}`} key={user.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors">
                                <Avatar className="w-12 h-12 border">
                                    <AvatarImage src={user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`) : undefined} className="object-cover" />
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

                 <TabsContent value="tags">
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag: any) => (
                            <Link href={`/tag/${tag.name}`} key={tag.id} className="px-5 py-3 bg-secondary/50 border rounded-full text-base hover:bg-primary hover:text-white transition-all">
                                #{tag.name}
                            </Link>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </>
      )}
    </>
  );
}

// 2. ОБЯЗАТЕЛЬНО ОБРАЧИВАЕМ ОСНОВНОЙ КОМПОНЕНТ В SUSPENSE
export default function SearchPage() {
  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <Suspense fallback={<div className="container py-20 text-center text-muted-foreground">Загрузка поиска...</div>}>
        <SearchContent />
      </Suspense>
    </div>
  );
}