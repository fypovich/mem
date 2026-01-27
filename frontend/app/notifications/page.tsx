"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, UserPlus, Bell, Image as ImageIcon, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Notification {
  id: number;
  type: "follow" | "like" | "comment" | "new_meme" | "system";
  is_read: boolean;
  created_at: string;
  text?: string;
  sender?: {
    username: string;
    avatar_url?: string;
  };
  meme_id?: string;
  meme_thumbnail?: string;
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
        const res = await fetch(`${API_URL}/api/v1/notifications/`, {
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
        await fetch(`${API_URL}/api/v1/notifications/read-all`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    } catch(e) { console.error(e) }
  };

  const NotificationItem = ({ note }: { note: Notification }) => {
    let icon = <Bell className="w-5 h-5" />;
    let content = "";
    let link = "";

    switch (note.type) {
      case "follow":
        icon = <UserPlus className="w-5 h-5 text-blue-500" />;
        content = `подписался на вас`;
        link = `/user/${note.sender?.username}`;
        break;
      case "like":
        icon = <Heart className="w-5 h-5 text-red-500" />;
        content = `лайкнул ваш мем`;
        link = `/meme/${note.meme_id}`;
        break;
      case "comment":
        icon = <MessageCircle className="w-5 h-5 text-green-500" />;
        content = `прокомментировал: "${note.text || '...'}"`;
        link = `/meme/${note.meme_id}`;
        break;
      case "new_meme":
        icon = <ImageIcon className="w-5 h-5 text-purple-500" />;
        content = `выложил новый мем`;
        link = `/meme/${note.meme_id}`;
        break;
      case "system":
        icon = <Bell className="w-5 h-5 text-yellow-500" />;
        content = note.text || "Системное уведомление";
        link = "#";
        break;
    }

    const date = new Date(note.created_at).toLocaleDateString("ru-RU", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });

    return (
      <div className={`flex items-start gap-4 p-4 border-b hover:bg-muted/30 transition-colors ${!note.is_read ? "bg-muted/10" : ""}`}>
        <div className="mt-1">{icon}</div>
        
        <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
                {note.sender && (
                    <Link href={`/user/${note.sender.username}`} className="font-bold hover:underline flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                            <AvatarImage src={note.sender.avatar_url ? `${API_URL}${note.sender.avatar_url}` : undefined} />
                            <AvatarFallback>{note.sender.username[0]}</AvatarFallback>
                        </Avatar>
                        {note.sender.username}
                    </Link>
                )}
                <span className="text-muted-foreground">{content}</span>
            </div>
            <div className="text-xs text-muted-foreground">{date}</div>
        </div>

        {/* Превью мема справа */}
        {(note.meme_id && note.meme_thumbnail) && (
            <Link href={`/meme/${note.meme_id}`} className="shrink-0">
                <img 
                    src={`${API_URL}${note.meme_thumbnail}`} 
                    alt="Meme" 
                    className="w-12 h-12 object-cover rounded-md border"
                />
            </Link>
        )}
        
        {!note.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
      </div>
    );
  };

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" /> Уведомления
        </h1>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
            <Check className="w-4 h-4 mr-2" /> Прочитать все
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
            <div className="p-10 text-center text-muted-foreground">Загрузка...</div>
        ) : notifications.length > 0 ? (
            notifications.map(note => <NotificationItem key={note.id} note={note} />)
        ) : (
            <div className="p-10 text-center text-muted-foreground">Нет новых уведомлений 🎉</div>
        )}
      </div>
    </div>
  );
}