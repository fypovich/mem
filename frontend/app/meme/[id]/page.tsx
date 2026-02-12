import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MemeInteractions } from "@/components/meme-interactions";
import { CommentsSection } from "@/components/comments-section";
import { MemeGrid } from "@/components/meme-grid";
import { MemeOwnerActions } from "@/components/meme-owner-actions";
import type { Metadata } from "next";
import { getImageUrl } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const FETCH_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DISPLAY_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${FETCH_API_URL}/api/v1/memes/${id}`, { cache: "no-store" });
    if (!res.ok) return { title: "Мем не найден" };
    const meme = await res.json();

    const imageUrl = getImageUrl(meme.thumbnail_url);
    const pageUrl = `${SITE_URL}/meme/${id}`;
    const description = meme.description
      ? meme.description.slice(0, 160)
      : `Мем «${meme.title}» от @${meme.user.username} на MemeHUB`;
    const tags = meme.tags.map((t: any) => t.name);

    return {
      title: meme.title,
      description,
      keywords: ["мем", ...tags],
      openGraph: {
        type: "article",
        title: meme.title,
        description,
        url: pageUrl,
        siteName: "MemeHUB",
        images: imageUrl ? [{ url: imageUrl, width: meme.width, height: meme.height, alt: meme.title }] : [],
        publishedTime: meme.created_at,
        authors: [`@${meme.user.username}`],
        tags,
      },
      twitter: {
        card: "summary_large_image",
        title: meme.title,
        description,
        images: imageUrl ? [imageUrl] : [],
      },
      alternates: { canonical: pageUrl },
    };
  } catch {
    return { title: "Мем не найден" };
  }
}

async function getMeme(id: string) {
  try {
    // Используем FETCH_API_URL для общения между контейнерами
    const res = await fetch(`${FETCH_API_URL}/api/v1/memes/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

async function getSimilarMemes(id: string) {
  try {
    // Используем FETCH_API_URL для общения между контейнерами
    const res = await fetch(`${FETCH_API_URL}/api/v1/memes/${id}/similar`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

type Params = Promise<{ id: string }>;

export default async function MemePage({ params }: { params: Params }) {
  const { id } = await params;
  
  const memeData = getMeme(id);
  const similarData = getSimilarMemes(id);
  const [meme, similarMemes] = await Promise.all([memeData, similarData]);

  if (!meme) return notFound();

  // Для аватарок используем DISPLAY_API_URL (чтобы грузилось в браузере)
  const avatarUrl = meme.user.avatar_url 
      ? (meme.user.avatar_url.startsWith("http") ? meme.user.avatar_url : `${DISPLAY_API_URL}${meme.user.avatar_url}`)
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${meme.user.username}`;
  
  const date = new Date(meme.created_at).toLocaleDateString("ru-RU", { day: 'numeric', month: 'long', year: 'numeric' });
  
  // Для видео/картинок мема используем DISPLAY_API_URL
  const mediaSrc = meme.media_url.startsWith('http') ? meme.media_url : `${DISPLAY_API_URL}${meme.media_url}`;
  
  const isMp4 = meme.media_url.endsWith(".mp4");

  const thumbnailUrl = meme.thumbnail_url.startsWith("http") ? meme.thumbnail_url : `${DISPLAY_API_URL}${meme.thumbnail_url}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isMp4 ? "VideoObject" : "ImageObject",
    "name": meme.title,
    "description": meme.description || meme.title,
    "contentUrl": mediaSrc,
    "thumbnailUrl": thumbnailUrl,
    "uploadDate": meme.created_at,
    "author": {
      "@type": "Person",
      "name": meme.user.full_name || meme.user.username,
      "url": `${SITE_URL}/user/${meme.user.username}`,
    },
    "interactionStatistic": [
      { "@type": "InteractionCounter", "interactionType": "https://schema.org/LikeAction", "userInteractionCount": meme.likes_count },
      { "@type": "InteractionCounter", "interactionType": "https://schema.org/WatchAction", "userInteractionCount": meme.views_count },
      { "@type": "InteractionCounter", "interactionType": "https://schema.org/CommentAction", "userInteractionCount": meme.comments_count },
    ],
    ...(isMp4 && meme.duration ? { "duration": `PT${Math.round(meme.duration)}S` } : {}),
    ...(meme.width ? { "width": meme.width } : {}),
    ...(meme.height ? { "height": meme.height } : {}),
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 items-start">

        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="space-y-6">
             <div className="rounded-xl overflow-hidden bg-black border border-border/50 shadow-2xl relative aspect-video flex items-center justify-center">
                {isMp4 ? (
                    <video 
                        src={mediaSrc} 
                        controls 
                        autoPlay 
                        loop 
                        muted={!meme.has_audio} 
                        playsInline
                        crossOrigin="anonymous"
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <img 
                        src={mediaSrc} 
                        alt={meme.title}
                        className="w-full h-full object-contain"
                    />
                )}
             </div>

             <div className="space-y-4">
                 <h1 className="text-2xl md:text-3xl font-bold break-words">{meme.title}</h1>
                 
                 <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
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

                     <div className="flex items-center gap-2">
                        <MemeInteractions 
                            memeId={meme.id} 
                            initialLikes={meme.likes_count} 
                            initialLiked={meme.is_liked}
                            authorUsername={meme.user.username} 
                        />

                        <MemeOwnerActions 
                            memeId={meme.id} 
                            authorUsername={meme.user.username}
                            initialTitle={meme.title}
                            initialDescription={meme.description}
                            initialTags={meme.tags}
                        />
                     </div>
                 </div>
                 
                 <div className="space-y-4">
                     {meme.description && (
                        <div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {meme.description}
                        </div>
                     )}

                     {meme.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {meme.tags.map((tag: any) => (
                                <Link key={tag.name} href={`/tag/${tag.name}`}>
                                    <Badge variant="secondary" className="px-3 py-1 text-sm cursor-pointer hover:bg-primary hover:text-white transition-colors">
                                        #{tag.name}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                     )}
                 </div>
             </div>
          </div>

          {similarMemes.length > 0 && (
             <div className="pt-8 border-t">
                 <h3 className="text-xl font-bold mb-4">Похожие мемы</h3>
                 <MemeGrid items={similarMemes} />
             </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА: Комментарии */}
        <div id="comments-section" className="hidden lg:block space-y-4 sticky top-24 h-fit">
            <CommentsSection memeId={meme.id} />
        </div>

        <div className="lg:hidden block space-y-4">
            <CommentsSection memeId={meme.id} />
        </div>

      </div>
    </div>
  );
}