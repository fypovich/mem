"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, Hash, RefreshCw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const MENU_ITEMS = [
  { name: "Главная", href: "/", icon: Home },
  { name: "Новое", href: "/new", icon: RefreshCw },
  { name: "Тренды", href: "/trending", icon: Flame },
];

export function Sidebar() {
  const pathname = usePathname();
  const [popular, setPopular] = useState<{ tags: any[]; top_users: any[] } | null>(null);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/memes/popular-content`);
        if (res.ok) {
          setPopular(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchPopular();
  }, []);

  return (
    <div className="w-full flex flex-col gap-6 h-full">

      {/* Основное меню */}
      <div className="flex flex-col gap-1">
        <h3 className="px-4 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Лента
        </h3>
        {MENU_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-base font-normal",
                pathname === item.href && "bg-secondary text-secondary-foreground font-medium"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Button>
          </Link>
        ))}
      </div>

      {/* Топ Пользователи */}
      {popular && popular.top_users && popular.top_users.length > 0 && (
        <div className="flex flex-col gap-1">
            <h3 className="px-4 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-3 h-3" /> Топ Авторов
            </h3>
            <div className="flex flex-col gap-0.5">
                {popular.top_users.map((user: any) => {
                  const avatarSrc = user.avatar_url
                    ? (user.avatar_url.startsWith("http") ? user.avatar_url : `${API_URL}${user.avatar_url}`)
                    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
                  return (
                    <Link key={user.username} href={`/user/${user.username}`}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 text-sm font-normal h-auto py-2",
                          pathname === `/user/${user.username}` && "bg-secondary font-medium"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarSrc}
                          alt={user.username}
                          className="w-7 h-7 rounded-full object-cover bg-muted shrink-0"
                        />
                        <span className="truncate">@{user.username}</span>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">{user.likes_count}</span>
                      </Button>
                    </Link>
                  );
                })}
            </div>
        </div>
      )}

      {/* Популярные Теги */}
      {popular && popular.tags.length > 0 && (
        <div className="flex flex-col gap-1">
            <h3 className="px-4 text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-3 h-3" /> Топ Теги
            </h3>
            <ScrollArea className="h-auto max-h-[200px]">
                {popular.tags.map((tag: any) => (
                <Link key={tag.name} href={`/tag/${tag.name}`}>
                    <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 text-sm font-normal",
                        pathname === `/tag/${tag.name}` && "bg-secondary font-medium"
                    )}
                    >
                    <span className="truncate">#{tag.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{tag.count}</span>
                    </Button>
                </Link>
                ))}
            </ScrollArea>
        </div>
      )}

      {/* Футер */}
      <div className="mt-auto px-4 py-4 text-xs text-muted-foreground border-t space-y-1">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <Link href="/terms" className="hover:underline">Условия</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:underline">Конфиденциальность</Link>
        </div>
        <div className="mt-2">© 2026 MemeHUB</div>
      </div>
    </div>
  );
}
