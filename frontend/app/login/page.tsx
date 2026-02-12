"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // --- STATE ДЛЯ ВХОДА ---
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // --- STATE ДЛЯ РЕГИСТРАЦИИ ---
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // ЛОГИКА ВХОДА
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // OAuth2 требует отправку данных как Form URL Encoded
      const formData = new URLSearchParams();
      formData.append("username", loginUsername);
      formData.append("password", loginPassword);

      const res = await fetch(`${API_URL}/api/v1/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Ошибка входа");

      const data = await res.json();

      login(data.access_token, loginUsername);
      router.push("/");
      router.refresh();

    } catch (error) {
      alert("Неверный логин или пароль");
    } finally {
      setIsLoading(false);
    }
  };

  // ЛОГИКА РЕГИСТРАЦИИ
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Ошибка регистрации");
      }

      const data = await res.json();

      login(data.access_token, regUsername);
      router.push("/");
      router.refresh();

    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2 overflow-hidden">
      
      {/* ЛЕВАЯ ЧАСТЬ (Дизайн) */}
      <div className="hidden lg:flex flex-col justify-between bg-stone-900 relative p-10 text-white">
        <div className="absolute inset-0 bg-stone-900">
             <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </div>
        <div className="relative z-10 flex items-center gap-2 font-bold text-xl">
           <div className="bg-white text-black p-1 rounded-lg"><Play className="h-5 w-5 fill-current" /></div>
           <span>MemeHUB</span>
        </div>
        <div className="relative z-10 max-w-md">
            <h2 className="text-3xl font-bold mb-4">"Я не выбирал жизнь мемолога, жизнь мемолога выбрала меня."</h2>
        </div>
        <div className="relative z-10 text-sm text-stone-500">&copy; 2026 MemeHUB Inc.</div>
      </div>

      {/* ПРАВАЯ ЧАСТЬ (Формы) */}
      <div className="flex items-center justify-center py-12 px-4 sm:px-8 bg-background">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="flex flex-col text-center space-y-2 mb-4">
            <h1 className="text-3xl font-bold tracking-tight">Добро пожаловать</h1>
            <p className="text-muted-foreground text-sm">Войдите, чтобы загружать мемы.</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>
            
            {/* Вкладка ВХОД */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Никнейм</Label>
                  <Input 
                    id="username" 
                    placeholder="memelord" 
                    required 
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Войти
                </Button>
              </form>
            </TabsContent>

            {/* Вкладка РЕГИСТРАЦИЯ */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="reg-user">Никнейм</Label>
                  <Input 
                    id="reg-user" 
                    required 
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-email">Почта</Label>
                  <Input 
                    id="reg-email" 
                    type="email" 
                    required 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-pass">Пароль</Label>
                  <Input 
                    id="reg-pass" 
                    type="password" 
                    required 
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Создать аккаунт
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}