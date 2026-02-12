import React from "react";
import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { InfiniteMemeGrid } from "@/components/infinite-meme-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "В тренде",
  description: "Самые популярные мемы за неделю на MemeHUB. Топ мемов, которые набирают просмотры и лайки.",
  openGraph: {
    title: "В тренде",
    description: "Самые популярные мемы за неделю на MemeHUB.",
  },
};

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getTrendingMemes() {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?sort=popular&period=week&limit=20`, {
        cache: "no-store"
    });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    console.error("Trending fetch error:", e);
    return [];
  }
}

export default async function TrendingPage() {
  const initialMemes = await getTrendingMemes();

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="p-3 bg-orange-500/10 rounded-full">
            <Flame className="w-6 h-6 text-orange-500" />
        </div>
        <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">В тренде</h1>
            <p className="text-muted-foreground">Самое популярное за неделю</p>
        </div>
      </div>

      <InfiniteMemeGrid
        fetchUrl="/api/v1/memes/?sort=popular&period=week"
        initialItems={initialMemes}
        limit={20}
      />
    </div>
  );
}
