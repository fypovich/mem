"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileHeaderActionsProps {
  user: any;        
  memesCount: number;
}

export function ProfileHeaderActions({ user, memesCount }: ProfileHeaderActionsProps) {
  const router = useRouter();
  
  // Инициализируем состояние данными с сервера (они могут быть устаревшими для авторизованного юзера)
  const [isFollowing, setIsFollowing] = useState(user.is_following);
  const [followersCount, setFollowersCount] = useState(user.followers_count || 0);
  const [isLoading, setIsLoading] = useState(false);
  
  // isMe вычисляем на клиенте
  const [isMe, setIsMe] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // 1. Проверяем, мой ли это профиль
    const storedUsername = localStorage.getItem("username");
    if (storedUsername === user.username) {
        setIsMe(true);
    }

    // 2. ВАЖНО: Проверяем актуальный статус подписки
    // Сервер (SSR) не видит localStorage, поэтому он мог вернуть is_following = false.
    // Мы должны перепроверить это на клиенте, если есть токен.
    const checkFollowStatus = async () => {
        const token = localStorage.getItem("token");
        // Если токена нет или это мой профиль - проверять нечего
        if (!token || storedUsername === user.username) return;

        try {
            const res = await fetch(`http://127.0.0.1:8000/api/v1/users/${user.username}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (res.ok) {
                const freshData = await res.json();
                // Обновляем кнопку, если данные отличаются
                setIsFollowing(freshData.is_following);
                // Заодно можно обновить и счетчик
                setFollowersCount(freshData.followers_count);
            }
        } catch (e) {
            console.error("Failed to check status", e);
        }
    };

    checkFollowStatus();

  }, [user.username]);

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
        <h1 className="text-3xl font-bold">{user.full_name || `@${user.username}`}</h1>
        {user.full_name && <p className="text-muted-foreground">@{user.username}</p>}
        
        <p className="text-muted-foreground mt-2 max-w-2xl whitespace-pre-wrap">
            {user.bio || "Пользователь пока ничего о себе не написал."}
        </p>
        
        <div className="mt-4 flex gap-3 min-h-[36px]">
            {/* Рендерим кнопку только после того, как JS загрузился (isMounted), 
                чтобы избежать гидратации и мигания */}
            {isMounted && !isMe && (
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
        
        <Link href={`/user/${user.username}/followers`} className="text-center min-w-[80px] hover:bg-muted/50 rounded transition-colors cursor-pointer p-1 -m-1">
            <div className="font-bold text-2xl">{followersCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Подписчиков</div>
        </Link>
        
        <div className="w-px bg-border my-1"></div>
        
        <Link href={`/user/${user.username}/following`} className="text-center min-w-[80px] hover:bg-muted/50 rounded transition-colors cursor-pointer p-1 -m-1">
            <div className="font-bold text-2xl">{user.following_count || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Подписок</div>
        </Link>
      </div>

    </div>
  );
}