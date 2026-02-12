import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сброс пароля",
  description: "Установите новый пароль для вашего аккаунта MemeHUB.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
