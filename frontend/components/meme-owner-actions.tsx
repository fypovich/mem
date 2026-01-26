"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface MemeOwnerActionsProps {
  memeId: string;
  authorUsername: string;
}

export function MemeOwnerActions({ memeId, authorUsername }: MemeOwnerActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Исправление Hydration Error:
  // Проверяем localStorage только после того, как компонент смонтирован в браузере.
  useEffect(() => {
    const currentUsername = localStorage.getItem("username");
    if (currentUsername === authorUsername) {
      setIsOwner(true);
    }
  }, [authorUsername]);

  // Если не владелец, ничего не рендерим
  if (!isOwner) {
    return null;
  }

  const handleDelete = async () => {
    if (!confirm("Вы точно хотите удалить этот мем? Это действие нельзя отменить.")) {
        return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // После удаления перекидываем в профиль
        router.push(`/user/${authorUsername}`);
        router.refresh();
      } else {
        alert("Не удалось удалить мем");
        setIsDeleting(false);
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
      setIsDeleting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          className="text-red-600 focus:text-red-600 cursor-pointer"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? "Удаление..." : "Удалить"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}