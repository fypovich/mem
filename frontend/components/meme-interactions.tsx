"use client";

import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, Flag, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface MemeInteractionsProps {
  memeId: string;
  initialLikes: number;
  initialLiked: boolean;
  commentsCount: number;
}

export function MemeInteractions({ 
  memeId, 
  initialLikes, 
  initialLiked,
  commentsCount
}: MemeInteractionsProps) {
  const router = useRouter();
  
  // --- STATES ---
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  
  // Share
  const [isCopied, setIsCopied] = useState(false);

  // Report
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDesc, setReportDesc] = useState("");

  // --- LIKE LOGIC ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${API_URL}/api/v1/memes/${memeId}/status`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
         setIsLiked(data.is_liked);
      })
      .catch(err => console.error(err));
    }
  }, [memeId]);

  const handleLike = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const prevLikes = likes;
    const prevLiked = isLiked;

    setIsLiked(!isLiked);
    setLikes(prevLiked ? prevLikes - 1 : prevLikes + 1);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Ошибка");
      
      const data = await res.json();
      setLikes(data.likes_count);
      setIsLiked(data.action === "liked");

    } catch (error) {
      setLikes(prevLikes);
      setIsLiked(prevLiked);
    } finally {
      setIsLoading(false);
    }
  };

  // --- SHARE LOGIC ---
  const handleShare = async () => {
    const url = `${window.location.origin}/meme/${memeId}`;
    
    // 1. Native Share (Mobile)
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Смотри какой мем!', url: url });
            return;
        } catch (err) {
            // Fallback to copy
        }
    }

    // 2. Copy to clipboard
    try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        alert("Не удалось скопировать");
    }
  };

  // --- REPORT LOGIC ---
  const handleReportSubmit = async () => {
    const token = localStorage.getItem("token");
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
                "Authorization": `Bearer ${token}`
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

  const scrollToComments = () => {
      const commentsSection = document.getElementById("comments-section");
      if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: "smooth" });
      }
  };

  return (
    <div className="flex items-center gap-2 mt-4 md:mt-0">
      
      {/* LIKE */}
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={handleLike}
        disabled={isLoading}
        className={`gap-2 transition-colors ${isLiked ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20" : ""}`}
      >
        <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
        <span>{likes}</span>
      </Button>

      {/* COMMENTS */}
      <Button variant="secondary" size="sm" className="gap-2" onClick={scrollToComments}>
        <MessageCircle className="w-4 h-4" />
        <span>{commentsCount}</span>
      </Button>

      {/* SHARE */}
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
      
      {/* REPORT FLAG */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground hover:text-white"
        onClick={() => setIsReportOpen(true)}
      >
        <Flag className="w-4 h-4" />
      </Button>

      {/* REPORT MODAL */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Пожаловаться</DialogTitle>
                <DialogDescription>
                    Сообщите о нарушении правил.
                </DialogDescription>
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