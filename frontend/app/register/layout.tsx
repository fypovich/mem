import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создайте аккаунт на MemeHUB — публикуйте мемы, подписывайтесь на авторов и оставляйте комментарии.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
