import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Загрузить мем",
  description: "Загрузите свой мем на MemeHUB.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
