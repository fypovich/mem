"use client";

import React from "react";
import { Check, X, AlertTriangle, Eye, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

// Очередь на модерацию
const PENDING_MEMES = [
  { id: 1, user: "newbie_22", title: "Странный мем", image_bg: "bg-stone-800", warning: null },
  { id: 2, user: "troll_1", title: "NSFW Content?", image_bg: "bg-red-900", warning: "AI detected NSFW" },
  { id: 3, user: "good_user", title: "Котики", image_bg: "bg-emerald-900", warning: null },
  { id: 4, user: "spammer", title: "Купи крипту", image_bg: "bg-yellow-900", warning: "Spam keywords" },
];

export default function AdminPage() {
  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <ShieldAlert className="w-8 h-8 text-primary" /> Модерация
            </h1>
            <p className="text-muted-foreground">Очередь: 4 мема ожидают проверки</p>
        </div>
        <div className="flex gap-2">
             <Button variant="outline">История действий</Button>
             <Button variant="destructive">Бан-лист</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {PENDING_MEMES.map((meme) => (
            <Card key={meme.id} className="overflow-hidden border-2 border-border hover:border-primary/50 transition-colors">
                {/* Превью контента */}
                <div className={`h-48 w-full ${meme.image_bg} relative group cursor-pointer`}>
                    {/* Размытие для безопасности модератора */}
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-md group-hover:backdrop-blur-none transition-all flex items-center justify-center">
                        <div className="bg-black/60 p-2 rounded-full group-hover:opacity-0 transition-opacity">
                            <Eye className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    
                    {meme.warning && (
                        <div className="absolute top-2 right-2">
                            <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="w-3 h-3" /> {meme.warning}
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="p-4">
                    <h3 className="font-bold truncate" title={meme.title}>{meme.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">Автор: @{meme.user}</p>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-200 dark:border-rose-900">
                            <X className="w-4 h-4 mr-2" /> Отклонить
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Check className="w-4 h-4 mr-2" /> Принять
                        </Button>
                    </div>
                </div>
            </Card>
        ))}
      </div>
      
      {PENDING_MEMES.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
              🎉 Очередь пуста! Хорошая работа.
          </div>
      )}
    </div>
  );
}