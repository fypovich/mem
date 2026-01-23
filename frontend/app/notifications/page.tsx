"use client";

import React from "react";
import Link from "next/link";
import { Heart, MessageCircle, UserPlus, Star, CheckCheck, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Обновленные данные с реальными GIF
const NOTIFICATIONS = [
  { 
    id: 1, 
    type: "like", 
    user: "coder_vasya", 
    avatar: "https://github.com/shadcn.png", 
    text: "понравился ваш мем", 
    target_id: 101,
    preview: "https://media.giphy.com/media/10YZqnbt597Jsw/giphy.gif", // GIF
    time: "2 мин", 
    read: false 
  },
  { 
    id: 2, 
    type: "comment", 
    user: "user_123", 
    avatar: "", 
    text: "прокомментировал: «Ахаха, жиза!»", 
    target_id: 102,
    preview: "https://media.giphy.com/media/3o7TKr3nzbh5WgCFxe/giphy.gif", // GIF
    time: "15 мин", 
    read: false 
  },
  { 
    id: 3, 
    type: "follow", 
    user: "meme_queen", 
    avatar: "", 
    text: "подписался на вас", 
    target_id: null,
    preview: null, // У подписок нет превью мема
    time: "1 час", 
    read: true 
  },
  { 
    id: 4, 
    type: "system", 
    user: "MemeGiphy", 
    avatar: "", 
    text: "Ваш мем «Пятничный деплой» попал в тренды! 🔥", 
    target_id: 103,
    preview: "https://media.giphy.com/media/XIqCQx02E1U9W/giphy.gif", // GIF
    time: "2 часа", 
    read: true 
  },
  { 
    id: 5, 
    type: "like", 
    user: "senior_dev", 
    avatar: "", 
    text: "понравился ваш мем", 
    target_id: 104,
    preview: "https://media.giphy.com/media/l2Je66zG6mAAZxgqI/giphy.gif", // GIF
    time: "5 часов", 
    read: true 
  },
  { 
    id: 6, 
    type: "like", 
    user: "doge_fan", 
    avatar: "", 
    text: "понравился ваш мем", 
    target_id: 104,
    preview: "https://media.giphy.com/media/l2Je66zG6mAAZxgqI/giphy.gif", // GIF
    time: "Вчера", 
    read: true 
  },
];

export default function NotificationsPage() {
  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 sticky top-16 z-20 bg-background/95 backdrop-blur py-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
            Уведомления 
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">2</span>
        </h1>
        <div className="flex gap-2">
             <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                <CheckCheck className="w-4 h-4 mr-2" /> Прочитать все
            </Button>
        </div>
      </div>

      <div className="space-y-4">
        
        {/* Группировка "Новые" (условно) */}
        <div className="text-sm font-medium text-muted-foreground px-2">Новые</div>
        
        <div className="flex flex-col gap-2">
            {NOTIFICATIONS.slice(0, 3).map((note) => (
                <NotificationItem key={note.id} note={note} />
            ))}
        </div>

        <div className="text-sm font-medium text-muted-foreground px-2 pt-4">Ранее</div>
        
        <div className="flex flex-col gap-2">
            {NOTIFICATIONS.slice(3).map((note) => (
                <NotificationItem key={note.id} note={note} />
            ))}
        </div>

      </div>
    </div>
  );
}

// Компонент отдельного уведомления
function NotificationItem({ note }: { note: any }) {
    return (
        <div className={`group relative flex items-start gap-4 p-4 rounded-xl transition-all duration-200 border hover:border-border hover:shadow-sm
            ${!note.read ? 'bg-muted/30 border-primary/20' : 'bg-background border-transparent hover:bg-muted/20'}
        `}>
            {/* ИНДИКАТОР НЕПРОЧИТАННОГО */}
            {!note.read && (
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary"></div>
            )}

            {/* ИКОНКА ТИПА (Слева) */}
            <div className="mt-0.5 relative">
                <Avatar className="w-10 h-10 border border-border">
                    <AvatarImage src={note.avatar} />
                    <AvatarFallback>{note.user[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                
                {/* Маленький бейдж с типом действия */}
                <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-background p-0.5 bg-background">
                    {note.type === 'like' && <div className="p-1 rounded-full bg-rose-500 text-white"><Heart className="w-3 h-3 fill-current" /></div>}
                    {note.type === 'comment' && <div className="p-1 rounded-full bg-blue-500 text-white"><MessageCircle className="w-3 h-3 fill-current" /></div>}
                    {note.type === 'follow' && <div className="p-1 rounded-full bg-purple-500 text-white"><UserPlus className="w-3 h-3" /></div>}
                    {note.type === 'system' && <div className="p-1 rounded-full bg-yellow-500 text-white"><Star className="w-3 h-3 fill-current" /></div>}
                </div>
            </div>

            {/* ТЕКСТ (Центр) */}
            <div className="flex-1 min-w-0 py-0.5">
                <div className="text-sm leading-snug">
                    <Link href={`/user/${note.user}`} className="font-bold hover:underline mr-1 text-foreground">
                        {note.user}
                    </Link>
                    <span className="text-muted-foreground">
                        {note.text}
                    </span>
                    <span className="text-muted-foreground/60 text-xs ml-2 whitespace-nowrap">
                        {note.time}
                    </span>
                </div>
                
                {/* Если это подписка - кнопка действия */}
                {note.type === 'follow' && (
                    <Button size="sm" variant="outline" className="mt-3 h-8 text-xs font-semibold">
                        Подписаться в ответ
                    </Button>
                )}
            </div>

            {/* МИНИАТЮРА (Справа) - Теперь показывает реальную картинку */}
            {note.preview && (
                <Link href={`/meme/${note.target_id}`} className="shrink-0">
                    <div className="w-12 h-12 rounded-md border border-border hover:opacity-80 transition-opacity overflow-hidden relative">
                         <img 
                            src={note.preview} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                         />
                    </div>
                </Link>
            )}

            {/* Кнопка "Опции" (Скрыта, появляется при ховере) */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>Отключить уведомления</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-500">Пожаловаться</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

        </div>
    );
}