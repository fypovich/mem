"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseInfiniteScrollOptions<T> {
  fetchFn: (skip: number, limit: number) => Promise<T[]>;
  limit?: number;
  initialItems?: T[];
  getItemId?: (item: T) => string;
}

export function useInfiniteScroll<T extends { id?: string }>({
  fetchFn,
  limit = 20,
  initialItems = [],
  getItemId = (item) => (item as any).id,
}: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isLoading, setIsLoading] = useState(!initialItems.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(initialItems.length);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoadingMore(true);

    try {
      const newItems = await fetchFn(skipRef.current, limit);

      if (newItems.length < limit) {
        setHasMore(false);
      }

      if (newItems.length > 0) {
        setItems((prev) => {
          const existingIds = new Set(prev.map(getItemId));
          const unique = newItems.filter((item) => !existingIds.has(getItemId(item)));
          return [...prev, ...unique];
        });
        skipRef.current += newItems.length;
      }
    } catch (e) {
      console.error("Infinite scroll fetch error:", e);
    } finally {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [fetchFn, limit, hasMore, getItemId]);

  // Initial load (if no initialItems)
  useEffect(() => {
    if (initialItems.length === 0) {
      setIsLoading(true);
      loadMore().finally(() => setIsLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver for sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  const reset = useCallback(() => {
    setItems([]);
    setHasMore(true);
    setIsLoading(true);
    skipRef.current = 0;
    loadingRef.current = false;
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    sentinelRef,
    reset,
    setItems,
  };
}
