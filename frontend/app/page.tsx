"use client";

import React, { useState } from "react";
import { Flame, Sparkles, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfiniteMemeGrid } from "@/components/infinite-meme-grid";
import { useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { token } = useAuth();
  const [sort, setSort] = useState("smart");

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1">Лента</h1>
            <p className="text-muted-foreground text-sm">Главные мемы дня</p>
          </div>

          <Tabs value={sort} onValueChange={setSort} className="w-full md:w-auto">
            <TabsList className="grid w-full md:w-[360px] grid-cols-3">
              <TabsTrigger value="smart">
                <Sparkles className="w-4 h-4 mr-2" />
                Для вас
              </TabsTrigger>
              <TabsTrigger value="popular">
                <Flame className="w-4 h-4 mr-2" />
                Топ
              </TabsTrigger>
              <TabsTrigger value="new">
                <Clock className="w-4 h-4 mr-2" />
                Новое
              </TabsTrigger>
            </TabsList>
          </Tabs>
      </div>

      <InfiniteMemeGrid
        key={sort}
        fetchUrl={`/api/v1/memes/?sort=${sort}`}
        limit={20}
        token={token}
      />
    </div>
  );
}
