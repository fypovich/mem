"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, Upload, LogOut, User, Menu } from "lucide-react";
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
import { SidebarTrigger } from "/ui/sidebar";

const API_URL = "http://127.0.0.1:8000";

export function Header() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Функция загрузки данных пользователя
  const fetchUserData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        return;
    }

    try {
        // 1. Грузим профиль "me"
        const resMe = await fetch(`${API_URL}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (resMe.ok) {
            const userData = await resMe.json();
            setUser(userData);
            setIsAuthenticated(true);
            
            // 2. Грузим счетчик уведомлений
            const resNotif = await fetch(`${API_URL}/api/v1/notifications/unread-count`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (resNotif.ok) {
                const data = await resNotif.json();
                setUnreadCount(data.count);
            }
        } else {
            // Токен протух
            handleLogout();
        }
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    fetchUserData();

    // Слушаем событие входа/выхода
    const handleAuthChange = () => fetchUserData();
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
        window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Формируем URL аватарки
  const avatarUrl = user?.avatar_url 
    ? (user.avatar_url.startsWith("http") ? user.avatar_url : `${API_URL}${user.avatar_url}`)
    : undefined;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 px-4">
        
        {/* Меню для мобилок */}
        <SidebarTrigger className="md:hidden" />

        {/* Логотип */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl mr-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">M</div>
          <span className="hidden sm:inline-block">MemApp</span>
        </Link>

        {/* Поиск */}
        <div className="flex-1 max-w-xl relative">
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

        <div className="flex items-center gap-2 md:gap-4 ml-auto">
          {isAuthenticated ? (
            <>
              {/* Кнопка загрузки */}
              <Link href="/upload">
                <Button size="sm" variant="ghost" className="hidden md:flex">
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить
                </Button>
                <Button size="icon" variant="ghost" className="md:hidden">
                  <Upload className="w-5 h-5" />
                </Button>
              </Link>

              {/* Уведомления */}
              <Link href="/notifications" className="relative">
                <Button size="icon" variant="ghost">
                  <Bell className="w-5 h-5" />
                </Button>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold pointer-events-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
              </Link>

              {/* Профиль дропдаун */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="w-8 h-8 cursor-pointer border border-border hover:border-primary transition-colors">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>@{user?.username}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href={`/user/${user?.username}`}>
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" /> Профиль
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/settings">
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" /> Настройки (fake import fix)
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

// Костыль, чтобы Settings icon импортировался (в коде выше я использовал import {Settings}, но он мог быть не там)
import { Settings } from "lucide-react";