import React from "react";
import Link from "next/link";
import { MapPin, Link as LinkIcon, Calendar, Play, Heart, MessageCircle, Volume2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ProfileHeaderActions } from "@/components/profile-header-actions";
import { ProfileSettingsButton } from "@/components/profile-settings-button"; // <-- Новый компонент

import { cookies } from "next/headers";

const API_URL = "http://127.0.0.1:8000";

async function getUserProfile(username: string) {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_URL}/api/v1/users/${username}`, { 
            cache: "no-store",
            headers: headers 
        });
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        return null;
    }
}

async function getUserMemes(username: string) {
    try {
        const res = await fetch(`${API_URL}/api/v1/memes/?username=${username}&limit=100`, { cache: "no-store" });
        if (!res.ok) return [];
        return res.json();
    } catch (e) {
        return [];
    }
}

async function getUserLikedMemes(username: string) {
    try {
        const res = await fetch(`${API_URL}/api/v1/memes/?liked_by=${username}&limit=100`, { cache: "no-store" });
        if (!res.ok) return [];
        return res.json();
    } catch (e) {
        return [];
    }
}

type Params = Promise<{ username: string }>;

export default async function ProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);
  
  const [userProfile, memes, likedMemes] = await Promise.all([
      getUserProfile(decodedUsername),
      getUserMemes(decodedUsername),
      getUserLikedMemes(decodedUsername)
  ]);

  if (!userProfile) {
      return <div className="text-center py-20">Пользователь не найден 404</div>;
  }

  const avatarUrl = userProfile.avatar_url 
    ? (userProfile.avatar_url.startsWith("http") ? userProfile.avatar_url : `${API_URL}${userProfile.avatar_url}`)
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.username}`;

  const headerUrl = userProfile.header_url
    ? (userProfile.header_url.startsWith("http") ? userProfile.header_url : `${API_URL}${userProfile.header_url}`)
    : null;

  const joinDate = new Date(userProfile.created_at).toLocaleDateString("ru-RU", {
    month: 'long',
    year: 'numeric'
  });

  // Grid Component
  const MemeGrid = ({ items }: { items: any[] }) => {
      if (items.length === 0) {
          return (
            <div className="text-center py-20 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                <p>Здесь пока пусто 😔</p>
            </div>
          );
      }

      return (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {items.map((meme: any) => {
                const preview = meme.thumbnail_url.startsWith('http') ? meme.thumbnail_url : `${API_URL}${meme.thumbnail_url}`;
                return (
                <Link href={`/meme/${meme.id}`} key={meme.id} className="block break-inside-avoid">
                    <div className="group relative rounded-xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 bg-stone-900 border border-border/50">
                        <div className="w-full relative">
                            <img src={preview} alt={meme.title} className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 min-h-[150px]" loading="lazy"/>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="bg-black/30 p-3 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300">
                                    <Play className="w-8 h-8 text-white fill-white" />
                                </div>
                            </div>
                            <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <Volume2 className="w-3 h-3 text-white" />
                            </div>
                            <Badge className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/70 text-white text-[10px] border-0">
                                {meme.duration ? Math.round(meme.duration) + "s" : "GIF"}
                            </Badge>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                            <h3 className="text-white font-bold text-lg leading-tight line-clamp-2 drop-shadow-md">{meme.title}</h3>
                            <div className="flex items-center justify-between mt-3 text-white/80">
                                <div className="text-xs">{meme.views_count} просмотров</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1"><Heart className="w-4 h-4" /> <span className="text-xs">{meme.likes_count}</span></div>
                                    <div className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> <span className="text-xs">{meme.comments_count}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Link>
                );
            })}
        </div>
      );
  };

  return (
    <div className="w-full container max-w-6xl mx-auto px-4 py-6">
      
      {/* --- БЛОК ПРОФИЛЯ --- */}
      <div className="relative mb-8 rounded-xl overflow-hidden border border-border bg-card">
        
        {/* Баннер */}
        <div className="h-40 md:h-64 w-full relative bg-stone-900">
             {headerUrl ? (
                <img src={headerUrl} alt="Header" className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900" />
             )}
             
             {/* Вставляем кнопку настроек (она сама решит, показываться или нет) */}
             <ProfileSettingsButton username={userProfile.username} />
        </div>

        {/* Инфо-блок */}
        <div className="px-6 pb-6 pt-0 relative">
            <div className="flex justify-between items-end -mt-16 mb-4">
                <Avatar className="w-32 h-32 border-4 border-card shadow-xl bg-card">
                    <AvatarImage src={avatarUrl} className="object-cover" />
                    <AvatarFallback className="text-3xl font-bold">{userProfile.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
            </div>

            {/* Хедер с информацией и кнопкой подписки */}
            <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Передаем memes.length как prop */}
                <ProfileHeaderActions user={userProfile} memesCount={memes.length} />
            </div>
            
            {/* Доп. инфо */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1 hover:text-primary transition-colors cursor-default">
                    <MapPin className="w-4 h-4" /> Internet
                </div>
                {userProfile.website && (
                    <Link href={userProfile.website} target="_blank" className="flex items-center gap-1 text-blue-400 hover:underline">
                        <LinkIcon className="w-4 h-4" /> {userProfile.website.replace(/^https?:\/\//, '')}
                    </Link>
                )}
                <div className="flex items-center gap-1 capitalize">
                    <Calendar className="w-4 h-4" /> С нами: {joinDate}
                </div>
            </div>

        </div>
      </div>

      {/* --- ТАБЫ --- */}
      <Tabs defaultValue="memes" className="w-full">
        <TabsList className="w-full justify-start h-12 bg-transparent border-b rounded-none p-0 gap-8 mb-6">
          <TabsTrigger value="memes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-3 text-base font-medium">
              Мои мемы
          </TabsTrigger>
          <TabsTrigger value="liked" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-3 text-base font-medium">
              Избранное
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="memes">
            <MemeGrid items={memes} />
        </TabsContent>
        
        <TabsContent value="liked">
            <MemeGrid items={likedMemes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}