"use client";

import React, { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { MemeGrid } from "@/components/meme-grid";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface InfiniteMemeGridProps {
  fetchUrl: string;
  initialItems?: any[];
  limit?: number;
  token?: string | null;
}

export function InfiniteMemeGrid({
  fetchUrl,
  initialItems = [],
  limit = 20,
  token,
}: InfiniteMemeGridProps) {
  const fetchFn = useCallback(
    async (skip: number, lim: number) => {
      const separator = fetchUrl.includes("?") ? "&" : "?";
      const url = `${API_URL}${fetchUrl}${separator}skip=${skip}&limit=${lim}`;

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
    [fetchUrl, token]
  );

  const { items, isLoading, isLoadingMore, hasMore, sentinelRef } =
    useInfiniteScroll({
      fetchFn,
      limit,
      initialItems,
    });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[30vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
        <p className="text-lg">Здесь пока пусто.</p>
      </div>
    );
  }

  return (
    <div>
      <MemeGrid items={items} />

      {/* Sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {isLoadingMore && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Вы долистали до конца
        </div>
      )}
    </div>
  );
}
