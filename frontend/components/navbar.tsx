"use client";

import React from "react";
import Link from "next/link";
import { Search, Upload, Menu, Play, Bell } from "lucide-react"; // <-- Добавил Bell
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-4 px-4 mx-auto max-w-7xl">
        
        {/* Mobile Menu */}
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tighter cursor-pointer hover:opacity-80 transition-opacity">
          <div className="bg-primary text-primary-foreground p-1 rounded-lg">
            <Play className="h-5 w-5 fill-current" />
          </div>
          <span>MemeHUB</span>
        </Link>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-auto hidden md:block">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Найти Райана Гослинга, CS2, мемы..." 
              className="pl-10 h-10 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-all"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/upload">
            <Button className="hidden md:flex gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 border-0">
              <Upload className="h-4 w-4" />
              <span>Загрузить</span>
            </Button>
          </Link>

          {/* УВЕДОМЛЕНИЯ (NEW) */}
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
                {/* Красная точка (индикатор) */}
                <span className="absolute top-2 right-2 h-2 w-2 bg-rose-500 rounded-full border border-background"></span>
            </Button>
          </Link>
          
          <Link href="/user/admin">
            <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>
    </header>
  );
}