"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileHeaderActionsProps {
  user: any;        // Данные с сервера (могут быть неточными без токена)
  memesCount: number;
}

export function ProfileHeaderActions({ user: initialUser, memesCount }: ProfileHeaderActionsProps) {
  const router = useRouter();
  
  // Инициализируем состояние
  const [isFollowing, setIsFollowing] = useState(initialUser.is_following);
  const [followersCount, setFollowersCount] = useState(initialUser.followers_count || 0);
  const [isMe, setIsMe] = useState(initialUser.is_me);
  
  const [isLoading, setIsLoading] = useState(false);

  // --- ИСПРАВЛЕНИЕ: Актуализируем данные на клиенте ---
  useEffect(() => {
    const fetchRealStatus = async () => {
        const token = localStorage.getItem("token");
        if (!token) return; // Если токена нет, верим серверным данным (они для анонима ок)

        try {
            // Запрашиваем профиль этого пользователя заново, но уже с токеном
            const res = await fetch(`http://127.0.0.1:8000/api/v1/users/${initialUser.username}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.ok) {
                const freshData = await res.json();
                setIsFollowing(freshData.is_following);
                setIsMe(freshData.is_me);
                // setFollowersCount(freshData.followers_count); // Можно обновить, если нужно
            }
        } catch (e) {
            console.error("Failed to fetch fresh profile status", e);
        }
    };

    fetchRealStatus();
  }, [initialUser.username]);
  // ---------------------------------------------------

  const handleFollow = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/users/${initialUser.username}/follow`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.action === "followed");
        setFollowersCount(data.followers_count);
        router.refresh(); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-6 w-full">
      
      {/* ЛЕВАЯ ЧАСТЬ */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold">{initialUser.full_name || `@${initialUser.username}`}</h1>
        {initialUser.full_name && <p className="text-muted-foreground">@{initialUser.username}</p>}
        
        <p className="text-muted-foreground mt-2 max-w-2xl whitespace-pre-wrap">
            {initialUser.bio || "Пользователь пока ничего о себе не написал."}
        </p>
        
        <div className="mt-4 flex gap-3">
            {isMe ? (
                <Link href="/settings">
                    <Button size="sm" variant="secondary" className="gap-2">
                        <Settings className="w-4 h-4" /> Настройки
                    </Button>
                </Link>
            ) : (
                <Button 
                    size="sm" 
                    onClick={handleFollow} 
                    disabled={isLoading}
                    variant={isFollowing ? "outline" : "default"}
                    className={isFollowing ? "text-red-500 hover:text-red-600 hover:bg-red-50" : ""}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                        <><UserCheck className="w-4 h-4 mr-2" /> Вы подписаны</>
                    ) : (
                        <><UserPlus className="w-4 h-4 mr-2" /> Подписаться</>
                    )}
                </Button>
            )}
        </div>
      </div>

      {/* ПРАВАЯ ЧАСТЬ: Статистика */}
      <div className="flex gap-4 p-4 bg-muted/30 rounded-lg border self-start md:self-auto">
        <div className="text-center min-w-[80px]">
            <div className="font-bold text-2xl">{memesCount}</div> 
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Мемов</div>
        </div>
        
        <div className="w-px bg-border my-1"></div>
        
        <Link href={`/user/${initialUser.username}/followers`} className="text-center min-w-[80px] hover:bg-muted/50 rounded transition-colors cursor-pointer p-1 -m-1">
            <div className="font-bold text-2xl">{followersCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Подписчиков</div>
        </Link>
        
        <div className="w-px bg-border my-1"></div>
        
        <Link href={`/user/${initialUser.username}/following`} className="text-center min-w-[80px] hover:bg-muted/50 rounded transition-colors cursor-pointer p-1 -m-1">
            <div className="font-bold text-2xl">{initialUser.following_count || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Подписок</div>
        </Link>
      </div>

    </div>
  );
}