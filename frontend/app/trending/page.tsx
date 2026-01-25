import React from "react";
import { Flame } from "lucide-react";
import { MemeGrid } from "@/components/meme-grid"; // <-- Импорт

const API_URL = "http://127.0.0.1:8000";

async function getTrendingMemes() {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?limit=50&sort=popular&period=week`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

export default async function TrendingPage() {
  const memes = await getTrendingMemes();

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Flame className="w-8 h-8 text-orange-500 fill-orange-500" /> Тренды недели
      </h1>

      <MemeGrid items={memes} />
    </div>
  );
}