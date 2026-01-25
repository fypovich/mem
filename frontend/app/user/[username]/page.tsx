import React from "react";
import { notFound } from "next/navigation";
import { Link as LinkIcon, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  
  const user = await getUser(username);
  const memes = await getUserMemes(username);

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

            {/* ИСПРАВЛЕНО: Передаем объект user целиком */}
            <ProfileHeaderActions user={user} />
          </div>

          {user.bio && <p className="mb-4 text-sm max-w-2xl">{user.bio}</p>}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Регистрация: {new Date(user.created_at).toLocaleDateString()}
            </div>
            {user.website && (
               <a href={user.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                 <LinkIcon className="w-3 h-3" /> {user.website.replace(/^https?:\/\//, '')}
               </a>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Контент */}
      <h2 className="text-xl font-semibold mb-6">Публикации ({memes.length})</h2>
      <MemeGrid items={memes} />
    </div>
  );
}