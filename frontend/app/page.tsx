import React from "react";
import { Flame } from "lucide-react";
import { MemeGrid } from "@/components/meme-grid"; // <-- Используем нашу новую сетку

const API_URL = "http://127.0.0.1:8000";

async function getMemes() {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?limit=50`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

export default async function Home() {
  const memes = await getMemes();

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Баннер (по желанию, можно убрать) */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-xl">
        <h1 className="text-4xl font-extrabold mb-2">Главная лента</h1>
        <p className="text-white/80 text-lg">Лучшие мемы Интернета здесь и сейчас</p>
      </div>

      {/* Используем Единую Сетку */}
      <MemeGrid items={memes} />
    </div>
  );
}