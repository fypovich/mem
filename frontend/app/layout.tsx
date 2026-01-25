import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/toaster"; // Если есть тостер

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "MemeHUB",
  description: "Твой источник мемов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <div className="relative flex min-h-screen flex-col">
          {/* ШАПКА (Фиксированная) */}
          <Header />
          
          <div className="flex flex-1">
            {/* САЙДБАР (Фиксированный слева, скрыт на мобилках) */}
            <aside className="fixed top-14 bottom-0 left-0 z-30 hidden w-64 border-r bg-background md:block overflow-y-auto py-6 px-4">
              <Sidebar />
            </aside>

            {/* ОСНОВНОЙ КОНТЕНТ (Сдвинут вправо на ширину сайдбара) */}
            <main className="flex w-full flex-col overflow-hidden md:pl-64">
              {/* pt-4 добавит немного воздуха под шапкой, если нужно */}
              <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                {children}
              </div>
            </main>
          </div>
        </div>
        
        {/* Компоненты поверх всего (Тосты) */}
        {/* <Toaster /> Если используете shadcn toaster */}
      </body>
    </html>
  );
}