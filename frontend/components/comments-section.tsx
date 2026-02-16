"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send, Loader2, MessageCircle, Reply, X, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface CommentsSectionProps {
  memeId: string;
}

interface CommentData {
  id: string;
  text: string;
  created_at: string;
  user: {
    username: string;
    full_name?: string | null;
    avatar_url: string | null;
  };
  parent_id: string | null;
  replies?: CommentData[];
  parent_username?: string;
}

export function CommentsSection({ memeId }: CommentsSectionProps) {
  const { token, isLoading: authLoading } = useAuth();
  const [comments, setComments] = useState<CommentData[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
  }, [memeId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/comments`);
      if (res.ok) {
        const flatComments: CommentData[] = await res.json();
        setComments(buildCommentTree(flatComments));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const buildCommentTree = (flatComments: CommentData[]) => {
    const map: Record<string, CommentData> = {};
    const roots: CommentData[] = [];

    flatComments.forEach(c => {
        map[c.id] = { ...c, replies: [] };
    });

    flatComments.forEach(c => {
        if (c.parent_id && map[c.parent_id]) {
            map[c.id].parent_username = map[c.parent_id].user.username;
            map[c.parent_id].replies?.push(map[c.id]);
        } else {
            roots.push(map[c.id]);
        }
    });
    
    // Сортировка: новые корневые сверху
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

  // Рекурсивный компонент
  const CommentItem = ({ comment, level = 0 }: { comment: CommentData, level?: number }) => {
    // ЛОГИКА 2 УРОВНЕЙ:
    // Уровень 0: Корневой.
    // Уровень 1+: Вложенный.
    // Если мы уже на уровне 1 или глубже, мы НЕ добавляем больше отступов для детей.
    // pl-11 (44px) = 32px (avatar) + 12px (gap) -> выравнивает ответы по тексту родителя.
    const childrenContainerClass = level === 0 ? "pl-11" : "pl-0";

    return (
      <div className={cn("flex flex-col w-full", level > 0 ? "mt-3" : "mt-6 first:mt-0")}>
        {/* Ряд: Аватар + Контент */}
        <div className="flex gap-3 w-full group">
            <Link href={`/user/${comment.user.username}`} className="shrink-0 pt-1">
                <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={comment.user.avatar_url ? `${API_URL}${comment.user.avatar_url}` : undefined} />
                    <AvatarFallback>{comment.user.username[0]}</AvatarFallback>
                </Avatar>
            </Link>
            
            <div className="flex-1 min-w-0 relative">
                <div className="bg-secondary/20 rounded-lg p-3">
                    
                    {/* 1. Дата над ником */}
                    <div className="text-[10px] text-muted-foreground/70 mb-0.5 font-medium">
                        {new Date(comment.created_at).toLocaleString("ru-RU", { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <Link href={`/user/${comment.user.username}`} className="font-bold text-sm hover:underline text-foreground">
                            {comment.user.full_name || comment.user.username}
                        </Link>
                        {comment.user.full_name && (
                            <span className="text-xs text-muted-foreground">@{comment.user.username}</span>
                        )}
                        
                        {/* 3. Кому отвечаем (визуально помогает в плоской структуре) */}
                        {comment.parent_username && (
                            <div className="flex items-center text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded-md">
                                <CornerDownRight className="w-3 h-3 mr-1 opacity-50" />
                                <span>{comment.parent_username}</span>
                            </div>
                        )}
                    </div>
                    
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>
                        {comment.text}
                    </p>
                </div>

                {/* Кнопка "Ответить" (вне блока, под текстом) */}
                {token && (
                    <button 
                        onClick={() => handleReplyClick(comment)}
                        className="text-[11px] font-medium text-muted-foreground hover:text-primary mt-1 ml-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Reply className="w-3 h-3" /> Ответить
                    </button>
                )}
            </div>
        </div>

        {/* Рендер ответов (Вне flex-ряда родителя, чтобы контролировать отступ) */}
        {comment.replies && comment.replies.length > 0 && (
            <div className={cn("w-full border-l-2 border-transparent", childrenContainerClass)}>
                {/* Для уровня 0 добавляем небольшой бордер слева для ветки,
                   но для уровня 1+ бордер не нужен, так как они идут плоско.
                */}
                <div className={cn(level === 0 ? "border-l-2 border-border/40 pl-3 -ml-[1px]" : "")}>
                    {comment.replies.map(reply => (
                        <CommentItem key={reply.id} comment={reply} level={level + 1} />
                    ))}
                </div>
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl flex flex-col h-[600px] overflow-hidden w-full shadow-sm">
      <div className="p-4 border-b flex-shrink-0 bg-muted/20 z-10 flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> Обсуждение
        </h3>
        <span className="text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded border">
            {comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)} коммент.
        </span>
      </div>

      <ScrollArea className="flex-1 w-full min-h-0">
        <div className="p-4">
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
                </div>
            ) : comments.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                    <div className="p-4 bg-secondary/30 rounded-full">
                        <MessageCircle className="w-8 h-8 opacity-40" />
                    </div>
                    <p className="text-sm">Комментариев пока нет.<br/>Станьте первым, кто начнет дискуссию!</p>
                </div>
            ) : (
                // Контейнер списка
                <div className="flex flex-col pb-4">
                    {comments.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))}
                </div>
            )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-background flex-shrink-0">
        {authLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-[80px] w-full rounded-md" />
                <Skeleton className="h-3 w-16 ml-auto rounded" />
            </div>
        ) : token ? (
            <div className="space-y-2">
                {replyTo && (
                    <div className="flex items-center justify-between bg-primary/10 text-primary text-xs px-3 py-2 rounded-md border border-primary/20 animate-in slide-in-from-bottom-2 fade-in">
                        <span className="flex items-center gap-1 truncate max-w-[85%]">
                            <Reply className="w-3 h-3 shrink-0" /> 
                            <span className="truncate">Ответ <b>@{replyTo.user.username}</b>: {replyTo.text}</span>
                        </span>
                        <button onClick={() => setReplyTo(null)} className="hover:bg-primary/20 rounded-full p-1 transition-colors">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                
                <div className="relative group">
                    <Textarea
                        ref={textareaRef}
                        placeholder={replyTo ? "Ваш ответ..." : "Написать комментарий..."}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={500}
                        className="min-h-[80px] pr-12 resize-none bg-secondary/20 focus-visible:ring-primary/20 border-transparent focus:border-primary/30 transition-all text-sm"
                    />
                    <Button 
                        size="icon" 
                        className={cn("absolute bottom-3 right-3 h-8 w-8 rounded-full shadow-sm transition-all", text.trim() ? "scale-100 opacity-100" : "scale-90 opacity-70")} 
                        onClick={handleSend}
                        disabled={!text.trim() || isSending}
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
                <div className="text-[10px] text-muted-foreground text-right px-1 tabular-nums">
                    {text.length}/500
                </div>
            </div>
        ) : (
            <div className="text-center p-4 bg-muted/30 rounded-lg text-sm border border-dashed">
                <Link href="/login" className="text-primary hover:underline font-bold">Войдите</Link>, чтобы присоединиться к обсуждению
            </div>
        )}
      </div>
    </div>
  );
}