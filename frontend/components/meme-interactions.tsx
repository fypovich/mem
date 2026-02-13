"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Share2, Flag, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface MemeInteractionsProps {
  memeId: string;
  initialLikes: number;
  initialLiked: boolean;
  authorUsername: string; // <-- Добавили, чтобы знать, кто автор
}

export function MemeInteractions({
  memeId,
  initialLikes,
  initialLiked,
  authorUsername
}: MemeInteractionsProps) {
  const router = useRouter();
  const { token, user, isLoading: authLoading } = useAuth();

  // --- STATES ---
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  const isOwner = user?.username === authorUsername;
  // До получения реального статуса используем SSR-значение, не показываем "liked" стиль
  const showLiked = statusLoaded ? isLiked : initialLiked;

  // Share
  const [isCopied, setIsCopied] = useState(false);

  // Report
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDesc, setReportDesc] = useState("");

  // --- INIT LOGIC ---
  useEffect(() => {
    if (authLoading) return;
    if (token) {
      fetch(`${API_URL}/api/v1/memes/${memeId}/status`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
         setIsLiked(data.is_liked);
         setStatusLoaded(true);
      })
      .catch(err => {
         console.error(err);
         setStatusLoaded(true);
      });
    } else {
      setStatusLoaded(true);
    }
  }, [memeId, token, authLoading]);

  const handleLike = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    if (isLikeLoading) return;

    const prevLikes = likes;
    const prevLiked = isLiked;

    setStatusLoaded(true);
    setIsLiked(!isLiked);
    setLikes(prevLiked ? prevLikes - 1 : prevLikes + 1);
    setIsLikeLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Ошибка");
      
      const data = await res.json();
      setLikes(data.likes_count);
      setIsLiked(data.action === "liked");

    } catch (error) {
      setLikes(prevLikes);
      setIsLiked(prevLiked);
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/meme/${memeId}`;
    
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Смотри какой мем!', url: url });
            return;
        } catch (err) {}
    }

    try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        alert("Не удалось скопировать");
    }
  };

  const handleReportSubmit = async () => {
    if (!token) {
        router.push("/login");
        return;
    }

    setIsReporting(true);
    try {
        const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/report`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ reason: reportReason, description: reportDesc })
        });

        if (res.ok) {
            setIsReportOpen(false);
            setReportDesc("");
            alert("Жалоба отправлена.");
        } else {
            alert("Ошибка при отправке");
        }
    } catch (e) {
        console.error(e);
        alert("Ошибка сети");
    } finally {
        setIsReporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-4 md:mt-0">
      
      {/* КНОПКА ЛАЙКА */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleLike}
        disabled={isLikeLoading}
        className={`gap-2 ${statusLoaded ? "transition-colors" : ""} ${showLiked ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20" : ""}`}
      >
        <Heart className={`w-4 h-4 ${showLiked ? "fill-current" : ""}`} />
        <span>{likes}</span>
      </Button>

      {/* КНОПКА ПОДЕЛИТЬСЯ */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground hover:text-white"
        onClick={handleShare}
      >
        {isCopied ? (
            <Check className="w-4 h-4 text-green-500" />
        ) : (
            <Share2 className="w-4 h-4" />
        )}
      </Button>
      
      {/* КНОПКА ПОЖАЛОВАТЬСЯ (скрывается только когда auth загружен И пользователь — автор) */}
      {!(statusLoaded && isOwner) && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-white"
            onClick={() => setIsReportOpen(true)}
          >
            <Flag className="w-4 h-4" />
          </Button>
      )}

      {/* МОДАЛЬНОЕ ОКНО */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Пожаловаться</DialogTitle>
                <DialogDescription>Сообщите о нарушении правил.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label>Причина</Label>
                    <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                    >
                        <option value="spam">Спам</option>
                        <option value="violence">Насилие</option>
                        <option value="porn">Порнография</option>
                        <option value="copyright">Авторские права</option>
                        <option value="other">Другое</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <Label>Комментарий</Label>
                    <Textarea 
                        placeholder="Опишите детали..."
                        value={reportDesc}
                        onChange={(e) => setReportDesc(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsReportOpen(false)}>Отмена</Button>
                <Button variant="destructive" onClick={handleReportSubmit} disabled={isReporting}>
                    {isReporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Отправить
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}