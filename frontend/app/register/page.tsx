"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// --- SVG иконки соц. сетей ---
const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const VKIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.12-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.49 2.27 4.674 2.862 4.674.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.27-1.422 2.18-3.61 2.18-3.61.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z"/>
  </svg>
);

const YandexIcon = () => (
  <svg viewBox="0 0 44 44" className="w-5 h-5" fill="none">
    <path d="M22 44c12.15 0 22-9.85 22-22S34.15 0 22 0 0 9.85 0 22s9.85 22 22 22z" fill="currentColor" fillOpacity="0.15"/>
    <path d="M25.2 33h-2.94V23.1l-4.08-11.1h3.12l2.46 7.5 2.46-7.5h3.12l-4.14 11.1V33z" fill="currentColor"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.access_token, data.user.username);
        router.push("/");
        router.refresh();
      } else {
        setError(data.detail || "Ошибка регистрации");
      }
    } catch {
      setError("Ошибка сети. Попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialRegister = (provider: string) => {
    // TODO: Реализовать OAuth регистрацию
    alert(`Регистрация через ${provider} скоро будет доступна!`);
  };

  return (
    <div className="w-full h-dvh lg:grid lg:grid-cols-[2fr_3fr] overflow-hidden">

      {/* ЛЕВАЯ ЧАСТЬ — Декоративная */}
      <div className="hidden lg:flex flex-col justify-between bg-stone-900 relative p-8 text-white overflow-hidden">
        <div className="absolute inset-0 bg-stone-900">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-2 font-bold text-lg">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-sm">M</div>
          <span>MemeHUB</span>
        </div>

        <div className="relative z-10 max-w-xs space-y-4">
          <blockquote className="text-2xl font-bold leading-tight">
            "Один мем стоит тысячи слов."
          </blockquote>
          <p className="text-stone-400 text-sm">Присоединяйся к сообществу мемоделов. Загружай, делись, собирай лайки.</p>
        </div>

        <div className="relative z-10 text-xs text-stone-500">&copy; 2026 MemeHUB</div>
      </div>

      {/* ПРАВАЯ ЧАСТЬ — Форма регистрации */}
      <div className="flex items-center justify-center px-4 sm:px-8 bg-background h-dvh lg:h-full overflow-y-auto">
        <div className="w-full max-w-[380px] space-y-6 py-12">

          {/* Лого для мобилки */}
          <div className="lg:hidden flex justify-center mb-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black">M</div>
              <span>MemeHUB</span>
            </Link>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Создать аккаунт</h1>
            <p className="text-muted-foreground text-sm">Заполните данные для регистрации</p>
          </div>

          {/* Соц. сети */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSocialRegister("Telegram")}
              className="flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-card text-sm font-medium transition-all hover:bg-[#229ED9] hover:text-white hover:border-[#229ED9] active:scale-[0.98]"
            >
              <TelegramIcon />
              Telegram
            </button>
            <button
              onClick={() => handleSocialRegister("VK")}
              className="flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-card text-sm font-medium transition-all hover:bg-[#0077FF] hover:text-white hover:border-[#0077FF] active:scale-[0.98]"
            >
              <VKIcon />
              VK
            </button>
            <button
              onClick={() => handleSocialRegister("Яндекс")}
              className="flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-card text-sm font-medium transition-all hover:bg-[#FC3F1D] hover:text-white hover:border-[#FC3F1D] active:scale-[0.98]"
            >
              <YandexIcon />
              Яндекс
            </button>
            <button
              onClick={() => handleSocialRegister("Google")}
              className="flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-card text-sm font-medium transition-all hover:bg-white hover:text-black hover:border-gray-300 active:scale-[0.98]"
            >
              <GoogleIcon />
              Google
            </button>
          </div>

          {/* Разделитель */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">или</span>
            </div>
          </div>

          {/* Форма */}
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="username">Никнейм</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  minLength={3}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Имя</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать аккаунт
            </Button>
          </form>

          {/* Ссылка на вход */}
          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
