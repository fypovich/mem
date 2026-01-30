"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Wand2, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker } from "@/lib/api/editor";

export default function StickerMakerPage() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Animate, 3: Done
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAnim, setSelectedAnim] = useState("none");
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // 1. Загрузка + Удаление фона
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    setIsProcessing(true);
    const toastId = toast.loading("Удаляем фон с помощью AI...");

    try {
        const { task_id } = await processImage(file, "remove_bg");
        
        const interval = setInterval(async () => {
            const status = await checkStatus(task_id);
            if (status.status === "SUCCESS") {
                clearInterval(interval);
                setImageSrc(status.result.url);
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
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Ошибка загрузки");
    }
  };

  // 2. Анимация
  const handleAnimate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Создаем GIF...");

    try {
        const { task_id } = await createSticker(serverPath, selectedAnim);
        
        const interval = setInterval(async () => {
            const status = await checkStatus(task_id);
            if (status.status === "SUCCESS") {
                clearInterval(interval);
                setFinalResult(status.result.url);
                setStep(3);
                setIsProcessing(false);
                toast.dismiss(toastId);
                toast.success("Готово!");
            }
        }, 1000);
    } catch (err) {
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Ошибка генерации");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-white p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
        Sticker Maker
      </h1>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl">
        
        {/* ПРЕВЬЮ */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 min-h-[400px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            
            {step === 1 && (
                <div className="text-center p-8">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="text-zinc-500" size={32} />
                    </div>
                    <p className="text-zinc-400">Загрузите изображение</p>
                </div>
            )}

            {step === 2 && imageSrc && (
                <img 
                    src={imageSrc} 
                    className="relative z-10 max-h-[300px] object-contain transition-transform duration-500"
                    style={{
                        transform: selectedAnim === 'zoom_in' ? 'scale(1.2)' : 'scale(1)',
                        animation: selectedAnim === 'pulse' ? 'pulse 2s infinite' : selectedAnim === 'shake' ? 'spin 1s infinite' : 'none'
                    }}
                />
            )}

            {step === 3 && finalResult && (
                <img src={finalResult} className="relative z-10 max-h-[300px]" />
            )}

            {isProcessing && (
                <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-purple-500 w-12 h-12" />
                </div>
            )}
        </div>

        {/* НАСТРОЙКИ */}
        <Card className="w-full lg:w-80 bg-zinc-950 border-zinc-800 p-6 flex flex-col gap-6">
            
            {/* ШАГ 1 */}
            <div className={step !== 1 ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><ImageIcon size={18}/> 1. Фото</h3>
                <div className="relative">
                    <Button variant="outline" className="w-full">Выбрать файл</Button>
                    <input 
                        type="file" accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleUpload}
                        disabled={step !== 1}
                    />
                </div>
            </div>

            {/* ШАГ 2 */}
            <div className={step !== 2 ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Wand2 size={18}/> 2. Эффекты</h3>
                <div className="grid grid-cols-2 gap-2">
                    {['none', 'zoom_in', 'pulse', 'shake'].map(anim => (
                        <Button
                            key={anim}
                            size="sm"
                            variant={selectedAnim === anim ? "default" : "secondary"}
                            onClick={() => setSelectedAnim(anim)}
                            className="capitalize"
                        >
                            {anim.replace('_', ' ')}
                        </Button>
                    ))}
                </div>
                <Button 
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700" 
                    onClick={handleAnimate}
                    disabled={step !== 2}
                >
                    Создать
                </Button>
            </div>

            {/* ШАГ 3 */}
            <div className={step !== 3 ? "opacity-50 pointer-events-none" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Download size={18}/> 3. Результат</h3>
                <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => window.open(finalResult || "", "_blank")}
                >
                    Скачать GIF
                </Button>
                <Button variant="ghost" className="w-full mt-2" onClick={() => { setStep(1); setImageSrc(null); }}>
                    Начать заново
                </Button>
            </div>

        </Card>
      </div>
    </div>
  );
}