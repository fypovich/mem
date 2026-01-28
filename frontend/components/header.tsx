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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WS_URL = API_URL.replace(/^http/, 'ws');

export function Header() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  
  const ws = useRef<WebSocket | null>(null);

  const fetchUserData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        return;
    }

    try {
        const resMe = await fetch(`${API_URL}/api/v1/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (resMe.ok) {
            const userData = await resMe.json();
            setUser(userData);
            setIsAuthenticated(true);
            
            const resNotif = await fetch(`${API_URL}/api/v1/notifications/unread-count`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (resNotif.ok) {
                const data = await resNotif.json();
                setUnreadCount(data.count !== undefined ? data.count : 0);
            } else {
                 const resList = await fetch(`${API_URL}/api/v1/notifications/?limit=10`, {
                    headers: { Authorization: `Bearer ${token}` }
                 });
                 if(resList.ok) {
                     const list = await resList.json();
                     setUnreadCount(list.filter((n: any) => !n.is_read).length);
                 }
            }
        } else {
            handleLogout();
        }
    } catch (e) {
        console.error(e);
    }
  };

  const connectWebSocket = (token: string) => {
      if (ws.current) return;

      const socket = new WebSocket(`${WS_URL}/api/v1/notifications/ws?token=${token}`);
      
      socket.onopen = () => {
          console.log("WS Connected 🟢");
      };

      socket.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              console.log("New Notification:", data);
              setUnreadCount(prev => prev + 1);
          } catch (e) {
              console.error("WS Parse error", e);
          }
      };

      socket.onclose = () => {
          console.log("WS Closed 🔴. Reconnecting...");
          ws.current = null;
          setTimeout(() => {
              const t = localStorage.getItem("token");
              if (t) connectWebSocket(t);
          }, 3000);
      };

      ws.current = socket;
  };

  useEffect(() => {
    fetchUserData();

    const handleAuthChange = () => fetchUserData();
    window.addEventListener("auth-change", handleAuthChange);

    // --- НОВОЕ: Слушаем обновление уведомлений ---
    const handleNotifUpdate = () => fetchUserData();
    window.addEventListener("notifications-updated", handleNotifUpdate);

    const token = localStorage.getItem("token");
    if (token) {
        connectWebSocket(token);
    }

    return () => {
        window.removeEventListener("auth-change", handleAuthChange);
        window.removeEventListener("notifications-updated", handleNotifUpdate); // <--- Добавлено
        if (ws.current) ws.current.close();
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    setUser(null);
    if (ws.current) {
        ws.current.close();
        ws.current = null;
    }
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
      <div className="container flex h-14 items-center gap-4 px-4 mx-auto max-w-7xl">
        
        <div className="md:hidden mr-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
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

        <Link href="/" className="flex items-center gap-2 font-bold text-xl mr-4 shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">M</div>
          <span className="hidden sm:inline-block">MemeHUB</span>
        </Link>

        <div className="flex-1 max-w-xl relative hidden md:block">
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
                  <DropdownMenuLabel>@{user?.username}</DropdownMenuLabel>
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