import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { AppShell } from "@/components/app-shell";

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
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
