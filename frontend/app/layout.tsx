import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header"; // <--- Оставляем

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MemeHUB",
  description: "Твои любимые мемы со звуком",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" style={{ colorScheme: "dark" }}>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        
        {/* Используем Header вместо Navbar */}
        <Header />
        
        <div className="container mx-auto max-w-7xl px-4 flex gap-6 min-h-[calc(100vh-4rem)]">
            <Sidebar />
            <main className="flex-1 py-6 min-w-0"> 
                {children}
            </main>
        </div>
        
      </body>
    </html>
  );
}