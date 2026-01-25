import React from "react";
import { RefreshCw } from "lucide-react";
import { MemeGrid } from "@/components/meme-grid"; // <-- Импорт

const API_URL = "http://127.0.0.1:8000";

async function getNewMemes() {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?limit=50&sort=new`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

export default async function NewMemesPage() {
  const memes = await getNewMemes();

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <RefreshCw className="w-8 h-8 text-blue-500" /> Свежие мемы
      </h1>

      <MemeGrid items={memes} />
    </div>
  );
}