"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send, Loader2, MessageCircle, Reply, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const API_URL = "http://127.0.0.1:8000";

interface CommentsSectionProps {
  memeId: string;
}

// Тип для комментария с вложенностью
interface CommentData {
  id: string;
  text: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
  parent_id: string | null;
  replies?: CommentData[]; // Добавляем поле для вложенных
}

export function CommentsSection({ memeId }: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentData | null>(null); // На кого отвечаем
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    fetchComments();
  }, [memeId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/comments`);
      if (res.ok) {
        const flatComments: CommentData[] = await res.json();
        // Превращаем плоский список в дерево
        setComments(buildCommentTree(flatComments));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Хелпер для построения дерева комментариев
  const buildCommentTree = (flatComments: CommentData[]) => {
    const map: Record<string, CommentData> = {};
    const roots: CommentData[] = [];

    // Инициализируем replies массивом для всех
    flatComments.forEach(c => {
        map[c.id] = { ...c, replies: [] };
    });

    flatComments.forEach(c => {
        if (c.parent_id && map[c.parent_id]) {
            map[c.parent_id].replies?.push(map[c.id]);
        } else {
            roots.push(map[c.id]);
        }
    });
    
    // Сортируем корневые (новые сверху)
    return roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
        body: JSON.stringify({ 
            text, 
            parent_id: replyTo ? replyTo.id : null 
        }),
      });

      if (res.ok) {
        // Перезапрашиваем всё дерево для простоты обновления
        await fetchComments();
        setText("");
        setReplyTo(null);
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

  const handleReplyClick = (comment: CommentData) => {
    setReplyTo(comment);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  // Рекурсивный компонент для рендера ветки
  const CommentItem = ({ comment, level = 0 }: { comment: CommentData, level?: number }) => (
    <div className={cn("flex gap-3 w-full", level > 0 && "mt-4 pl-4 border-l-2 border-border/50")}>
        <Link href={`/user/${comment.user.username}`} className="shrink-0">
            <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage src={comment.user.avatar_url ? `${API_URL}${comment.user.avatar_url}` : undefined} />
                <AvatarFallback>{comment.user.username[0]}</AvatarFallback>
            </Avatar>
        </Link>
        
        <div className="flex-1 min-w-0">
            <div className="bg-secondary/30 rounded-lg p-3 group">
                <div className="flex justify-between items-baseline mb-1 gap-2">
                    <Link href={`/user/${comment.user.username}`} className="font-semibold text-xs hover:underline truncate max-w-[150px]">
                        {comment.user.username}
                    </Link>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(comment.created_at).toLocaleString("ru-RU", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                
                {/* ИСПРАВЛЕНИЕ CSS: 
                   break-words: переносит слова.
                   overflow-wrap: anywhere: агрессивно переносит ссылки и длинные строки.
                */}
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                    {comment.text}
                </p>

                {/* Кнопка "Ответить" */}
                {token && (
                    <button 
                        onClick={() => handleReplyClick(comment)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-primary mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Reply className="w-3 h-3" /> Ответить
                    </button>
                )}
            </div>

            {/* Рендер ответов (рекурсия) */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-2">
                    {comment.replies.map(reply => (
                        <CommentItem key={reply.id} comment={reply} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="bg-card border border-border/50 rounded-xl flex flex-col h-[600px] overflow-hidden w-full">
      
      {/* Шапка */}
      <div className="p-4 border-b flex-shrink-0 bg-card z-10">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Обсуждение
        </h3>
      </div>

      {/* Список */}
      <ScrollArea className="flex-1 w-full min-h-0">
        <div className="p-4 space-y-6">
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                    Комментариев пока нет
                </div>
            ) : (
                comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                ))
            )}
        </div>
      </ScrollArea>

      {/* Форма ввода */}
      <div className="p-3 border-t bg-background flex-shrink-0">
        {token ? (
            <div className="space-y-2">
                {replyTo && (
                    <div className="flex items-center justify-between bg-primary/10 text-primary text-xs px-3 py-1.5 rounded-md mb-2">
                        <span>Ответ <b>@{replyTo.user.username}</b>: {replyTo.text.substring(0, 30)}...</span>
                        <button onClick={() => setReplyTo(null)} className="hover:bg-primary/20 rounded p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                )}
                
                <div className="relative">
                    <Textarea
                        ref={textareaRef}
                        placeholder={replyTo ? "Напишите ответ..." : "Написать комментарий..."}
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