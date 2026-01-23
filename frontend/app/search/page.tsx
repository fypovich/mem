"use client";

import React, { use } from "react";
import Link from "next/link";
import { Search, User, Grid, Frown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemeCard } from "@/components/meme-card";

// Моковые данные для поиска
const FOUND_MEMES = [
  { id: 1, title: "Когда код заработал", author: "dev_god", views: "12k", height: "h-64", color: "bg-emerald-800" },
  { id: 4, title: "CS2 Lag moment", author: "gamer_pro", views: "102k", height: "h-56", color: "bg-amber-700" },
];

const FOUND_USERS = [
  { username: "dev_god", followers: "12k", avatar: "DG" },
  { username: "coding_cat", followers: "5k", avatar: "CC" },
];

// В Next.js 15 searchParams это Promise
type Params = Promise<{ [key: string]: string | string[] | undefined }>;

export default function SearchPage({ searchParams }: { searchParams: Params }) {
  // Используем React.use() для распаковки параметров
  const resolvedParams = use(searchParams);
  const query = resolvedParams?.q || "";

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
            Результаты поиска: <span className="text-primary">"{query}"</span>
        </h1>
        <p className="text-muted-foreground">Найдено 142 результата</p>
      </div>

      <Tabs defaultValue="memes" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="memes" className="gap-2"><Grid className="w-4 h-4"/> Мемы</TabsTrigger>
          <TabsTrigger value="people" className="gap-2"><User className="w-4 h-4"/> Люли</TabsTrigger>
        </TabsList>

        <TabsContent value="memes">
          {FOUND_MEMES.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-4 gap-4 space-y-4">
                {FOUND_MEMES.map(meme => <MemeCard key={meme.id} meme={meme} />)}
                {/* Дублируем для вида */}
                {FOUND_MEMES.map(meme => <MemeCard key={meme.id + 'd'} meme={meme} />)}
            </div>
          ) : (
            <EmptyState />
          )}
        </TabsContent>

        <TabsContent value="people">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FOUND_USERS.map(user => (
                  <Link href={`/user/${user.username}`} key={user.username}>
                    <div className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback>{user.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="font-bold">@{user.username}</div>
                            <div className="text-sm text-muted-foreground">{user.followers} подписчиков</div>
                        </div>
                        <Button variant="outline" size="sm">Профиль</Button>
                    </div>
                  </Link>
              ))}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <Frown className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold">Ничего не найдено</h3>
            <p className="text-muted-foreground">Попробуйте изменить запрос или поискать по тегам</p>
        </div>
    )
}