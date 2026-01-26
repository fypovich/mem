"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setError("Пароли не совпадают");
        return;
    }
    if (!token) {
        setError("Токен отсутствует. Перейдите по ссылке из письма.");
        return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        const data = await res.json();
        setError(data.detail || "Ошибка сброса. Ссылка устарела?");
      }
    } catch (err) {
      setError("Ошибка сети");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
      return (
        <Card className="w-full max-w-md text-center p-6">
            <div className="text-red-500 mb-2">Ошибка</div>
            <p className="text-muted-foreground">Неверная ссылка для сброса пароля.</p>
            <Button asChild className="mt-4" variant="outline">
                <Link href="/forgot-password">Попробовать снова</Link>
            </Button>
        </Card>
      );
  }

  if (isSuccess) {
      return (
        <Card className="w-full max-w-md">
            <CardContent className="space-y-4 pt-6 text-center">
                <div className="bg-green-500/10 text-green-600 p-4 rounded-full w-fit mx-auto mb-2">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-lg">Пароль изменен!</h3>
                <p className="text-muted-foreground text-sm">
                    Сейчас вы будете перенаправлены на страницу входа...
                </p>
                <Button asChild className="w-full mt-4">
                    <Link href="/login">Войти сейчас</Link>
                </Button>
            </CardContent>
        </Card>
      );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Новый пароль</CardTitle>
        <CardDescription>
          Придумайте надежный пароль для вашего аккаунта.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Новый пароль</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Подтвердите пароль</Label>
            <Input 
              id="confirm" 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
              minLength={6}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Изменить пароль
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
            <Suspense fallback={<div>Загрузка...</div>}>
                <ResetPasswordForm />
            </Suspense>
        </div>
    );
}