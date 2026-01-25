"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { UserPlus, UserCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = "http://127.0.0.1:8000";

interface ProfileHeaderActionsProps {
  user: any; // Принимаем объект пользователя
}

export function ProfileHeaderActions({ user }: ProfileHeaderActionsProps) {
  const [token, setToken] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  
  // Инициализируем безопасным способом
  const [isFollowing, setIsFollowing] = useState(user?.is_following || false);
  const [followersCount, setFollowersCount] = useState(user?.followers_count || 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("username");
    setToken(t);
    setCurrentUsername(u);
  }, []);

  // Если это свой профиль или юзер не авторизован - показываем просто статы (или кнопку настроек в другом месте)
  // Но кнопка настроек у нас отдельным компонентом, так что тут логика подписки.
  
  const isMe = currentUsername === user.username;

  const handleFollow = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.username}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.is_following);
        // Опционально можно обновлять счетчик, если бэкенд его возвращает
        if (data.is_following) setFollowersCount((prev: number) => prev + 1);
        else setFollowersCount((prev: number) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-3 mt-4 sm:mt-0">
      <div className="flex gap-4 text-sm font-medium items-center mr-4">
        <Link href={`/user/${user.username}/followers`} className="hover:underline cursor-pointer">
            <span className="font-bold">{followersCount}</span> <span className="text-muted-foreground">подписчиков</span>
        </Link>
        <Link href={`/user/${user.username}/following`} className="hover:underline cursor-pointer">
            <span className="font-bold">{user.following_count || 0}</span> <span className="text-muted-foreground">подписок</span>
        </Link>
      </div>

      {!isMe && (
        <>
          <Button 
            variant={isFollowing ? "outline" : "default"} 
            size="sm" 
            onClick={handleFollow}
            disabled={!token || isLoading}
          >
            {isFollowing ? (
                <>
                    <UserCheck className="w-4 h-4 mr-2" /> Вы подписаны
                </>
            ) : (
                <>
                    <UserPlus className="w-4 h-4 mr-2" /> Подписаться
                </>
            )}
          </Button>
          
          {/* Кнопка сообщения (заглушка) */}
          {/* <Button variant="secondary" size="sm">
            <MessageSquare className="w-4 h-4" />
          </Button> */}
        </>
      )}
    </div>
  );
}