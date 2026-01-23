"use client";

import React, { use } from "react";
import { Hash, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemeCard } from "@/components/meme-card";

// Обновленные данные с реальными GIF
const TAG_MEMES = [
  { 
    id: 301, 
    title: "Жиза...", 
    author: "sad_pepe", 
    views: "2k", 
    height: "h-64", 
    preview: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3V4eDJ4Z3V4eDJ4Z3V4eDJ4Z3V4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/QMHoU66sBXqqLqYvGO/giphy.gif" // This is fine
  },
  { 
    id: 302, 
    title: "Утро понедельника", 
    author: "worker", 
    views: "15k", 
    height: "h-48", 
    preview: "https://media.giphy.com/media/l0MYt5jPR625aXBqE/giphy.gif" // Office tired
  },
  { 
    id: 303, 
    title: "Когда зарплата пришла", 
    author: "happy_guy", 
    views: "100k", 
    height: "h-72", 
    preview: "https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif" // Money
  },
  { 
    id: 304, 
    title: "Кот смотрит", 
    author: "cat_lover", 
    views: "50k", 
    height: "h-56", 
    preview: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif" // Vibing cat
  },
  { 
    id: 305, 
    title: "Программирование это весело", 
    author: "dev_junior", 
    views: "12k", 
    height: "h-64", 
    preview: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif" // Fire computer
  },
];

type Params = Promise<{ slug: string }>;

export default function TagPage({ params }: { params: Params }) {
  const { slug } = use(params);
  // Декодируем slug (например, %23жиза -> #жиза)
  const tagName = decodeURIComponent(slug);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center md:items-start gap-6">
            
            {/* Большая иконка хештега */}
            <div className="h-24 w-24 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 text-primary">
                <Hash className="w-12 h-12" />
            </div>

            <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight mb-2">#{tagName}</h1>
                <p className="text-muted-foreground">
                    1,204 мемов с этим тегом.
                </p>
                <div className="mt-4 flex items-center justify-center md:justify-start gap-3">
                    <Button className="gap-2">
                        <Bell className="w-4 h-4" /> Отслеживать тег
                    </Button>
                </div>
            </div>
            
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {TAG_MEMES.map(meme => (
                <MemeCard key={meme.id} meme={meme} />
            ))}
        </div>
      </div>
    </div>
  );
}