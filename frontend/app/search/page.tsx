"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MemeGrid } from "@/components/meme-grid";
import { Loader2, Search } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Выносим логику в отдельный компонент
function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMemes = async () => {
      if (!query) return;
      
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/v1/memes/?search=${encodeURIComponent(query)}`);
        if (res.ok) {
            const data = await res.json();
            setMemes(data);
        }
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setLoading(false);
      }
    };

    fetchMemes();
  }, [query]);

  if (!query) {
      return (
          <div className="text-center py-20 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Введите запрос в строку поиска сверху</p>
          </div>
      )
  }

  if (loading) {
      return (
          <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
      );
  }

  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-bold">Результаты по запросу: <span className="text-primary">"{query}"</span></h1>
        {memes.length > 0 ? (
            <MemeGrid items={memes} />
        ) : (
            <div className="text-center py-10 text-muted-foreground">
                Ничего не найдено 😔
            </div>
        )}
    </div>
  );
}

// Главная страница просто оборачивает контент в Suspense
export default function SearchPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>}>
        <SearchContent />
      </Suspense>
    </div>
  );
}