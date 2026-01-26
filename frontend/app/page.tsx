"use client";

import React, { useEffect, useState } from "react";
import { MemeGrid } from "@/components/meme-grid";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemes = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: any = {};
        
        // Если есть токен, добавляем его в запрос
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_URL}/api/v1/memes/?limit=50`, {
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
  }, []);

  if (loading) {
      return (
          <div className="flex justify-center items-center min-h-[50vh]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      );
  }

  return (
    <div className="container mx-auto max-w-7xl">
      {/* Баннер */}
      <div className="mb-8 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-xl">
        <h1 className="text-4xl font-extrabold mb-2">Главная лента</h1>
        <p className="text-white/80 text-lg">Лучшие мемы Интернета здесь и сейчас</p>
      </div>

      {memes.length > 0 ? (
          <MemeGrid items={memes} />
      ) : (
          <div className="text-center py-20 text-muted-foreground">
              Мемов пока нет или вы всех заблокировали :)
          </div>
      )}
    </div>
  );
}