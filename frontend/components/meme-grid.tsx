import React from "react";
import { MemeCard, MemeCardSkeleton } from "./meme-card";

interface MemeGridProps {
  items: any[];
}

export function MemeGrid({ items }: MemeGridProps) {
  if (!items || items.length === 0) {
    return (
        <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
            <p>Здесь пока пусто 😔</p>
        </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
      {items.map((meme) => (
        <MemeCard key={meme.id} meme={meme} />
      ))}
    </div>
  );
}

export function MemeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <MemeCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}
