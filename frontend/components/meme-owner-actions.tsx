"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MoreVertical, Edit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface MemeOwnerActionsProps {
  memeId: string;
  authorUsername: string;
  // Передаем текущие данные для предзаполнения формы
  initialTitle?: string;
  initialDescription?: string;
  initialTags?: any[];
}

export function MemeOwnerActions({ memeId, authorUsername, initialTitle="", initialDescription="", initialTags=[] }: MemeOwnerActionsProps) {
  const router = useRouter();
  const { token, user, isLoading: authLoading } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  // Состояния для редактирования
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: initialTitle,
    description: initialDescription,
    tags: initialTags.map(t => t.name).join(", ")
  });

  const isOwner = !authLoading && user && user.username === authorUsername;

  if (!isOwner) {
    return null;
  }

  const handleDelete = async () => {
    if (!confirm("Вы точно хотите удалить этот мем? Это действие нельзя отменить.")) {
        return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        router.push(`/user/${authorUsername}`);
        router.refresh();
      } else {
        alert("Не удалось удалить мем");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            title: editForm.title,
            description: editForm.description,
            tags: editForm.tags 
        }),
      });

      if (res.ok) {
        setIsEditOpen(false);
        router.refresh(); // Обновляем страницу, чтобы увидеть новые данные
      } else {
        alert("Ошибка при обновлении");
      }
    } catch (e) {
        console.error(e);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditOpen(true)} className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
            </DropdownMenuItem>
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

        {/* Модальное окно редактирования */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Редактировать мем</DialogTitle>
                    <DialogDescription>
                        Измените заголовок, описание или теги.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="edit-title">Заголовок</Label>
                        <Input 
                            id="edit-title" 
                            value={editForm.title} 
                            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-desc">Описание</Label>
                        <Textarea 
                            id="edit-desc" 
                            value={editForm.description || ""} 
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-tags">Теги (через запятую)</Label>
                        <Input 
                            id="edit-tags" 
                            value={editForm.tags} 
                            placeholder="юмор, коты, игры"
                            onChange={(e) => setEditForm({...editForm, tags: e.target.value})}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditOpen(false)}>Отмена</Button>
                    <Button onClick={handleUpdate} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}