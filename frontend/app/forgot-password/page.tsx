"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        const data = await res.json();
        setError(data.detail || "Произошла ошибка");
      }
    } catch (err) {
      setError("Ошибка сети");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Восстановление пароля</CardTitle>
          <CardDescription>
            Введите ваш email, и мы отправим вам ссылку для сброса пароля.
          </CardDescription>
        </CardHeader>
        
        {isSuccess ? (
          <CardContent className="space-y-4 text-center">
            <div className="bg-green-500/10 text-green-600 p-4 rounded-full w-fit mx-auto mb-2">
                <Mail className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-lg">Письмо отправлено!</h3>
            <p className="text-muted-foreground text-sm">
              (В демо-режиме ссылка находится в консоли сервера Docker)
            </p>
            <Button asChild className="w-full mt-4" variant="outline">
                <Link href="/login">Вернуться ко входу</Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Отправить ссылку
              </Button>
              <Button asChild variant="link" className="text-sm">
                <Link href="/login">Отмена</Link>
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}