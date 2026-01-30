"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
// ИСПРАВЛЕНО: Добавлен Check в импорт
import { Loader2, Upload, Wand2, Download, Image as ImageIcon, Edit3, Scissors, MousePointer2, Check } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

export default function StickerMakerPage() {
  const [step, setStep] = useState(1);
  // Steps:
  // 1: Upload
  // 2: Choose Method (Auto / Manual)
  // 3: Mask Editor (Manual or Tuning)
  // 4: Effects & Animation
  // 5: Result

  const [originalSrc, setOriginalSrc] = useState<string | null>(null); // Локальный URL оригинала
  const [maskedSrc, setMaskedSrc] = useState<string | null>(null);     // URL обработанного (сервер или blob)
  const [serverPath, setServerPath] = useState<string | null>(null);   // Путь на сервере для ffmpeg
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAnim, setSelectedAnim] = useState("none");
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // 1. Обработка загрузки файла
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setOriginalSrc(url);
    setStep(2); // Сразу идем к выбору метода
  };

  // МЕТОД 1: АВТОМАТИЧЕСКОЕ УДАЛЕНИЕ (AI)
  const runAutoRemove = async () => {
    if (!originalSrc) return;
    setIsProcessing(true);
    const toastId = toast.loading("AI удаляет фон...");

    try {
        // Получаем файл из blob url
        const blob = await fetch(originalSrc).then(r => r.blob());
        const file = new File([blob], "image.png", { type: blob.type });

        const { task_id } = await processImage(file, "remove_bg");
        
        const interval = setInterval(async () => {
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    const fullUrl = getFullUrl(status.result.url);
                    setMaskedSrc(fullUrl);
                    setServerPath(status.result.server_path);
                    setIsProcessing(false);
                    setStep(4); // Успех -> сразу к эффектам
                    toast.dismiss(toastId);
                    toast.success("Готово! Можете добавить эффекты или поправить края.");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("AI не справился, попробуйте вручную");
                }
            } catch (e) {}
        }, 1000);
    } catch (e) {
        setIsProcessing(false);
        toast.error("Ошибка сети");
    }
  };

  // МЕТОД 2: РУЧНОЕ (Лассо/Ластик)
  const startManualMode = () => {
      setMaskedSrc(null); // Сбрасываем маску, начинаем с чистого листа
      setStep(3);
  };

  // Сохранение из MaskEditor
  const handleMaskSave = async (blob: Blob) => {
      // 1. Показываем результат локально
      setMaskedSrc(URL.createObjectURL(blob));
      setStep(4);
      
      // 2. Грузим на сервер для ffmpeg
      setIsProcessing(true);
      try {
          const file = new File([blob], "mask.png", { type: "image/png" });
          const { task_id } = await uploadTempFile(file);
          
          const interval = setInterval(async () => {
             const status = await checkStatus(task_id);
             if (status.status === "SUCCESS") {
                 clearInterval(interval);
                 setServerPath(status.result.server_path);
                 setIsProcessing(false);
             }
          }, 1000);
      } catch (e) {
          toast.error("Ошибка сохранения на сервер");
          setIsProcessing(false);
      }
  };

  // Рендеринг GIF
  const handleAnimate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Создание стикера...");

    try {
        const { task_id } = await createSticker(serverPath, selectedAnim);
        const interval = setInterval(async () => {
            const status = await checkStatus(task_id);
            if (status.status === "SUCCESS") {
                clearInterval(interval);
                setFinalResult(getFullUrl(status.result.url));
                setStep(5);
                setIsProcessing(false);
                toast.dismiss(toastId);
            }
        }, 1000);
    } catch (e) {
        setIsProcessing(false);
        toast.dismiss(toastId);
    }
  };

  // --- RENDER ---

  if (step === 3 && originalSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-black p-4">
              <MaskEditor 
                  originalUrl={originalSrc} 
                  initialMaskedUrl={maskedSrc || undefined}
                  onSave={handleMaskSave}
                  onCancel={() => setStep(2)}
              />
          </div>
      )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-white p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
        Sticker Maker
      </h1>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl">
        
        {/* VIEWPORT */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 min-h-[400px] flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            
            {step === 1 && (
                <div className="text-center p-8">
                    <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                        <Upload className="text-zinc-500" size={40} />
                    </div>
                    <Button variant="outline" className="relative cursor-pointer">
                        Загрузить фото
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                    </Button>
                </div>
            )}

            {(step === 2 && originalSrc) && (
                <img src={originalSrc} className="max-h-[400px] object-contain shadow-2xl" />
            )}

            {step === 4 && maskedSrc && (
                <img 
                    src={maskedSrc} 
                    className="max-h-[350px] object-contain transition-transform duration-500"
                    style={{
                        transform: selectedAnim === 'zoom_in' ? 'scale(1.2)' : 'scale(1)',
                        animation: selectedAnim === 'pulse' ? 'pulse 2s infinite' : selectedAnim === 'shake' ? 'spin 1s infinite' : 'none'
                    }}
                />
            )}

            {step === 5 && finalResult && (
                <img src={finalResult} className="max-h-[400px] object-contain" />
            )}

            {isProcessing && (
                <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="animate-spin text-purple-500 w-12 h-12 mb-4" />
                    <p className="text-zinc-400 animate-pulse">Обработка...</p>
                </div>
            )}
        </div>

        {/* CONTROLS */}
        <Card className="w-full lg:w-96 bg-zinc-950 border-zinc-800 p-6 flex flex-col gap-6 h-fit relative z-10">
            
            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h3 className="font-bold mb-4 text-lg">Как удалить фон?</h3>
                    <div className="space-y-3">
                        <Button 
                            onClick={runAutoRemove} 
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-12 text-md"
                        >
                            <Wand2 className="mr-2" size={18}/> Автоматически (AI)
                        </Button>
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-950 px-2 text-zinc-500">Или вручную</span></div>
                        </div>
                        <Button onClick={startManualMode} variant="outline" className="w-full h-12 justify-start px-4">
                            <Scissors className="mr-2 text-zinc-400" size={18}/> Вырезать (Лассо)
                        </Button>
                        <Button onClick={startManualMode} variant="outline" className="w-full h-12 justify-start px-4">
                            <Edit3 className="mr-2 text-zinc-400" size={18}/> Ластик
                        </Button>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">Эффекты</h3>
                        <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="text-zinc-400 text-xs h-6">
                            <Edit3 size={12} className="mr-1"/> Поправить края
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {['none', 'zoom_in', 'pulse', 'shake'].map(anim => (
                            <div 
                                key={anim}
                                onClick={() => setSelectedAnim(anim)}
                                className={`
                                    cursor-pointer rounded-lg border p-3 text-center text-sm font-medium transition-all
                                    ${selectedAnim === anim ? "border-purple-500 bg-purple-500/10 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"}
                                `}
                            >
                                {anim === 'none' ? 'Нет' : anim.replace('_', ' ')}
                            </div>
                        ))}
                    </div>

                    <Button className="w-full bg-white text-black hover:bg-zinc-200 h-12 font-bold" onClick={handleAnimate}>
                        Экспорт GIF
                    </Button>
                </div>
            )}

            {step === 5 && (
                <div className="animate-in zoom-in-95">
                    <h3 className="font-bold mb-4 text-green-500 flex items-center gap-2">
                        <Check className="w-5 h-5"/> Готово!
                    </h3>
                    <Button className="w-full bg-zinc-800 hover:bg-zinc-700 mb-3" onClick={() => window.open(finalResult || "", "_blank")}>
                        <Download className="mr-2" size={16}/> Скачать файл
                    </Button>
                    <Button variant="link" className="w-full text-zinc-500" onClick={() => { setStep(1); setOriginalSrc(null); setMaskedSrc(null); }}>
                        Создать еще один
                    </Button>
                </div>
            )}
        </Card>
      </div>
    </div>
  );
}