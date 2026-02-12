import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход",
  description: "Войдите в свой аккаунт MemeHUB, чтобы загружать мемы и оставлять комментарии.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
