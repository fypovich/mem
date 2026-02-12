import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Link as LinkIcon, Calendar, Grid, Heart, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSettingsButton } from "@/components/profile-settings-button";
import { ProfileHeaderActions } from "@/components/profile-header-actions";
import { MemeGrid } from "@/components/meme-grid";
import type { Metadata } from "next";
import { getImageUrl } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const FETCH_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DISPLAY_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  try {
    const res = await fetch(`${FETCH_API_URL}/api/v1/users/${username}`, { cache: "no-store" });
    if (!res.ok) return { title: "Пользователь не найден" };
    const user = await res.json();

    const displayName = user.full_name || `@${username}`;
    const description = user.bio
      ? user.bio.slice(0, 160)
      : `Профиль ${displayName} на MemeHUB. ${user.followers_count} подписчиков.`;
    const avatarUrl = getImageUrl(user.avatar_url);
    const pageUrl = `${SITE_URL}/user/${username}`;

    return {
      title: displayName,
      description,
      openGraph: {
        type: "profile",
        title: displayName,
        description,
        url: pageUrl,
        images: avatarUrl ? [{ url: avatarUrl, alt: displayName }] : [],
        username,
      },
      twitter: {
        card: "summary",
        title: displayName,
        description,
        images: avatarUrl ? [avatarUrl] : [],
      },
      alternates: { canonical: pageUrl },
    };
  } catch {
    return { title: "Пользователь не найден" };
  }
}

async function getUser(username: string) {
  try {
    const res = await fetch(`${FETCH_API_URL}/api/v1/users/${username}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error("Error fetching user:", e);
    return null;
  }
}

async function getUserMemes(username: string) {
  try {
    const res = await fetch(`${FETCH_API_URL}/api/v1/memes/?username=${username}&limit=100`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

async function getUserLikedMemes(username: string) {
  try {
    const res = await fetch(`${FETCH_API_URL}/api/v1/memes/?liked_by=${username}&limit=100`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  
  const user = await getUser(username);
  
  if (!user) return notFound();

  const memes = await getUserMemes(username);
  const likedMemes = await getUserLikedMemes(username);

  // Формируем правильные ссылки для браузера
  const headerUrl = user.header_url ? `${DISPLAY_API_URL}${user.header_url}` : null;
  const avatarUrl = user.avatar_url ? `${DISPLAY_API_URL}${user.avatar_url}` : undefined;

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": user.full_name || user.username,
      "alternateName": `@${user.username}`,
      "url": `${SITE_URL}/user/${user.username}`,
      "image": avatarUrl,
      ...(user.bio ? { "description": user.bio } : {}),
      "interactionStatistic": [{
        "@type": "InteractionCounter",
        "interactionType": "https://schema.org/FollowAction",
        "userInteractionCount": user.followers_count || 0,
      }],
    },
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }} />
      {/* Шапка профиля */}
      <div className="relative mb-8">
        {/* Фон (Header) */}
        <div className="h-48 w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl overflow-hidden relative">
            {headerUrl && (
                <img 
                  src={headerUrl} 
                  alt="header" 
                  className="w-full h-full object-cover" 
                />
            )}
        </div>
        
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end -mt-12 mb-4 gap-4">
            {/* Аватар */}
            <Avatar className="w-32 h-32 border-4 border-background shadow-xl bg-background">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="text-2xl">{user.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 mt-2 sm:mt-0">
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-bold">{user.full_name || user.username}</h1>
                 <ProfileSettingsButton username={user.username} />
              </div>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>

            {/* Кнопки действий (Подписаться/Отписаться) */}
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

          {/* Статистика */}
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

      {/* ТАБЫ */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto">
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