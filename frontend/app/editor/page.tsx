"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, Wand2, Download, Image as ImageIcon, Layers, Zap } from "lucide-react";
import { toast } from "sonner";
import { checkTaskStatus } from "@/lib/api/editor"; // Убедитесь, что эта функция есть

// Вспомогательная функция загрузки
const uploadFile = async (file: File, operation: 'remove_bg' | 'upload_only') => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("operation", operation);
    
    // ВАЖНО: Используйте ваш реальный токен
    const token = localStorage.getItem("token"); 
    
    const res = await fetch("http://localhost:8000/api/v1/editor/process-image", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
    });
    if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Upload failed");
    }
    return res.json(); // { task_id }
};

const animateSticker = async (serverPath: string, animation: string) => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:8000/api/v1/editor/create-sticker", {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ image_path: serverPath, animation, format: 'gif' })
    });
    return res.json();
};

export default function StickerMakerPage() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Edit, 3: Result
  const [imageSrc, setImageSrc] = useState<string | null>(null); // URL для отображения
  const [serverPath, setServerPath] = useState<string | null>(null); // Путь на сервере
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalGif, setFinalGif] = useState<string | null>(null);
  
  const [settings, setSettings] = useState({
    outline: false,
    outlineWidth: 10,
    animation: "none" // none, zoom_in, pulse, shake
  });

  // 1. Загрузка и Удаление фона
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
        const file = e.target.files[0];
        setIsProcessing(true);
        const toastId = toast.loading("Удаляем фон...");
        
        try {
            // Сразу просим удалить фон
            const data = await uploadFile(file, "remove_bg");
            
            // Ждем результат (polling)
            const interval = setInterval(async () => {
                const status = await checkTaskStatus(data.task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    setImageSrc(status.result.url); // http://localhost.../static/...
                    setServerPath(status.result.server_path);
                    setStep(2);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.success("Фон удален!");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка обработки");
                }
            }, 1000);
        } catch (err) {
            console.error(err);
            toast.error("Ошибка загрузки. Проверьте авторизацию.");
            setIsProcessing(false);
        }
    }
  };

  // 2. Генерация GIF
  const handleGenerate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    toast.info("Генерируем анимацию...");

    try {
        // Если была выбрана обводка - тут надо бы вызвать отдельный API для outline перед анимацией
        // Но для простоты MVP сразу анимируем то, что есть (без outline пока)
        
        const data = await animateSticker(serverPath, settings.animation);
        
        const interval = setInterval(async () => {
            const status = await checkTaskStatus(data.task_id);
            if (status.status === "SUCCESS") {
                clearInterval(interval);
                setFinalGif(status.result.url);
                setStep(3);
                setIsProcessing(false);
                toast.success("Стикер готов!");
            }
        }, 1000);
    } catch (err) {
        toast.error("Ошибка генерации");
        setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-white flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
        AI Sticker Maker
      </h1>

      <div className="w-full max-w-4xl flex gap-8">
        
        {/* LEFT: PREVIEW */}
        <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 min-h-[400px] relative overflow-hidden">
            {/* Прозрачный фон (шахматка) */}
            <div className="absolute inset-0 opacity-20" 
                 style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
            />
            
            {step === 1 && (
                <div className="text-center p-8">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Upload className="text-zinc-500" />
                    </div>
                    <p className="text-zinc-400">Загрузите фото (JPG, PNG)</p>
                    <p className="text-xs text-zinc-600 mt-2">AI автоматически удалит фон</p>
                </div>
            )}

            {step === 2 && imageSrc && (
                <img 
                    src={imageSrc} 
                    alt="Preview" 
                    className="relative z-10 max-w-[80%] max-h-[80%] object-contain drop-shadow-2xl transition-all duration-300"
                    style={{
                        // Эмуляция анимации для превью
                        transform: settings.animation === 'zoom_in' ? 'scale(1.1)' : 'scale(1)',
                        animation: settings.animation === 'pulse' ? 'pulse 2s infinite' : settings.animation === 'shake' ? 'spin 1s infinite' : 'none'
                    }}
                />
            )}

            {step === 3 && finalGif && (
                <img src={finalGif} alt="Result" className="relative z-10 max-w-[80%] max-h-[80%]" />
            )}

            {isProcessing && (
                <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm">
                    <Loader2 className="animate-spin text-purple-500 w-12 h-12" />
                </div>
            )}
        </div>

        {/* RIGHT: CONTROLS */}
        <Card className="w-80 bg-zinc-950 border-zinc-800 p-6 flex flex-col gap-6">
            
            {/* STEP 1: UPLOAD */}
            <div className={step !== 1 ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="font-bold mb-2 flex items-center gap-2"><ImageIcon size={18}/> 1. Загрузка</h3>
                <div className="relative">
                    <Button className="w-full bg-white text-black hover:bg-zinc-200">Выберите файл</Button>
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={step !== 1}
                    />
                </div>
            </div>

            {/* STEP 2: EDIT */}
            <div className={step !== 2 ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="font-bold mb-4 flex items-center gap-2"><Wand2 size={18}/> 2. Эффекты</h3>
                
                <div className="space-y-4">
                    <div>
                        <div className="text-xs text-zinc-400 mb-2">Анимация</div>
                        <div className="grid grid-cols-2 gap-2">
                            {['none', 'zoom_in', 'pulse', 'shake'].map(anim => (
                                <Button 
                                    key={anim}
                                    variant={settings.animation === anim ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSettings({...settings, animation: anim})}
                                    className="capitalize"
                                >
                                    {anim.replace('_', ' ')}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-zinc-400 mb-2">Обводка (Stroke)</div>
                        <Button variant="outline" size="sm" className="w-full" disabled>
                            В разработке (API Ready)
                        </Button>
                    </div>
                </div>

                <Button 
                    className="w-full mt-6 bg-purple-600 hover:bg-purple-700" 
                    onClick={handleGenerate}
                    disabled={step !== 2}
                >
                    Создать Стикер
                </Button>
            </div>

            {/* STEP 3: RESULT */}
            <div className={step !== 3 ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="font-bold mb-2 flex items-center gap-2"><Download size={18}/> 3. Готово</h3>
                <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => window.open(finalGif || "", "_blank")}
                >
                    Скачать GIF
                </Button>
                <Button variant="ghost" className="w-full mt-2" onClick={() => { setStep(1); setImageSrc(null); setFinalGif(null); }}>
                    Создать новый
                </Button>
            </div>

        </Card>
      </div>
    </div>
  );
}