"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, Upload, LogOut, User, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WS_URL = API_URL.replace(/^http/, 'ws');

export function Header() {
  const router = useRouter();
  const { isLoading, isAuthenticated, user, token, logout: authLogout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const ws = useRef<WebSocket | null>(null);

  const fetchNotifications = async () => {
    const currentToken = token || localStorage.getItem("token");
    if (!currentToken) return;

    try {
      const resNotif = await fetch(`${API_URL}/api/v1/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

      if (resNotif.ok) {
        const data = await resNotif.json();
        setUnreadCount(data.count !== undefined ? data.count : 0);
      } else {
        const resList = await fetch(`${API_URL}/api/v1/notifications/?limit=10`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (resList.ok) {
          const list = await resList.json();
          setUnreadCount(list.filter((n: any) => !n.is_read).length);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const connectWebSocket = (wsToken: string) => {
      if (ws.current) return;

      const socket = new WebSocket(`${WS_URL}/api/v1/notifications/ws?token=${wsToken}`);

      socket.onmessage = (event) => {
          try {
              JSON.parse(event.data);
              setUnreadCount(prev => prev + 1);
          } catch (e) {
              console.error("WS Parse error", e);
          }
      };

      socket.onclose = () => {
          ws.current = null;
          setTimeout(() => {
              const t = localStorage.getItem("token");
              if (t) connectWebSocket(t);
          }, 3000);
      };

      ws.current = socket;
  };

  // Fetch notifications and connect WS when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchNotifications();
      connectWebSocket(token);
    }

    const handleNotifUpdate = () => fetchNotifications();
    window.addEventListener("notifications-updated", handleNotifUpdate);

    return () => {
        window.removeEventListener("notifications-updated", handleNotifUpdate);
        if (ws.current) ws.current.close();
    };
  }, [isAuthenticated, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    if (ws.current) {
        ws.current.close();
        ws.current = null;
    }
    authLogout();
    router.push("/login");
    router.refresh();
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const avatarUrl = user?.avatar_url
    ? (user.avatar_url.startsWith("http") ? user.avatar_url : `${API_URL}${user.avatar_url}`)
    : undefined;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center">

        {/* ЛЕВАЯ ЗОНА — Лого (ширина сайдбара) */}
        <div className="shrink-0 flex items-center gap-2 px-4 md:w-64 md:border-r md:border-border/50">
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-1">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <div className="px-4 py-6">
                  <Sidebar />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Link href="/" className="flex items-center gap-2 font-bold text-xl shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">M</div>
            <span className="hidden sm:inline-block">MemeHUB</span>
          </Link>
        </div>

        {/* ЦЕНТРАЛЬНАЯ ЗОНА — Поиск */}
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-xl relative hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск мемов, людей, тегов..."
              className="w-full pl-9 bg-muted/50 focus:bg-background transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>
        </div>

        {/* ПРАВАЯ ЗОНА — Кнопки */}
        <div className="shrink-0 flex items-center gap-2 md:gap-3 px-4">
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : isAuthenticated ? (
            <>
              <Link href="/upload">
                <Button size="sm" variant="ghost" className="hidden md:flex">
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить
                </Button>
                <Button size="icon" variant="ghost" className="md:hidden">
                  <Upload className="w-5 h-5" />
                </Button>
              </Link>

              <Link href="/notifications" className="relative">
                <Button size="icon" variant="ghost">
                  <Bell className="w-5 h-5" />
                </Button>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold pointer-events-none animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="w-8 h-8 cursor-pointer border border-border hover:border-primary transition-colors">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>{user?.full_name || `@${user?.username}`}</div>
                    {user?.full_name && <div className="text-xs font-normal text-muted-foreground">@{user?.username}</div>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href={`/user/${user?.username}`}>
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" /> Профиль
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/settings">
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" /> Настройки
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-500 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" /> Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Вход</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Регистрация</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
