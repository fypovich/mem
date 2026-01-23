"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Flame, Sparkles, Gamepad2, Film, Tv } from "lucide-react";

const CATEGORIES = [
  { name: "В тренде", slug: "trending", icon: <Flame className="w-4 h-4 text-orange-500" /> },
  { name: "Новое", slug: "new", icon: <Sparkles className="w-4 h-4 text-yellow-500" /> },
  { name: "Реакции", slug: "reactions", icon: null },
  { name: "Игры", slug: "gaming", icon: <Gamepad2 className="w-4 h-4" /> },
  { name: "Фильмы", slug: "movies", icon: <Film className="w-4 h-4" /> },
  { name: "Аниме", slug: "anime", icon: <Tv className="w-4 h-4" /> },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:block w-64 shrink-0 space-y-6 pt-6"> {/* Добавил shrink-0 и убрал sticky отсюда, чтобы управлялось из layout */}
      <div className="sticky top-20"> {/* Sticky теперь внутри */}
        <div className="mb-6">
            <h3 className="mb-2 px-2 text-sm font-semibold tracking-tight text-muted-foreground">
            Категории
            </h3>
            <div className="space-y-1">
            {CATEGORIES.map((cat) => (
                <Link href={`/category/${cat.slug}`} key={cat.slug} className="block w-full">
                <Button variant="ghost" className="w-full justify-start gap-2 font-medium">
                    {cat.icon ? cat.icon : <span className="w-4" />}
                    {cat.name}
                </Button>
                </Link>
            ))}
            </div>
        </div>
        
        <div>
            <h3 className="mb-2 px-2 text-sm font-semibold tracking-tight text-muted-foreground">
            Популярные Персонажи
            </h3>
            <div className="space-y-1">
            {['Ryan Gosling', 'Ana de Armas', 'Patrick Bateman', 'Walter White'].map((person) => (
                <Link href={`/tag/${person.toLowerCase().replace(' ', '_')}`} key={person} className="block w-full">
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                    <Avatar className="h-6 w-6 rounded-md">
                    <AvatarFallback className="text-[10px] rounded-md">{person[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{person}</span>
                </Button>
                </Link>
            ))}
            </div>
        </div>
      </div>
    </aside>
  );
}