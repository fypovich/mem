import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Поиск",
  description: "Поиск мемов, пользователей и тегов на MemeHUB.",
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
