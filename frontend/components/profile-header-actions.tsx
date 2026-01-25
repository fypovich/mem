"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_URL = "http://127.0.0.1:8000";

interface ProfileHeaderActionsProps {
  user: any; // Принимаем объект пользователя целиком
}

export function ProfileHeaderActions({ user }: ProfileHeaderActionsProps) {
  const [token, setToken] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  
  // Используем user?.is_following для безопасности
  const [isFollowing, setIsFollowing] = useState(user?.is_following || false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    setCurrentUsername(localStorage.getItem("username"));
  }, []);

  // Если пользователя нет или это мы сами - ничего не рендерим
  if (!user || currentUsername === user.username) {
    return null;
  }

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
        // Перезагрузка для обновления счетчиков на странице (самый простой способ синхронизации)
        window.location.reload(); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant={isFollowing ? "outline" : "default"} 
      size="sm" 
      onClick={handleFollow}
      disabled={!token || isLoading}
      className="min-w-[140px]"
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
  );
}