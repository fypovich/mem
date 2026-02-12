import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const FETCH_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/new`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/search`,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/register`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.1,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.1,
    },
  ];

  let memePages: MetadataRoute.Sitemap = [];
  let userPages: MetadataRoute.Sitemap = [];

  try {
    const res = await fetch(`${FETCH_API_URL}/api/v1/memes/?sort=new&limit=200`, {
      cache: "no-store",
    });
    if (res.ok) {
      const memes = await res.json();

      memePages = memes.map((meme: any) => ({
        url: `${SITE_URL}/meme/${meme.id}`,
        lastModified: new Date(meme.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));

      const uniqueUsernames = [...new Set(memes.map((m: any) => m.user.username))] as string[];
      userPages = uniqueUsernames.map((username) => ({
        url: `${SITE_URL}/user/${username}`,
        changeFrequency: "daily" as const,
        priority: 0.6,
      }));
    }
  } catch (e) {
    console.error("Sitemap: failed to fetch memes", e);
  }

  return [...staticPages, ...memePages, ...userPages];
}
