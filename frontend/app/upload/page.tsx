"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Music, X, Wand2, Loader2, Volume2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { uploadTempFile, getFullUrl } from "@/lib/api/editor";
import { getEditorResult, setEditorSource, type EditorResult } from "@/lib/editor-bridge";

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export default function UploadPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingToEditor, setIsUploadingToEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"video" | "image">("image");

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [subject, setSubject] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) router.push("/login");
    setToken(t);
  }, [router]);

  // Восстановление данных формы и результата из редактора
  useEffect(() => {
    // Восстановить форму
    const savedForm = sessionStorage.getItem('upload_form');
    if (savedForm) {
      try {
        const form = JSON.parse(savedForm);
        if (form.title) setTitle(form.title);
        if (form.description) setDescription(form.description);
        if (form.tagsInput) setTagsInput(form.tagsInput);
        if (form.subject) setSubject(form.subject);
      } catch {}
      sessionStorage.removeItem('upload_form');
    }

    // Загрузить результат из редактора
    const result = getEditorResult();
    if (result) {
      const fullUrl = result.url.startsWith("http") ? result.url : getFullUrl(result.url);
      fetch(fullUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], result.fileName, { type: blob.type });
          setMediaFile(file);
          setMediaType(result.mediaType);
          setMediaPreview(fullUrl);
        })
        .catch(() => setError("Не удалось загрузить отредактированный файл"));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const processFile = (file: File) => {
    const isVideo = file.type.startsWith("video");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;

    if (!allowedTypes.includes(file.type)) {
      setError(`Неподдерживаемый формат: ${file.type}. Используйте ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`);
      return;
    }
    if (file.size > maxSize) {
      setError(`Файл слишком большой. Максимум: ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    const type = isVideo ? "video" : "image";
    setMediaType(type);
    setMediaFile(file);
    if (mediaPreview && mediaPreview.startsWith("blob:")) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (audioPreview) URL.revokeObjectURL(audioPreview);
      setAudioFile(e.target.files[0]);
      setAudioPreview(URL.createObjectURL(e.target.files[0]));
    }
  };

  const removeAudio = () => {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioFile(null);
    setAudioPreview(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const removeMedia = () => {
    if (mediaPreview && mediaPreview.startsWith("blob:")) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
  };

  // --- Редактирование медиа ---
  const handleEditMedia = async () => {
    if (!mediaFile) return;
    setIsUploadingToEditor(true);
    setError(null);
    try {
      const result = await uploadTempFile(mediaFile);
      const fullUrl = getFullUrl(result.url);

      setEditorSource({
        url: fullUrl,
        serverPath: result.server_path,
        mediaType: mediaType,
      });

      // Сохраняем форму
      sessionStorage.setItem('upload_form', JSON.stringify({ title, description, tagsInput, subject }));

      if (mediaType === 'image') {
        router.push('/editor?from=upload');
      } else {
        router.push('/editor/video?from=upload');
      }
    } catch (e) {
      setError("Не удалось подготовить файл для редактирования");
      setIsUploadingToEditor(false);
    }
  };

  // --- Публикация с прогрессом ---
  const handleSubmit = async () => {
    if (!mediaFile || !title) {
        setError("Загрузите медиафайл и укажите название!");
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
        const formData = new FormData();
        formData.append("title", title);
        if (description) formData.append("description", description);
        if (tagsInput) formData.append("tags", tagsInput);
        if (subject) formData.append("subject", subject);
        formData.append("file", mediaFile);
        if (audioFile) formData.append("audio_file", audioFile);

        const data = await new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_URL}/api/v1/memes/upload`);
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);

            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded / e.total) * 100));
                }
            });

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    try {
                        const errData = JSON.parse(xhr.responseText);
                        reject(new Error(errData.detail || "Ошибка загрузки"));
                    } catch {
                        reject(new Error("Ошибка загрузки"));
                    }
                }
            };
            xhr.onerror = () => reject(new Error("Ошибка сети"));
            xhr.send(formData);
        });

        router.push(`/meme/${data.id}`);
        router.refresh();
    } catch (e: any) {
        setError(e.message);
        setIsUploading(false);
        setUploadProgress(0);
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Загрузить новый мем</h1>
            <div
                className={`border-2 border-dashed rounded-xl h-[400px] flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                    isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"
                } ${mediaPreview ? "bg-black" : "bg-muted/5"}`}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            >
                {mediaPreview ? (
                    <>
                        {mediaType === "video" ? (
                            <video src={mediaPreview} className="w-full h-full object-contain" controls />
                        ) : (
                            <img src={mediaPreview} className="w-full h-full object-contain" alt="Preview" />
                        )}
                        <div className="absolute top-4 right-4 flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="rounded-full bg-black/60 hover:bg-black/80 text-white border-0 backdrop-blur-sm"
                                onClick={handleEditMedia}
                                disabled={isUploadingToEditor}
                            >
                                {isUploadingToEditor ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Pencil className="w-3.5 h-3.5 mr-1" />}
                                Редактировать
                            </Button>
                            <Button size="icon" variant="destructive" className="rounded-full" onClick={removeMedia}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="text-center p-6 space-y-4">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                            <UploadCloud className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-lg font-medium">Перетащите сюда файл</p>
                            <p className="text-sm text-muted-foreground mt-1">Поддерживаем видео и картинки</p>
                        </div>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Выбрать файл</Button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
                    </div>
                )}
            </div>

            <Card className="p-4 border-dashed border-muted-foreground/25">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Music className="w-5 h-5 text-blue-500" />
                        <span className="font-semibold">Аудиодорожка (опционально)</span>
                    </div>
                    {audioFile && <Button variant="ghost" size="sm" onClick={removeAudio} className="text-red-500 h-8"><X className="w-4 h-4 mr-1" /> Удалить</Button>}
                </div>
                {!audioFile ? (
                    <div className="h-16 bg-muted/20 rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/40 transition-colors border border-transparent hover:border-primary/20" onClick={() => audioInputRef.current?.click()}>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <UploadCloud className="w-4 h-4" /><span>Нажмите, чтобы добавить музыку</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 bg-secondary/50 p-3 rounded-lg border">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center"><Volume2 className="w-5 h-5 text-blue-500" /></div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{audioFile.name}</p>
                        </div>
                        {audioPreview && <audio src={audioPreview} controls className="h-8 w-24 opacity-70" />}
                    </div>
                )}
                <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioSelect} />
                <p className="text-xs text-muted-foreground mt-3">
                    * Если не добавить аудио к картинке, она сохранится как изображение (без длительности).
                </p>
            </Card>
        </div>

        <div>
            <Card className="p-6 space-y-6 sticky top-24">
                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm">{error}</div>}
                <div className="space-y-4">
                    <div className="grid gap-2"><Label htmlFor="title">Название</Label><Input id="title" placeholder="Придумайте заголовок..." value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div className="grid gap-2"><Label htmlFor="desc">Описание</Label><Textarea id="desc" placeholder="Контекст (необязательно)" className="resize-none h-24" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <Separator />
                    <div className="grid gap-2">
                        <Label>Персонаж</Label>
                        <div className="relative"><Wand2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Например: Райан Гослинг" className="pl-9" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Теги</Label>
                        <Input placeholder="жиза, мем..." value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
                        <div className="flex flex-wrap gap-2 mt-2 min-h-[24px]">
                            {tagsInput.split(/[\s,]+/).filter(t => t).map((tag, i) => <Badge key={i} variant="secondary" className="text-[10px]">{tag.startsWith('#') ? tag : `#${tag}`}</Badge>)}
                        </div>
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t space-y-3">
                    {isUploading && uploadProgress > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Загрузка...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                        </div>
                    )}
                    <Button className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20" disabled={!mediaFile || !title || isUploading} onClick={handleSubmit}>
                        {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {uploadProgress < 100 ? "Загрузка..." : "Обработка..."}</> : "Опубликовать"}
                    </Button>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}
