import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

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
    // ВЕРНУЛИ className="dark" — теперь сайт снова будет черным
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <div className="relative flex min-h-screen flex-col">
          {/* ШАПКА */}
          <Header />
          
          <div className="flex flex-1">
            {/* САЙДБАР (Вернули фиксированное позиционирование как было раньше) */}
            <aside className="fixed top-14 bottom-0 left-0 z-30 hidden w-64 border-r bg-background md:block overflow-y-auto py-6 px-4">
               <Sidebar />
            </aside>

            {/* ОСНОВНОЙ КОНТЕНТ (Отступ слева md:pl-64 чтобы не наезжал на сайдбар) */}
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