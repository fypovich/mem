"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, LogOut, User, UploadCloud, Search, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Проверяем авторизацию только на клиенте
  useEffect(() => {
    setIsMounted(true);
    const storedUser = localStorage.getItem("username");
    setUsername(storedUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsername(null);
    router.push("/login");
    router.refresh();
  };

  // Пока не смонтировано на клиенте, возвращаем пустой блок, чтобы не было ошибок гидратации
  if (!isMounted) return <header className="h-16 w-full border-b bg-background" />;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 mx-auto gap-4">
        
        {/* ЛЕВАЯ ЧАСТЬ: Лого и Меню */}
        <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
            </Button>
            
            <Link href="/" className="flex items-center gap-2 font-bold text-xl hover:opacity-80 transition-opacity">
                <div className="bg-primary text-primary-foreground p-1 rounded-lg">
                    <Play className="h-4 w-4 fill-current" />
                </div>
                <span className="hidden sm:inline-block">MemeHUB</span>
            </Link>
        </div>

        {/* ЦЕНТР: Поиск */}
        <div className="flex-1 max-w-md mx-auto hidden md:block">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Найти мемы..." 
                    className="pl-10 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
                />
            </div>
        </div>

        {/* ПРАВАЯ ЧАСТЬ: Навигация */}
        <div className="flex items-center gap-2 md:gap-4">
          
          {username ? (
            <>
              {/* Кнопка Загрузить */}
              <Link href="/upload">
                <Button size="sm" className="hidden md:flex gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 border-0">
                  <UploadCloud className="w-4 h-4" />
                  <span>Загрузить</span>
                </Button>
              </Link>
              
              {/* Уведомления */}
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground hidden sm:flex">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full border border-background"></span>
              </Button>

              {/* Дропдаун Профиля */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`} />
                      <AvatarFallback>{username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">@{username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        Мемолог
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(`/user/${username}`)}>
                    <User className="mr-2 h-4 w-4" />
                    Профиль
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/upload")}>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Загрузить мем
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500">
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex gap-2">
              <Link href="/login">
                 <Button variant="ghost" size="sm">Вход</Button>
              </Link>
              <Link href="/login">
                 <Button size="sm">Регистрация</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}