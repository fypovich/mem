"use client";

import React, { useMemo, useState, useEffect } from "react";
import { MemeCard, MemeCardSkeleton } from "./meme-card";

function useColumnCount() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    function update() {
      if (window.innerWidth >= 1024) setCount(3);
      else if (window.innerWidth >= 640) setCount(2);
      else setCount(1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

interface MemeGridProps {
  items: any[];
}

export function MemeGrid({ items }: MemeGridProps) {
  const columnCount = useColumnCount();

  const columns = useMemo(() => {
    const cols: any[][] = Array.from({ length: columnCount }, () => []);
    const heights: number[] = new Array(columnCount).fill(0);

    items.forEach((meme) => {
      const shortest = heights.indexOf(Math.min(...heights));
      cols[shortest].push(meme);
      const ratio = meme.width && meme.height ? meme.height / meme.width : 1.5;
      heights[shortest] += ratio;
    });

    return cols;
  }, [items, columnCount]);

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
        <p>Здесь пока пусто</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-4">
          {col.map((meme) => (
            <MemeCard key={meme.id} meme={meme} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MemeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }, (_, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-4">
          {Array.from(
            { length: Math.ceil(count / 3) },
            (_, i) => {
              const idx = colIdx * Math.ceil(count / 3) + i;
              return idx < count ? <MemeCardSkeleton key={idx} index={idx} /> : null;
            }
          )}
        </div>
      ))}
    </div>
  );
}
