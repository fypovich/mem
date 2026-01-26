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
    // ГЛАВНЫЙ КОНТЕЙНЕР
    // h-[600px]: Фиксированная высота
    // overflow-hidden: Обрезает всё лишнее, чтобы скругления углов работали
    <div className="bg-card border border-border/50 rounded-xl flex flex-col h-[600px] overflow-hidden w-full">
      
      {/* ЗАГОЛОВОК (Фиксированный, не скроллится) */}
      <div className="p-4 border-b flex-shrink-0 bg-card z-10">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Комментарии ({comments.length})
        </h3>
      </div>

      {/* ЗОНА СКРОЛЛА (Растягивается) */}
      {/* flex-1 min-h-0: Ключевая связка. Заставляет блок занимать только доступное место и включать скролл */}
      <ScrollArea className="flex-1 w-full min-h-0">
        <div className="p-4 space-y-4">
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                    Пока нет комментариев. Будьте первым!
                </div>
            ) : (
                comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 w-full max-w-full">
                        {/* Аватарка (не сжимается) */}
                        <Link href={`/user/${comment.user.username}`} className="shrink-0">
                            <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                                <AvatarImage src={comment.user.avatar_url ? `${API_URL}${comment.user.avatar_url}` : undefined} />
                                <AvatarFallback>{comment.user.username[0]}</AvatarFallback>
                            </Avatar>
                        </Link>
                        
                        {/* ТЕКСТ КОММЕНТАРИЯ */}
                        {/* min-w-0: Позволяет flex-элементу сжиматься, если текст внутри слишком длинный */}
                        <div className="flex-1 min-w-0">
                            <div className="bg-secondary/30 rounded-lg p-3">
                                <div className="flex justify-between items-baseline mb-1 gap-2">
                                    <Link href={`/user/${comment.user.username}`} className="font-semibold text-xs hover:underline truncate max-w-[150px]">
                                        {comment.user.username}
                                    </Link>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                
                                {/* break-words: Переносит длинные слова */}
                                {/* whitespace-pre-wrap: Сохраняет абзацы */}
                                <p className="text-sm text-foreground break-words whitespace-pre-wrap leading-relaxed">
                                    {comment.text}
                                </p>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </ScrollArea>

      {/* ПОЛЕ ВВОДА (Фиксированное внизу) */}
      <div className="p-3 border-t bg-background flex-shrink-0">
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