import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
// Toaster удален, так как файла компонента нет в проекте.
// Когда добавите components/ui/toaster.tsx, раскомментируйте строку ниже:
// import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "MemeHUB",
  description: "Лучшие мемы здесь",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <div className="flex flex-1">
            <aside className="hidden md:flex w-64 flex-col border-r fixed inset-y-0 z-40 mt-16 bg-background">
               <Sidebar />
            </aside>
            <main className="flex-1 md:pl-64 pt-16">
                {children}
            </main>
          </div>
        </div>
        {/* <Toaster /> */}
      </body>
    </html>
  );
}