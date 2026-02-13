"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfiniteMemeGrid } from "@/components/infinite-meme-grid";

interface ProfileMemeTabsProps {
  username: string;
  initialMemes: any[];
  initialFavorites: any[];
}

export function ProfileMemeTabs({ username, initialMemes, initialFavorites }: ProfileMemeTabsProps) {
  return (
    <Tabs defaultValue="memes" className="w-full">
      <TabsList>
        <TabsTrigger value="memes">Публикации</TabsTrigger>
        <TabsTrigger value="favorites">Избранное</TabsTrigger>
      </TabsList>

      <TabsContent value="memes" forceMount className="mt-6 data-[state=inactive]:hidden">
        <InfiniteMemeGrid
          fetchUrl={`/api/v1/memes/?username=${username}`}
          initialItems={initialMemes}
          limit={20}
        />
      </TabsContent>

      <TabsContent value="favorites" forceMount className="mt-6 data-[state=inactive]:hidden">
        <InfiniteMemeGrid
          fetchUrl={`/api/v1/memes/?liked_by=${username}`}
          initialItems={initialFavorites}
          limit={20}
        />
      </TabsContent>
    </Tabs>
  );
}
