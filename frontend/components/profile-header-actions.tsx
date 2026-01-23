"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileHeaderActionsProps {
  user: any; // Данные профиля
}

export function ProfileHeaderActions({ user }: ProfileHeaderActionsProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(user.is_following);
  const [followersCount, setFollowersCount] = useState(user.followers_count);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/users/${user.username}/follow`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.action === "followed");
        setFollowersCount(data.followers_count);
        router.refresh(); // Обновляем данные страницы
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-6 w-full">
      <div className="flex-1">
        <h1 className="text-3xl font-bold">{user.full_name || `@${user.username}`}</h1>
        {user.full_name && <p className="text-muted-foreground">@{user.username}</p>}
        <p className="text-muted-foreground mt-2 max-w-2xl whitespace-pre-wrap">
            {user.bio || "Пользователь пока ничего о себе не написал."}
        </p>
        
        {/* КНОПКИ ДЕЙСТВИЙ (Настройки или Подписка) */}
        <div className="mt-4 flex gap-3">
            {user.is_me ? (
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

      {/* Блок Статистики */}
      <div className="flex gap-4 p-4 bg-muted/30 rounded-lg border">
        {/* МЕМЫ */}
        <div className="text-center min-w-[80px]">
            <div className="font-bold text-2xl">{user.memes_count ?? 0}</div> 
            {/* Примечание: мемы мы считали на странице, нужно будет прокинуть число */}
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Мемов</div>
        </div>
        
        <div className="w-px bg-border my-1"></div>
        
        {/* ПОДПИСЧИКИ */}
        <Link href={`/user/${user.username}/followers`} className="text-center min-w-[80px] hover:bg-muted/50 rounded transition-colors cursor-pointer p-1 -m-1">
            <div className="font-bold text-2xl">{followersCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Подписчиков</div>
        </Link>
        
        <div className="w-px bg-border my-1"></div>
        
        {/* ПОДПИСКИ */}
        <Link href={`/user/${user.username}/following`} className="text-center min-w-[80px] hover:bg-muted/50 rounded transition-colors cursor-pointer p-1 -m-1">
            <div className="font-bold text-2xl">{user.following_count}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Подписок</div>
        </Link>
      </div>
    </div>
  );
}