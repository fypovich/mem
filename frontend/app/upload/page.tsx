"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Music, Film, X, ImageIcon, Mic, Wand2, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function UploadPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  
  // States
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Data
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"video" | "image">("image");
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioMode, setAudioMode] = useState<"original" | "upload">("original");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Auth Check
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
    }
  }, [router]);

  // Handlers
  const handleFileSelect = (file: File) => {
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);

    if (file.type.startsWith("video")) {
        setMediaType("video");
        setAudioMode("original"); // У видео есть свой звук по дефолту
    } else {
        setMediaType("image");
        setAudioMode("upload"); // Картинке нужен внешний звук
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setAudioFile(e.target.files[0]);
      }
  };

  const handleSubmit = async () => {
      if (!mediaFile || !title || !token) return;
      
      // Валидация: Если картинка, аудио обязательно
      if (mediaType === "image" && !audioFile) {
          alert("Для картинок и GIF обязательно нужно добавить аудиодорожку!");
          return;
      }

      setIsUploading(true);

      try {
          const formData = new FormData();
          formData.append("title", title);
          formData.append("description", description);
          formData.append("file", mediaFile);
          
          // Теги и Персонаж
          formData.append("tags", tagsInput); // Бэкенд сам распарсит строку
          if (subject) formData.append("subject", subject);

          // Аудио
          if (audioMode === "upload" && audioFile) {
              formData.append("audio_file", audioFile);
          }

          const res = await fetch("http://127.0.0.1:8000/api/v1/memes/upload", {
              method: "POST",
              headers: { "Authorization": `Bearer ${token}` },
              body: formData
          });

          if (!res.ok) {
              const err = await res.json();
              throw new Error(err.detail || "Ошибка загрузки");
          }

          const data = await res.json();
          router.push(`/meme/${data.id}`);
          router.refresh();

      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsUploading(false);
      }
  };

  return (
    <div className="max-w-5xl mx-auto w-full pb-10 px-4 py-8">
      
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Создать мем</h1>
            <p className="text-muted-foreground mt-1">Загрузи видео, GIF или картинку и добавь звук.</p>
          </div>
          <Button variant="ghost" className="text-muted-foreground" onClick={() => window.location.reload()}>Очистить всё</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        
        {/* ЛЕВАЯ КОЛОНКА: Медиа */}
        <div className="space-y-6">
            
            {/* Dropzone */}
            <div 
                className={`relative group border-2 border-dashed rounded-2xl h-[400px] flex flex-col items-center justify-center text-center p-6 transition-all duration-300
                ${isDragging ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-stone-700/50 bg-stone-950/50 hover:border-stone-500 hover:bg-stone-900/50'}
                ${mediaPreview ? 'border-solid border-stone-800 bg-black' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => !mediaPreview && fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    accept="video/*,image/*" 
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />

                {!mediaPreview ? (
                    <>
                        <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                            <UploadCloud className="w-10 h-10 text-stone-400 group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Перетащи файл сюда</h3>
                        <p className="text-stone-500 max-w-xs text-sm">
                            Поддерживаем MP4, WEBM, GIF или JPG/PNG
                        </p>
                        <Button variant="secondary" className="mt-6 pointer-events-none">Выбрать файл</Button>
                    </>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden">
                        <div className="absolute top-4 right-4 z-10">
                            <Button size="icon" variant="destructive" onClick={(e) => {e.stopPropagation(); setMediaFile(null); setMediaPreview(null);}}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        {mediaType === "video" ? (
                            <video src={mediaPreview} controls className="max-h-full max-w-full" />
                        ) : (
                            <img src={mediaPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                        )}
                    </div>
                )}
            </div>

            {/* Audio Selector */}
            <Card className="p-4 border-stone-800 bg-card/50">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Music className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Аудиодорожка</h3>
                        <p className="text-xs text-muted-foreground">
                            {mediaType === "image" ? "Для картинки аудио обязательно" : "Оставь оригинал или замени"}
                        </p>
                    </div>
                </div>
                
                <Tabs value={audioMode} onValueChange={(v: any) => setAudioMode(v)} className="w-full">
                    <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                        <TabsTrigger value="original" disabled={mediaType === "image"}>Оригинал</TabsTrigger>
                        <TabsTrigger value="upload">Загрузить MP3</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="original" className="p-4 bg-background/50 border rounded-md mt-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Film className="w-4 h-4" /> Используется звук из видео
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="upload" className="mt-2">
                        <div 
                            className="border border-dashed rounded-md p-6 text-center text-sm text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors flex flex-col items-center gap-2"
                            onClick={() => audioInputRef.current?.click()}
                        >
                            {audioFile ? (
                                <div className="text-primary font-medium flex items-center gap-2">
                                    <Music className="w-4 h-4" /> {audioFile.name}
                                </div>
                            ) : (
                                <>
                                    <span>Нажми, чтобы выбрать MP3/WAV</span>
                                    <span className="text-xs opacity-50">(Обязательно для картинок)</span>
                                </>
                            )}
                            <input type="file" className="hidden" ref={audioInputRef} accept="audio/*" onChange={handleAudioSelect} />
                        </div>
                    </TabsContent>
                </Tabs>
            </Card>

        </div>

        {/* ПРАВАЯ КОЛОНКА: Метаданные */}
        <div className="space-y-6">
            <Card className="p-6 border-stone-800 bg-card h-full">
                <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-primary" /> Детали мема
                </h2>
                
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="title">Название</Label>
                        <Input 
                            id="title" 
                            placeholder="Например: Кот танцует" 
                            className="bg-background/50" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="desc">Описание</Label>
                        <Textarea 
                            id="desc" 
                            placeholder="Контекст мема..." 
                            className="resize-none h-24 bg-background/50" 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <Separator />
                    
                    <div className="space-y-2">
                        <Label>Кто на меме? (Персонаж)</Label>
                        <div className="relative">
                            <Input 
                                placeholder="Райан Гослинг..." 
                                className="bg-background/50 pl-9" 
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                            <ImageIcon className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Теги (через пробел или запятую)</Label>
                        <Input 
                            placeholder="#смешно #жиза" 
                            className="bg-background/50" 
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                        />
                        {/* Предпросмотр тегов */}
                        <div className="flex flex-wrap gap-2 mt-2 min-h-[24px]">
                            {tagsInput.split(/[\s,]+/).filter(t => t).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">
                                    {tag.startsWith('#') ? tag : `#${tag}`}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t flex gap-3">
                    <Button 
                        className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20"
                        disabled={!mediaFile || !title || isUploading}
                        onClick={handleSubmit}
                    >
                        {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Обработка...</> : "Опубликовать"}
                    </Button>
                </div>
            </Card>
            
            <div className="text-center text-xs text-muted-foreground">
                Публикуя контент, вы соглашаетесь с правилами сообщества.
            </div>
        </div>

      </div>
    </div>
  );
}