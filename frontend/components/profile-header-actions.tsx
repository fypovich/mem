"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck, MoreVertical, Ban, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface ProfileHeaderActionsProps {
  user: any;
}

export function ProfileHeaderActions({ user }: ProfileHeaderActionsProps) {
  const [token, setToken] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  
  const [isFollowing, setIsFollowing] = useState(user?.is_following || false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    setCurrentUsername(localStorage.getItem("username"));
  }, []);

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
        window.location.reload(); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!confirm(`Вы уверены, что хотите заблокировать @${user.username}? Вы перестанете видеть его контент.`)) return;
    
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.id}/block`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Пользователь заблокирован");
        window.location.href = "/"; // Уходим с профиля заблокированного
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleBlock} className="text-red-600 focus:text-red-600 cursor-pointer">
            <Ban className="w-4 h-4 mr-2" />
            Заблокировать
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}