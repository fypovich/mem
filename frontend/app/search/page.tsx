"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hash, User, Search as SearchIcon, Image as ImageIcon, Grid, Layers } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemeGrid } from "@/components/meme-grid";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || "";
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q) {
        fetchData(q);
    } else {
        setData(null); // Очищаем данные, если запрос пустой
    }
  }, [q]);

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

  const memes = data?.memes || [];
  const users = data?.users || [];
  const tags = data?.tags || [];
  
  const hasResults = memes.length > 0 || users.length > 0 || tags.length > 0;

  // 1. Состояние загрузки
  if (loading) {
      return (
           <div className="container py-20 text-center text-muted-foreground animate-pulse flex flex-col items-center">
               <SearchIcon className="w-12 h-12 mb-4 opacity-50" />
               <p>Ищем годноту...</p>
           </div>
      );
  }

  // 2. Состояние "Нет запроса" (Пользователь только зашел на страницу)
  if (!q) {
      return (
          <div className="text-center py-24 text-muted-foreground flex flex-col items-center">
              <SearchIcon className="w-16 h-16 mb-6 opacity-20" />
              <h2 className="text-xl font-semibold mb-2">Начните поиск</h2>
              <p>Введите запрос в строку поиска сверху, чтобы найти мемы, людей или теги.</p>
          </div>
      );
  }

  // 3. Состояние "Ничего не найдено"
  if (!hasResults && data) {
    return (
        <div className="text-center py-24 text-muted-foreground flex flex-col items-center">
             <Layers className="w-16 h-16 mb-6 opacity-20" />
             <h2 className="text-xl font-semibold mb-2">Ничего не найдено</h2>
             <p>По запросу «{q}» ничего нет. Попробуйте другие слова.</p>
        </div>
    );
  }

  // 4. Результаты
  return (
    <>
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 px-1">
             Результаты для <span className="text-primary">«{q}»</span>
        </h1>

        <Tabs defaultValue="all" className="w-full">
            {/* Стиль табов как в профиле */}
            <TabsList className="mb-6 w-full justify-start overflow-x-auto bg-transparent p-0 gap-6 border-b rounded-none h-auto">
                <TabsTrigger 
                    value="all"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base"
                >
                    Все
                </TabsTrigger>
                {memes.length > 0 && (
                    <TabsTrigger 
                        value="memes"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base"
                    >
                        Мемы ({memes.length})
                    </TabsTrigger>
                )}
                {users.length > 0 && (
                    <TabsTrigger 
                        value="users"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base"
                    >
                        Люди ({users.length})
                    </TabsTrigger>
                )}
                {tags.length > 0 && (
                    <TabsTrigger 
                        value="tags"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 text-base"
                    >
                        Теги ({tags.length})
                    </TabsTrigger>
                )}
            </TabsList>

            <div className="min-h-[300px]">
                {/* Вкладка ВСЕ */}
                <TabsContent value="all" className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    
                    {/* Люди (Превью 6 шт) */}
                    {users.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                                <User className="w-5 h-5"/> Люди
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {users.slice(0, 6).map((user: any) => (
                                    <UserCard key={user.id} user={user} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Теги */}
                    {tags.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                                <Hash className="w-5 h-5"/> Теги
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag: any) => (
                                    <TagCard key={tag.id} tag={tag} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Мемы */}
                    {memes.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                                <ImageIcon className="w-5 h-5"/> Мемы
                            </h2>
                            <MemeGrid items={memes} />
                        </div>
                    )}
                </TabsContent>

                {/* Отдельные вкладки */}
                <TabsContent value="memes">
                     <MemeGrid items={memes} />
                </TabsContent>
                
                <TabsContent value="users">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map((user: any) => (
                            <UserCard key={user.id} user={user} />
                        ))}
                    </div>
                </TabsContent>

                 <TabsContent value="tags">
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag: any) => (
                            <TagCard key={tag.id} tag={tag} />
                        ))}
                    </div>
                </TabsContent>
            </div>
        </Tabs>
    </>
  );
}

// Вспомогательные компоненты для чистоты кода
const UserCard = ({ user }: { user: any }) => (
    <Link href={`/user/${user.username}`} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors group">
        <Avatar className="w-12 h-12 border border-border group-hover:border-primary transition-colors">
            <AvatarImage src={user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${API_URL}${user.avatar_url}`) : undefined} className="object-cover" />
            <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="overflow-hidden">
            <div className="font-bold truncate group-hover:text-primary transition-colors">
                {user.full_name || `@${user.username}`}
            </div>
            <div className="text-sm text-muted-foreground">@{user.username}</div>
        </div>
    </Link>
);

const TagCard = ({ tag }: { tag: any }) => (
    <Link href={`/tag/${tag.name}`} className="px-4 py-2 bg-secondary/50 border rounded-full text-sm hover:bg-primary hover:text-white transition-all">
        #{tag.name}
    </Link>
);

export default function SearchPage() {
  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <Suspense fallback={<div className="container py-20 text-center text-muted-foreground">Загрузка поиска...</div>}>
        <SearchContent />
      </Suspense>
    </div>
  );
}