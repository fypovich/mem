"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
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
  );
}
