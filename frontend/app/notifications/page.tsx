"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, UserPlus, Bell, Image as ImageIcon, Check, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const DISPLAY_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Notification {
  id: string; // ВАЖНО: id должен быть string (UUID)
  type: "follow" | "like" | "comment" | "new_meme" | "system";
  is_read: boolean;
  created_at: string;
  text?: string;
  sender?: {
    username: string;
    avatar_url?: string;
  };
  meme?: {
      id: string;
      thumbnail_url?: string;
      media_url?: string;
  };
  meme_id?: string; 
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch(`${DISPLAY_API_URL}/api/v1/notifications/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [router]);

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
        await fetch(`${DISPLAY_API_URL}/api/v1/notifications/read-all`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    } catch(e) { console.error(e) }
  };

  // --- КОМПОНЕНТ ОДНОГО УВЕДОМЛЕНИЯ С НАБЛЮДАТЕЛЕМ ---
  const NotificationItem = ({ note }: { note: Notification }) => {
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (note.is_read) return; // Если уже прочитано, не наблюдаем

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    markAsReadSingle(note.id);
                    observer.disconnect();
                }
            },
            { threshold: 0.5 } // Срабатывает, когда элемент виден на 50%
        );

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, [note.id, note.is_read]);

    const markAsReadSingle = async (id: string) => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            await fetch(`${DISPLAY_API_URL}/api/v1/notifications/${id}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });
            // Обновляем локально (убираем точку), не перезагружая список
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (e) { console.error(e) }
    };

    let Icon = Bell;
    let iconColor = "bg-gray-500";
    let content = "";
    let link = "#";

    const memeId = note.meme?.id || note.meme_id;
    let memePreview = note.meme?.thumbnail_url;
    
    if (memePreview && !memePreview.startsWith("http")) {
        memePreview = `${DISPLAY_API_URL}${memePreview}`;
    }

    const userLink = note.sender ? `/user/${note.sender.username}` : "#";

    switch (note.type) {
      case "follow":
        Icon = UserPlus;
        iconColor = "bg-purple-500";
        content = "подписался на вас";
        link = userLink; 
        break;
      case "like":
        Icon = Heart;
        iconColor = "bg-rose-500";
        content = "понравился ваш мем";
        link = memeId ? `/meme/${memeId}` : "#";
        break;
      case "comment":
        Icon = MessageCircle;
        iconColor = "bg-blue-500";
        content = `прокомментировал: «${note.text || '...'}»`;
        link = memeId ? `/meme/${memeId}` : "#";
        break;
      case "new_meme":
        Icon = ImageIcon;
        iconColor = "bg-green-500";
        content = "опубликовал новый мем";
        link = memeId ? `/meme/${memeId}` : "#";
        break;
      case "system":
        Icon = Star;
        iconColor = "bg-yellow-500";
        content = note.text || "Системное уведомление";
        break;
    }

    const date = new Date(note.created_at).toLocaleDateString("ru-RU", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });

    const senderAvatar = note.sender?.avatar_url 
        ? (note.sender.avatar_url.startsWith("http") ? note.sender.avatar_url : `${DISPLAY_API_URL}${note.sender.avatar_url}`)
        : undefined;

    return (
        <div 
            ref={itemRef} // <-- Реф для Observer'а
            className={`group relative flex items-start gap-4 p-4 rounded-xl transition-all duration-500 border border-transparent hover:border-border hover:shadow-sm ${!note.is_read ? 'bg-muted/10' : 'bg-background hover:bg-muted/5'}`}
        >
            {/* ИНДИКАТОР НЕПРОЧИТАННОГО */}
            <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary transition-opacity duration-500 ${note.is_read ? 'opacity-0' : 'opacity-100'}`}></div>

            {/* АВАТАРКА С ИКОНКОЙ */}
            <div className="relative shrink-0">
                {note.sender ? (
                    <Link href={`/user/${note.sender.username}`}>
                        <Avatar className="w-10 h-10 border border-border">
                            <AvatarImage src={senderAvatar} />
                            <AvatarFallback>{note.sender.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                    </Link>
                ) : (
                    <Avatar className="w-10 h-10 border border-border">
                        <AvatarFallback>SYS</AvatarFallback>
                    </Avatar>
                )}
                
                <div className={`absolute -bottom-1 -right-1 rounded-full border-2 border-background p-1 text-white ${iconColor}`}>
                    <Icon className="w-3 h-3 fill-current" />
                </div>
            </div>

            {/* КОНТЕНТ */}
            <div className="flex-1 min-w-0 py-0.5">
                <div className="text-sm leading-snug">
                    {note.sender && (
                        <Link href={`/user/${note.sender.username}`} className="font-bold hover:underline mr-1 text-foreground">
                            {note.sender.username}
                        </Link>
                    )}
                    <span className="text-muted-foreground">{content}</span>
                </div>
                <div className="text-xs text-muted-foreground/60 mt-1">{date}</div>
            </div>

            {/* ПРЕВЬЮ МЕМА (СПРАВА) */}
            {memePreview && link !== "#" && (
                <Link href={link} className="shrink-0">
                    <div className="w-12 h-12 rounded-md border border-border hover:opacity-80 transition-opacity overflow-hidden bg-muted">
                        <img 
                            src={memePreview} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                </Link>
            )}
        </div>
    );
  };

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6 sticky top-16 z-20 bg-background/95 backdrop-blur py-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
            Уведомления
            {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground animate-in zoom-in">
                    {notifications.filter(n => !n.is_read).length}
                </span>
            )}
        </h1>
        <Button variant="ghost" size="sm" onClick={markAllRead} className="text-muted-foreground hover:text-primary">
            <Check className="w-4 h-4 mr-2" /> Прочитать все
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
            <div className="p-10 text-center text-muted-foreground">Загрузка...</div>
        ) : notifications.length > 0 ? (
            notifications.map((note) => (
                <NotificationItem key={note.id} note={note} />
            ))
        ) : (
            <div className="text-center py-20 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Нет новых уведомлений</p>
            </div>
        )}
      </div>
    </div>
  );
}