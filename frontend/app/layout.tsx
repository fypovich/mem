import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MemeHUB — Лучшие мемы рунета",
    template: "%s | MemeHUB",
  },
  description: "MemeHUB — платформа для создания, публикации и обсуждения мемов. Смешные картинки, видео и гифки каждый день.",
  keywords: ["мемы", "смешные картинки", "мемасы", "видео мемы", "гифки", "MemeHUB"],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "MemeHUB",
    title: "MemeHUB — Лучшие мемы рунета",
    description: "Платформа для создания, публикации и обсуждения мемов.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "MemeHUB — Лучшие мемы рунета",
    description: "Платформа для создания, публикации и обсуждения мемов.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "MemeHUB",
  "url": SITE_URL,
  "description": "Платформа для создания, публикации и обсуждения мемов",
  "inLanguage": "ru",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <div className="relative flex min-h-screen flex-col">
          <Header />

          <div className="flex flex-1">
            <aside className="fixed top-14 bottom-0 left-0 z-30 hidden w-64 border-r bg-background md:block overflow-y-auto py-6 px-4">
               <Sidebar />
            </aside>

            <main className="flex w-full flex-col overflow-hidden md:pl-64">
               <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                   {children}
               </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
