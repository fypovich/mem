"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_URL = "http://127.0.0.1:8000";

interface CommentsSectionProps {
  memeId: string;
}

export function CommentsSection({ memeId }: CommentsSectionProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    fetchComments();
  }, [memeId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/comments`);
      if (res.ok) {
        setComments(await res.json());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !token) return;
    
    setIsSending(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setComments([newComment, ...comments]);
        setText("");
      } else {
        const err = await res.json();
        alert(err.detail || "Ошибка отправки");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  return (
    // ИСПРАВЛЕНИЕ 2: Фиксированная высота h-[600px] вместо max-h. 
    // Это заставит ScrollArea работать корректно внутри flex-контейнера.
    <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col h-[600px]">
      <h3 className="font-semibold mb-4 flex items-center gap-2 flex-shrink-0">
        <MessageCircle className="w-4 h-4" /> Комментарии ({comments.length})
      </h3>

      {/* Список комментариев */}
      <ScrollArea className="flex-1 w-full pr-4 -mr-2 mb-4">
        {isLoading ? (
            <div className="flex justify-center py-8">
                <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
            </div>
        ) : comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
                Пока нет комментариев. Будьте первым!
            </div>
        ) : (
            <div className="space-y-4">
                {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 items-start w-full">
                        <Link href={`/user/${comment.user.username}`} className="shrink-0">
                            <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                                <AvatarImage src={comment.user.avatar_url ? `${API_URL}${comment.user.avatar_url}` : undefined} />
                                <AvatarFallback>{comment.user.username[0]}</AvatarFallback>
                            </Avatar>
                        </Link>
                        
                        {/* ИСПРАВЛЕНИЕ 1: min-w-0 и w-full заставляют flex-элемент уважать границы родителя */}
                        <div className="flex-1 min-w-0 w-full">
                            <div className="bg-secondary/30 rounded-lg p-3">
                                <div className="flex justify-between items-baseline mb-1 gap-2">
                                    <Link href={`/user/${comment.user.username}`} className="font-semibold text-xs hover:underline truncate max-w-[150px]">
                                        {comment.user.username}
                                    </Link>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                
                                {/* break-words переносит слова, whitespace-pre-wrap сохраняет абзацы */}
                                <p className="text-sm text-foreground break-words whitespace-pre-wrap leading-relaxed overflow-hidden">
                                    {comment.text}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </ScrollArea>

      {/* Форма отправки (прибита к низу благодаря flex-col и flex-1 у списка) */}
      <div className="flex-shrink-0 pt-2">
        {token ? (
            <div className="space-y-2">
                <div className="relative">
                    <Textarea
                        placeholder="Написать комментарий..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={500}
                        className="min-h-[80px] pr-12 resize-none bg-background focus-visible:ring-primary/20"
                    />
                    <Button 
                        size="icon" 
                        className="absolute bottom-2 right-2 h-8 w-8 rounded-full" 
                        onClick={handleSend}
                        disabled={!text.trim() || isSending}
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
                <div className="text-[10px] text-muted-foreground text-right px-1">
                    {text.length}/500
                </div>
            </div>
        ) : (
            <div className="text-center p-4 bg-secondary/20 rounded-lg text-sm">
                <Link href="/login" className="text-primary hover:underline font-medium">Войдите</Link>, чтобы оставить комментарий
            </div>
        )}
      </div>
    </div>
  );
}