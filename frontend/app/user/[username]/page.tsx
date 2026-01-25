import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Link as LinkIcon, Calendar, Grid, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // <-- Добавил табы
import { ProfileSettingsButton } from "@/components/profile-settings-button";
import { ProfileHeaderActions } from "@/components/profile-header-actions";
import { MemeGrid } from "@/components/meme-grid";

const API_URL = "http://127.0.0.1:8000";

async function getUser(username: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/users/${username}`, { cache: "no-store" });
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

// Новая функция для получения лайкнутых мемов
async function getUserLikedMemes(username: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?liked_by=${username}&limit=100`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

// Исправленный тип params для Next.js 15
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  
  const user = await getUser(username);
  const memes = await getUserMemes(username);
  const likedMemes = await getUserLikedMemes(username); // Загружаем избранное

  if (!user) return notFound();

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Шапка профиля */}
      <div className="relative mb-8">
        <div className="h-48 w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl overflow-hidden">
            {user.header_url && (
                <img src={`${API_URL}${user.header_url}`} alt="header" className="w-full h-full object-cover" />
            )}
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-12 mb-4 gap-4">
            <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
              <AvatarImage src={user.avatar_url ? `${API_URL}${user.avatar_url}` : undefined} className="object-cover" />
              <AvatarFallback className="text-2xl">{user.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 mt-2 sm:mt-0">
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-bold">{user.full_name || user.username}</h1>
                 <ProfileSettingsButton username={user.username} />
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>

            {/* Кнопки действий */}
            <div className="mt-4 sm:mt-0">
               <ProfileHeaderActions user={user} />
            </div>
          </div>

          {user.bio && <p className="mb-4 text-sm max-w-2xl">{user.bio}</p>}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Регистрация: {new Date(user.created_at).toLocaleDateString()}
            </div>
            {user.website && (
               <a href={user.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                 <LinkIcon className="w-3 h-3" /> {user.website.replace(/^https?:\/\//, '')}
               </a>
            )}
          </div>

          {/* Статистика (Вернули на место) */}
          <div className="flex gap-4 text-sm">
            <Link href={`/user/${user.username}/followers`} className="hover:underline cursor-pointer flex items-center gap-1">
                <span className="font-bold text-foreground">{user.followers_count || 0}</span> 
                <span className="text-muted-foreground">подписчиков</span>
            </Link>
            <Link href={`/user/${user.username}/following`} className="hover:underline cursor-pointer flex items-center gap-1">
                <span className="font-bold text-foreground">{user.following_count || 0}</span> 
                <span className="text-muted-foreground">подписок</span>
            </Link>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* ТАБЫ: Публикации / Избранное */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <Grid className="w-4 h-4" /> Публикации ({memes.length})
          </TabsTrigger>
          <TabsTrigger value="liked" className="flex items-center gap-2">
            <Heart className="w-4 h-4" /> Избранное ({likedMemes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
           <MemeGrid items={memes} />
        </TabsContent>

        <TabsContent value="liked">
           <MemeGrid items={likedMemes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}