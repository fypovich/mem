"use client";

import React, { useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface MemeInteractionsProps {
  memeId: string;
  initialLikes: number;
  initialLiked: boolean;
  commentsCount: number; // Теперь это число приходит правильным
}

export function MemeInteractions({ 
  memeId, 
  initialLikes, 
  initialLiked,
  commentsCount
}: MemeInteractionsProps) {
  const router = useRouter();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);

  // Проверяем статус лайка (НЕ НАКРУЧИВАЯ ПРОСМОТРЫ)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Используем новый легкий эндпоинт /status
      fetch(`http://127.0.0.1:8000/api/v1/memes/${memeId}/status`, {
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
      const res = await fetch(`http://127.0.0.1:8000/api/v1/memes/${memeId}/like`, {
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

  const scrollToComments = () => {
      const commentsSection = document.getElementById("comments-section");
      if (commentsSection) {
          commentsSection.scrollIntoView({ behavior: "smooth" });
      }
  };

  return (
    <div className="flex items-center gap-2 mt-4 md:mt-0">
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

      {/* Кнопка комментариев теперь просто скроллит к блоку комментариев */}
      <Button variant="secondary" size="sm" className="gap-2" onClick={scrollToComments}>
        <MessageCircle className="w-4 h-4" />
        <span>{commentsCount}</span>
      </Button>

      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
        <Share2 className="w-4 h-4" />
      </Button>
      
       <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
        <Flag className="w-4 h-4" />
      </Button>
    </div>
  );
}