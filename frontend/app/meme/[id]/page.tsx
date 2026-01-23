import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Eye, Hash, User as UserIcon } from "lucide-react"; // <-- Добавили иконки
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge"; // <-- Добавили Badge
import { MemeInteractions } from "@/components/meme-interactions"; 
import { CommentsSection } from "@/components/comments-section";

const API_URL = "http://127.0.0.1:8000";

async function getMeme(id: string) {
  const res = await fetch(`${API_URL}/api/v1/memes/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

type Params = Promise<{ id: string }>;

export default async function MemePage({ params }: { params: Params }) {
  const { id } = await params;
  const meme = await getMeme(id);

  if (!meme) return notFound();

  const mediaUrl = meme.media_url.startsWith("http") ? meme.media_url : `${API_URL}${meme.media_url}`;
  const avatarUrl = meme.user.avatar_url 
      ? (meme.user.avatar_url.startsWith("http") ? meme.user.avatar_url : `${API_URL}${meme.user.avatar_url}`)
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${meme.user.username}`;
  
  const date = new Date(meme.created_at).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
       <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
          
          {/* ЛЕВАЯ КОЛОНКА: Контент */}
          <div className="space-y-6">
             {/* Видео плеер */}
             <div className="rounded-xl overflow-hidden bg-black border border-border shadow-2xl relative aspect-video flex items-center justify-center">
                 <video 
                    src={mediaUrl} 
                    controls 
                    autoPlay 
                    loop 
                    className="w-full h-full max-h-[70vh] object-contain"
                 />
             </div>

             {/* Инфо блок */}
             <div className="space-y-4">
                 <h1 className="text-2xl md:text-3xl font-bold break-words">{meme.title}</h1>
                 
                 <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
                     {/* Автор */}
                     <Link href={`/user/${meme.user.username}`} className="flex items-center gap-3 group">
                        <Avatar className="w-10 h-10 border border-border group-hover:border-primary transition-colors">
                           <AvatarImage src={avatarUrl} />
                           <AvatarFallback>{meme.user.username[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                           <div className="font-semibold group-hover:text-primary transition-colors">@{meme.user.username}</div>
                           <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {date}
                              </div>
                              <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" /> {meme.views_count}
                              </div>
                           </div>
                        </div>
                     </Link>

                     <MemeInteractions 
                        memeId={meme.id} 
                        initialLikes={meme.likes_count} 
                        initialLiked={meme.is_liked}
                        commentsCount={meme.comments_count || 0} 
                     />
                 </div>
                 
                 {/* Описание + Теги */}
                 <div className="space-y-4">
                     {meme.description && (
                        <div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {meme.description}
                        </div>
                     )}

                     {/* --- БЛОК ТЕГОВ И ПЕРСОНАЖА --- */}
                     {(meme.tags.length > 0 || meme.subject) && (
                        <div className="flex flex-wrap gap-2">
                            {/* Персонаж */}
                            {meme.subject && (
                                <Link href={`/character/${meme.subject.slug}`}>
                                    <Badge variant="outline" className="px-3 py-1 gap-1 text-sm cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors">
                                        <UserIcon className="w-3 h-3" /> {meme.subject.name}
                                    </Badge>
                                </Link>
                            )}

                            {/* Теги */}
                            {meme.tags.map((tag: any) => (
                                <Link key={tag.name} href={`/tag/${tag.name}`}>
                                    <Badge variant="secondary" className="px-3 py-1 text-sm cursor-pointer hover:bg-primary hover:text-white transition-colors">
                                        #{tag.name}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                     )}
                     {/* ------------------------------- */}
                 </div>
             </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: Комментарии */}
          <div id="comments-section" className="hidden lg:block space-y-4">
              <CommentsSection memeId={meme.id} />
          </div>

          <div className="lg:hidden block space-y-4">
              <CommentsSection memeId={meme.id} />
          </div>

       </div>
    </div>
  );
}