"use client";

import React, { useEffect, useState } from "react";
import { MemeGrid } from "@/components/meme-grid";
import { Loader2, Flame, Sparkles, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("smart"); // По умолчанию "Для вас"

  useEffect(() => {
    const fetchMemes = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const headers: any = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        // Передаем параметр sort в API
        const res = await fetch(`${API_URL}/api/v1/memes/?limit=50&sort=${sort}`, {
            headers: headers,
            cache: "no-store"
        });
        
        if (res.ok) {
            const data = await res.json();
            setMemes(data);
        }
      } catch (e) {
        console.error("Failed to load memes", e);
      } finally {
        setLoading(false);
      }
    };

    fetchMemes();
  }, [sort]); // Перезагружаем при смене сортировки

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      
      {/* Переключатель вкладок */}
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

      {loading ? (
          <div className="flex justify-center items-center min-h-[50vh]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      ) : (
          <>
            {memes.length > 0 ? (
                <MemeGrid items={memes} />
            ) : (
                <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                    <p className="text-lg">Здесь пока пусто.</p>
                    <p className="text-sm">Попробуйте другую вкладку или загрузите мем сами!</p>
                </div>
            )}
          </>
      )}
    </div>
  );
}