"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.user.username);
        // Принудительное обновление состояния
        window.location.href = "/"; 
      } else {
        setError(data.detail || "Ошибка регистрации");
      }
    } catch (err) {
      setError("Ошибка сети. Попробуйте позже.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
          <CardDescription>
            Создайте аккаунт, чтобы публиковать мемы и оставлять комментарии.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username (логин)</Label>
              <Input 
                id="username" 
                placeholder="memelord" 
                value={formData.username}
                onChange={handleChange}
                required 
                minLength={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={formData.email}
                onChange={handleChange}
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Имя (необязательно)</Label>
              <Input 
                id="full_name" 
                placeholder="Иван Иванов" 
                value={formData.full_name}
                onChange={handleChange}
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
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать аккаунт
            </Button>
            <div className="text-sm text-muted-foreground text-center">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Войти
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}