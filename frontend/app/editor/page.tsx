"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Wand2, Download, Image as ImageIcon, Edit3 } from "lucide-react";
import { toast } from "sonner";
// Импорт uploadTempFile теперь сработает
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
// Убедитесь, что файл mask-editor.tsx находится в папке components/editor/
import { MaskEditor } from "@/components/editor/mask-editor";

export default function StickerMakerPage() {
  const [step, setStep] = useState(1); 
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAnim, setSelectedAnim] = useState("none");
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // 1. Загрузка + Удаление фона
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // Сразу сохраняем оригинал для возможности восстановления ластиком
    setOriginalSrc(URL.createObjectURL(file));

    setIsProcessing(true);
    const toastId = toast.loading("Удаляем фон с помощью AI...");

    try {
        const { task_id } = await processImage(file, "remove_bg");
        
        const interval = setInterval(async () => {
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    
                    // Формируем правильный URL для отображения
                    const fullUrl = getFullUrl(status.result.url);
                    
                    setImageSrc(fullUrl);
                    setServerPath(status.result.server_path);
                    setStep(2);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.success("Фон удален!");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка обработки на сервере");
                }
            } catch (e) { }
        }, 1000);
    } catch (err) {
        console.error(err);
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Ошибка загрузки");
    }
  };

  // 2. Сохранение маски после ручной правки
  const handleMaskSave = async (blob: Blob) => {
      const file = new File([blob], "edited_mask.png", { type: "image/png" });
      
      // Обновляем превью локально
      setImageSrc(URL.createObjectURL(blob));
      setStep(4); // Переходим к эффектам
      
      // Загружаем отредактированную маску на сервер
      setIsProcessing(true); 
      try {
          const { task_id } = await uploadTempFile(file);
          const interval = setInterval(async () => {
              const status = await checkStatus(task_id);
              if (status.status === "SUCCESS") {
                  clearInterval(interval);
                  setServerPath(status.result.server_path);
                  setIsProcessing(false);
                  toast.success("Маска обновлена");
              }
          }, 1000);
      } catch (e) {
          toast.error("Ошибка сохранения маски");
          setIsProcessing(false);
      }
  };

  // 3. Анимация
  const handleAnimate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Создаем GIF...");

    try {
        const { task_id } = await createSticker(serverPath, selectedAnim);
        
        const interval = setInterval(async () => {
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    
                    const fullUrl = getFullUrl(status.result.url);

                    setFinalResult(fullUrl);
                    setStep(5);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.success("Готово!");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка генерации");
                }
            } catch (e) {}
        }, 1000);
    } catch (err) {
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Ошибка генерации");
    }
  };

  // Режим редактора маски (на весь экран)
  if (step === 3 && originalSrc && imageSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-black p-4">
              <MaskEditor 
                  originalUrl={originalSrc} 
                  maskedUrl={imageSrc} 
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
        
        {/* ПРЕВЬЮ */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 min-h-[400px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            
            {step === 1 && (
                <div className="text-center p-8">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="text-zinc-500" size={32} />
                    </div>
                    <p className="text-zinc-400">Загрузите фото (JPG, PNG)</p>
                </div>
            )}

            {(step === 2 || step === 4) && imageSrc && (
                <img 
                    src={imageSrc} 
                    className="relative z-10 max-h-[350px] object-contain transition-transform duration-500"
                    style={{
                        transform: selectedAnim === 'zoom_in' ? 'scale(1.2)' : 'scale(1)',
                        animation: selectedAnim === 'pulse' ? 'pulse 2s infinite' : selectedAnim === 'shake' ? 'spin 1s infinite' : 'none'
                    }}
                    onError={() => console.error("Ошибка загрузки:", imageSrc)}
                />
            )}

            {step === 5 && finalResult && (
                <img src={finalResult} className="relative z-10 max-h-[350px]" />
            )}

            {isProcessing && (
                <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-sm">
                    <Loader2 className="animate-spin text-purple-500 w-12 h-12" />
                </div>
            )}
        </div>

        {/* НАСТРОЙКИ */}
        <Card className="w-full lg:w-80 bg-zinc-950 border-zinc-800 p-6 flex flex-col gap-6 h-fit">
            
            {/* ШАГ 1 */}
            <div className={step !== 1 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><ImageIcon size={18}/> 1. Фото</h3>
                <div className="relative">
                    <Button variant="outline" className="w-full cursor-pointer">Выбрать файл</Button>
                    <input 
                        type="file" accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleUpload}
                        disabled={step !== 1}
                    />
                </div>
            </div>

            {/* ШАГ 2 */}
            <div className={step !== 2 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2">Проверка</h3>
                <p className="text-xs text-zinc-400 mb-4">Фон удален. Нужно исправить?</p>
                <div className="flex flex-col gap-2">
                    <Button onClick={() => setStep(4)} className="bg-green-600 hover:bg-green-700 w-full">
                        Все отлично, далее
                    </Button>
                    <Button onClick={() => setStep(3)} variant="secondary" className="w-full">
                        <Edit3 size={16} className="mr-2"/> Ластик / Кисть
                    </Button>
                </div>
            </div>

            {/* ШАГ 4 */}
            <div className={step !== 4 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Wand2 size={18}/> 2. Эффекты</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
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
                <Button className="w-full bg-purple-600" onClick={handleAnimate}>
                    Создать Стикер
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="mt-2 w-full">
                    Назад к ластику
                </Button>
            </div>

            {/* ШАГ 5 */}
            <div className={step !== 5 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Download size={18}/> 3. Результат</h3>
                <Button className="w-full bg-green-600" onClick={() => window.open(finalResult || "", "_blank")}>
                    Скачать GIF
                </Button>
                <Button variant="ghost" className="w-full mt-2" onClick={() => { setStep(1); setImageSrc(null); setFinalResult(null); }}>
                    Создать новый
                </Button>
            </div>

        </Card>
      </div>
      
      <style jsx global>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes spin { 0% { transform: rotate(0deg); } 25% { transform: rotate(5deg); } 75% { transform: rotate(-5deg); } 100% { transform: rotate(0deg); } }
      `}</style>
    </div>
  );
}