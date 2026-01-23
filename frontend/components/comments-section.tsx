"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Send, Loader2, MessageCircle } from "lucide-react"; // <--- ДОБАВИЛ MessageCircle
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const API_URL = "http://127.0.0.1:8000";

export function CommentsSection({ memeId }: { memeId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // Загружаем токен и комментарии
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("username");
    setToken(storedToken);
    setCurrentUser(storedUser);

    fetchComments();
  }, [memeId]);

  const fetchComments = async () => {
    try {
        const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/comments`);
        if (res.ok) {
            const data = await res.json();
            setComments(data);
        }
    } catch (e) {
        console.error("Failed to load comments");
    } finally {
        setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newComment.trim() || !token) return;
    setIsSending(true);

    try {
        const res = await fetch(`${API_URL}/api/v1/memes/${memeId}/comments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ text: newComment })
        });

        if (res.ok) {
            const addedComment = await res.json();
            // Добавляем новый комментарий в начало списка
            setComments([addedComment, ...comments]);
            setNewComment("");
        }
    } catch (e) {
        alert("Не удалось отправить комментарий");
    } finally {
        setIsSending(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-4 h-full min-h-[500px] flex flex-col">
        <h3 className="font-semibold mb-4">Комментарии ({comments.length})</h3>
        
        {/* Список комментариев */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[600px]">
            {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : comments.length > 0 ? (
                comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 text-sm">
                        <Link href={`/user/${comment.user.username}`}>
                            <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80">
                                <AvatarImage src={comment.user.avatar_url?.startsWith('http') ? comment.user.avatar_url : `${API_URL}${comment.user.avatar_url}`} />
                                <AvatarFallback>{comment.user.username[0]}</AvatarFallback>
                            </Avatar>
                        </Link>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <Link href={`/user/${comment.user.username}`} className="font-semibold hover:underline">
                                    @{comment.user.username}
                                </Link>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed break-words">{comment.text}</p>
                        </div>
                    </div>
                ))
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm text-center py-10 opacity-50">
                    <MessageCircle className="w-10 h-10 mb-2" />
                    Будьте первым, <br/>кто оставит комментарий!
                </div>
            )}
        </div>

        {/* Форма отправки */}
        <div className="mt-4 pt-4 border-t">
            {token ? (
                <div className="flex gap-2 items-end">
                    <Avatar className="w-8 h-8 hidden sm:block">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser}`} />
                        <AvatarFallback>ME</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 relative">
                        <Textarea 
                            placeholder="Написать комментарий..." 
                            className="min-h-[80px] resize-none pr-12"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                        />
                        <Button 
                            size="icon" 
                            className="absolute bottom-2 right-2 h-8 w-8" 
                            onClick={handleSend}
                            disabled={isSending || !newComment.trim()}
                        >
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            ) : (
                <Link href="/login">
                    <Button className="w-full" variant="secondary">Войти, чтобы комментировать</Button>
                </Link>
            )}
        </div>
    </div>
  );
}