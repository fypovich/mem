"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center p-4">
      {/* Мемный GIF */}
      <div className="relative w-full max-w-md aspect-video mb-8 rounded-xl overflow-hidden shadow-2xl border border-stone-800">
         {/* Ссылка на гифку с Траволтой (Confused Travolta) */}
         <img 
            src="https://media.giphy.com/media/26hkhKd2Cp5WMWU1O/giphy.gif" 
            alt="Confused Travolta"
            className="w-full h-full object-cover"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-50"></div>
      </div>

      <h1 className="text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600 mb-2">
        404
      </h1>
      <h2 className="text-2xl font-bold mb-4">Мем не найден...</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Похоже, мы потерялись. Этой страницы не существует, либо она была удалена (возможно, модератором, у которого нет чувства юмора).
      </p>

      <div className="flex gap-4">
        <Link href="/">
            <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> На главную
            </Button>
        </Link>
        <Link href="/upload">
            <Button>Создать свой мем</Button>
        </Link>
      </div>
    </div>
  );
}