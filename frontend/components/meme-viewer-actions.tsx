"use client";

import React, { useState, useEffect } from "react";
import { MoreVertical, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Убедитесь, что этот компонент есть, или используйте обычный select

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface MemeViewerActionsProps {
  memeId: string;
  authorUsername: string;
}

export function MemeViewerActions({ memeId, authorUsername }: MemeViewerActionsProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [reason, setReason] = useState("spam");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const currentUsername = localStorage.getItem("username");
    if (currentUsername === authorUsername) {
      setIsOwner(true);
    }
  }, [authorUsername]);

  if (isOwner) return null; // Если это владелец, он видит MemeOwnerActions, этот скрываем

  const handleReport = async () => {
    setIsSending(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
          alert("Нужно войти в аккаунт");
          return;
      }

      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason, description }),
      });

      if (res.ok) {
        setIsReportOpen(false);
        alert("Жалоба отправлена. Спасибо!");
        setDescription("");
      } else {
        alert("Ошибка при отправке");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsReportOpen(true)} className="text-red-600 focus:text-red-600 cursor-pointer">
            <Flag className="mr-2 h-4 w-4" />
            Пожаловаться
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пожаловаться на контент</DialogTitle>
            <DialogDescription>
              Опишите причину жалобы. Наши модераторы проверят этот мем.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
                <Label>Причина</Label>
                {/* Если у вас нет компонента Select из shadcn, используйте обычный <select> */}
                <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                >
                    <option value="spam">Спам</option>
                    <option value="violence">Насилие</option>
                    <option value="porn">Порнография</option>
                    <option value="copyright">Авторские права</option>
                    <option value="other">Другое</option>
                </select>
            </div>
            
            <div className="space-y-2">
                <Label>Комментарий (опционально)</Label>
                <Textarea 
                    placeholder="Дополнительные детали..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleReport} disabled={isSending}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}