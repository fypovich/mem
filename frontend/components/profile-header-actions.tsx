"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck, MoreVertical, Ban, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface ProfileHeaderActionsProps {
  user: any;
}

export function ProfileHeaderActions({ user }: ProfileHeaderActionsProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  
  const [isFollowing, setIsFollowing] = useState(user?.is_following || false);
  const [isBlocked, setIsBlocked] = useState(user?.is_blocked || false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("username");
    setToken(t);
    setCurrentUsername(u);

    if (t && user?.username) {
        fetch(`${API_URL}/api/v1/users/${user.username}`, {
            headers: { "Authorization": `Bearer ${t}` }
        })
        .then(res => res.json())
        .then(data => {
            setIsFollowing(data.is_following);
            setIsBlocked(data.is_blocked);
        })
        .catch(err => console.error("Error refreshing user state:", err));
    }
  }, [user?.username]);

  if (!user || currentUsername === user.username) {
    return null;
  }

  const handleFollow = async () => {
    if (!token || isLoading) return;
    
    // 1. OPTIMISTIC UPDATE: Меняем UI сразу
    const previousState = isFollowing;
    setIsFollowing(!previousState);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.username}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error("Failed to follow");
      }
      
      // Данные успешно обновлены на сервере
      // router.refresh(); // Можно вызвать refresh, но UI уже обновлен
    } catch (e) {
      console.error(e);
      // 2. ROLLBACK: Если ошибка, возвращаем состояние назад
      setIsFollowing(previousState);
      alert("Не удалось изменить подписку");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!confirm(`Вы уверены, что хотите заблокировать @${user.username}?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.id}/block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsBlocked(true);
        setIsFollowing(false);
        alert("Пользователь заблокирован");
        window.location.href = "/";
      }
    } catch (e) {
      alert("Ошибка сети");
    }
  };

  const handleUnblock = async () => {
    if (!confirm(`Разблокировать @${user.username}?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.id}/unblock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsBlocked(false);
        alert("Пользователь разблокирован");
      }
    } catch (e) {
      alert("Ошибка сети");
    }
  };

  return (
    <div className="flex gap-2">
      <Button 
        variant={isFollowing ? "outline" : "default"} 
        size="sm" 
        onClick={handleFollow}
        disabled={!token || isBlocked}
        className="min-w-[140px] transition-all duration-200"
      >
        {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
        ) : isFollowing ? (
            <>
                <UserCheck className="w-4 h-4 mr-2" /> Вы подписаны
            </>
        ) : (
            <>
                <UserPlus className="w-4 h-4 mr-2" /> Подписаться
            </>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isBlocked ? (
             <DropdownMenuItem onClick={handleUnblock} className="cursor-pointer text-green-600 focus:text-green-600">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Разблокировать
             </DropdownMenuItem>
          ) : (
             <DropdownMenuItem onClick={handleBlock} className="text-red-600 focus:text-red-600 cursor-pointer">
                <Ban className="w-4 h-4 mr-2" />
                Заблокировать
             </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}