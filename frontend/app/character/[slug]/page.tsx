import React from "react";
import { User } from "lucide-react";
import { MemeGrid } from "@/components/meme-grid";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getSubjectMemes(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?subject=${slug}&limit=50`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

// Исправленный тип params
export default async function CharacterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // <-- Добавлен await
  const memes = await getSubjectMemes(slug);
  
  // Используем slug, если memes пустой или subject не определен
  const name = memes.length > 0 && memes[0].subject ? memes[0].subject.name : slug;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-orange-500/10 rounded-full">
            <User className="w-8 h-8 text-orange-500" />
        </div>
        <div>
            <h1 className="text-3xl font-bold">{name}</h1>
            <p className="text-muted-foreground">Персонаж • {memes.length} мемов</p>
        </div>
      </div>

      <MemeGrid items={memes} />
    </div>
  );
}