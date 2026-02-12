import React from "react";
import { Hash } from "lucide-react";
import { InfiniteMemeGrid } from "@/components/infinite-meme-grid";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  const pageUrl = `${SITE_URL}/tag/${slug}`;

  return {
    title: `#${tag}`,
    description: `Мемы с тегом #${tag} на MemeHUB. Смотрите подборку лучших мемов.`,
    openGraph: {
      title: `#${tag} — мемы`,
      description: `Подборка мемов с тегом #${tag}`,
      url: pageUrl,
    },
    twitter: {
      card: "summary",
      title: `#${tag} — мемы на MemeHUB`,
    },
    alternates: { canonical: pageUrl },
  };
}

async function getTagMemes(tag: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/memes/?tag=${tag}&limit=20`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch (e) { return []; }
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decodedTag = decodeURIComponent(slug);
  const initialMemes = await getTagMemes(decodedTag);

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-full">
            <Hash className="w-6 h-6 text-primary" />
        </div>
        <div>
            <h1 className="text-2xl md:text-3xl font-bold">#{decodedTag}</h1>
        </div>
      </div>

      <InfiniteMemeGrid
        fetchUrl={`/api/v1/memes/?tag=${encodeURIComponent(decodedTag)}`}
        initialItems={initialMemes}
        limit={20}
      />
    </div>
  );
}
