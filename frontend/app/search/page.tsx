import React from "react";
import Link from "next/link";
import { Hash, User, Search as SearchIcon, Image as ImageIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

const API_URL = "http://127.0.0.1:8000";

async function searchData(query: string) {
  if (!query) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/search/?q=${query}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams;
  const data = await searchData(q);

  if (!q) {
    return <div className="container py-20 text-center text-muted-foreground">Введите запрос для поиска</div>;
  }

  if (!data) {
    return <div className="container py-20 text-center text-muted-foreground">Ошибка поиска или ничего не найдено</div>;
  }

  const { memes, users, tags, subjects } = data;
  const isEmpty = memes.length === 0 && users.length === 0 && tags.length === 0 && subjects.length === 0;

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <SearchIcon className="w-6 h-6" /> Результаты для "{q}"
      </h1>

      {isEmpty ? (
        <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
            Ничего не найдено 🕵️‍♂️
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6">
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="memes">Мемы ({memes.length})</TabsTrigger>
                <TabsTrigger value="users">Люди ({users.length})</TabsTrigger>
                <TabsTrigger value="tags">Теги ({tags.length})</TabsTrigger>
            </TabsList>

            {/* Вкладка ВСЕ */}
            <TabsContent value="all" className="space-y-8">
                
                {/* Люди */}
                {users.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><User className="w-4 h-4"/> Люди</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {users.map((user: any) => (
                                <Link href={`/user/${user.username}`} key={user.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <Avatar>
                                        <AvatarImage src={user.avatar_url ? `${API_URL}${user.avatar_url}` : undefined} />
                                        <AvatarFallback>{user.username[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="overflow-hidden">
                                        <div className="font-semibold truncate">{user.full_name || `@${user.username}`}</div>
                                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Теги */}
                {tags.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Hash className="w-4 h-4"/> Теги</h2>
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag: any) => (
                                <Link href={`/tag/${tag.name}`} key={tag.name} className="px-3 py-1 bg-secondary rounded-full text-sm hover:bg-primary hover:text-white transition-colors">
                                    #{tag.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Мемы (показываем как список или мини-плитку) */}
                {memes.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Мемы</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {memes.map((meme: any) => (
                                <Link href={`/meme/${meme.id}`} key={meme.id} className="group relative aspect-video bg-black rounded-lg overflow-hidden">
                                    <img 
                                        src={meme.thumbnail_url.startsWith('http') ? meme.thumbnail_url : `${API_URL}${meme.thumbnail_url}`} 
                                        alt={meme.title} 
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white text-xs font-bold truncate">{meme.title}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="memes">
                 {/* Здесь можно продублировать Grid с мемами, как на главной */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {memes.map((meme: any) => (
                        <Link href={`/meme/${meme.id}`} key={meme.id} className="block">
                             {/* Можно переиспользовать MemeCard, но для простоты тут свой код */}
                             <div className="border rounded-xl overflow-hidden bg-card hover:shadow-lg transition-shadow">
                                <img src={`${API_URL}${meme.thumbnail_url}`} className="w-full aspect-video object-cover" />
                                <div className="p-3">
                                    <h3 className="font-bold truncate">{meme.title}</h3>
                                </div>
                             </div>
                        </Link>
                    ))}
                 </div>
            </TabsContent>
            
            {/* Остальные табы можно заполнить аналогично */}
        </Tabs>
      )}
    </div>
  );
}