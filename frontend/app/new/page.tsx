import React from "react";
import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { InfiniteMemeGrid } from "@/components/infinite-meme-grid";

export const metadata: Metadata = {
  title: "Свежие мемы",
  description: "Самые новые мемы на MemeHUB. Смотрите свежий контент первыми.",
  openGraph: {
    title: "Свежие мемы",
    description: "Самые новые мемы на MemeHUB.",
  },
};

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getNewMemes() {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?limit=20&sort=new`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

export default async function NewMemesPage() {
  const initialMemes = await getNewMemes();

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="p-3 bg-blue-500/10 rounded-full">
            <RefreshCw className="w-6 h-6 text-blue-500" />
        </div>
        <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Свежие мемы</h1>
            <p className="text-muted-foreground">Самый свежий контент</p>
        </div>
      </div>

      <InfiniteMemeGrid
        fetchUrl="/api/v1/memes/?sort=new"
        initialItems={initialMemes}
        limit={20}
      />
    </div>
  );
}
