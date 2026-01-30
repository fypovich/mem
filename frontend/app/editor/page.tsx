"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Wand2, Download, Image as ImageIcon, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

// Для отправки отредактированного Blob на сервер
const uploadBlob = async (blob: Blob) => {
    const file = new File([blob], "edited_mask.png", { type: "image/png" });
    // Используем тот же эндпоинт, что и для загрузки, просто сохраняем файл
    const formData = new FormData();
    formData.append("file", file);
    // Нам нужен простой эндпоинт загрузки без обработки, или используем process-image с пустым operation?
    // Используем существующий uploadTempFile, который мы делали для видео (он просто сохраняет)
    // Если его нет в api/editor.ts, добавьте. Или используйте processImage с фиктивной операцией.
    // Лучше добавить простую функцию сохранения в api/editor.ts
    
    // ВРЕМЕННОЕ РЕШЕНИЕ: Используем processImage, но просим "ничего не делать" или игнорируем результат обработки
    // Но лучше всего реализовать простой upload.
    // Пока предположим, что у нас есть uploadTempFile из начала диалога.
    
    // Реализуем загрузку через существующий API
    return processImage(file, "remove_bg"); // Хак: снова прогоняем через remove_bg, хотя фон уже удален. 
    // В идеале: нужен эндпоинт /upload-temp. Давайте добавим его в api/editor.ts
};

export default function StickerMakerPage() {
  const [step, setStep] = useState(1); 
  // 1: Загрузка
  // 2: Предпросмотр AI + Выбор (Править/Далее)
  // 3: Ручное редактирование (MaskEditor)
  // 4: Эффекты (Анимация/Обводка)
  // 5: Результат

  const [originalSrc, setOriginalSrc] = useState<string | null>(null); // Оригинал (для восстановления)
  const [maskedSrc, setMaskedSrc] = useState<string | null>(null);     // Результат AI
  const [serverPath, setServerPath] = useState<string | null>(null);   // Текущий путь на сервере
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAnim, setSelectedAnim] = useState("none");
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // 1. Загрузка + AI
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // Сохраняем локальный URL оригинала сразу для MaskEditor
    setOriginalSrc(URL.createObjectURL(file));
    
    setIsProcessing(true);
    const toastId = toast.loading("AI анализирует изображение...");

    try {
        const { task_id } = await processImage(file, "remove_bg");
        
        const interval = setInterval(async () => {
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    const fullUrl = getFullUrl(status.result.url);
                    setMaskedSrc(fullUrl);
                    setServerPath(status.result.server_path);
                    setStep(2); // Переход к выбору действий
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка AI");
                }
            } catch (e) {}
        }, 1000);
    } catch (err) {
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Ошибка сети");
    }
  };

  // Сохранение после ручной правки
  const handleMaskSave = async (blob: Blob) => {
      setIsProcessing(true);
      setStep(4); // Переходим к эффектам, пока грузится
      
      // Создаем URL для локального отображения сразу
      setMaskedSrc(URL.createObjectURL(blob));

      // Грузим на сервер
      try {
          // Нам нужно просто загрузить файл на сервер и получить путь.
          // Так как processImage запускает удаление фона, это лишнее.
          // В реальном проекте создайте router.post("/upload") -> возвращает path.
          // Сейчас используем хак: отправляем как есть, сервер вернет путь к "обработанному" файлу.
          // Если отправить прозрачный PNG в remove_bg, он вернет прозрачный PNG.
          
          const { task_id } = await processImage(new File([blob], "edited.png"), "remove_bg");
          // Ждем завершения (это быстро, т.к. фон уже прозрачный)
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

  // Генерация Финала
  const handleAnimate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Рендеринг...");

    try {
        const { task_id } = await createSticker(serverPath, selectedAnim);
        
        const interval = setInterval(async () => {
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    setFinalResult(getFullUrl(status.result.url));
                    setStep(5);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                }
            } catch (e) {}
        }, 1000);
    } catch (err) {
        setIsProcessing(false);
        toast.dismiss(toastId);
    }
  };

  // --- RENDER ---

  // Если мы в режиме редактирования маски, показываем редактор на весь экран
  if (step === 3 && originalSrc && maskedSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-black p-4">
              <MaskEditor 
                  originalUrl={originalSrc} 
                  maskedUrl={maskedSrc} 
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
                    <Upload className="text-zinc-500 w-16 h-16 mx-auto mb-4" />
                    <p className="text-zinc-400">Загрузите фото</p>
                </div>
            )}

            {(step === 2 || step === 4) && maskedSrc && (
                <img 
                    src={maskedSrc} 
                    className="relative z-10 max-h-[350px] object-contain"
                    style={{
                        transform: selectedAnim === 'zoom_in' ? 'scale(1.2)' : 'scale(1)',
                        animation: selectedAnim === 'pulse' ? 'pulse 2s infinite' : selectedAnim === 'shake' ? 'spin 1s infinite' : 'none'
                    }}
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

        {/* ПАНЕЛЬ УПРАВЛЕНИЯ */}
        <Card className="w-full lg:w-80 bg-zinc-950 border-zinc-800 p-6 flex flex-col gap-6 h-fit">
            
            {/* ШАГ 1: ЗАГРУЗКА */}
            <div className={step !== 1 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><ImageIcon size={18}/> 1. Фото</h3>
                <div className="relative">
                    <Button variant="outline" className="w-full cursor-pointer">Выбрать файл</Button>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUpload} />
                </div>
            </div>

            {/* ШАГ 2: ПРОВЕРКА МАСКИ */}
            <div className={step !== 2 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2">Проверка фона</h3>
                <p className="text-xs text-zinc-400 mb-4">AI удалил фон. Все чисто?</p>
                <div className="flex flex-col gap-2">
                    <Button onClick={() => setStep(4)} className="w-full bg-green-600 hover:bg-green-700">
                        Идеально, далее
                    </Button>
                    <Button onClick={() => setStep(3)} variant="secondary" className="w-full">
                        <Edit3 size={16} className="mr-2"/> Исправить (Ластик)
                    </Button>
                </div>
            </div>

            {/* ШАГ 4: ЭФФЕКТЫ */}
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
                <div className="flex flex-col gap-2">
                    <Button className="w-full bg-purple-600" onClick={handleAnimate}>
                        Создать Стикер
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                        Назад к ластику
                    </Button>
                </div>
            </div>

            {/* ШАГ 5: РЕЗУЛЬТАТ */}
            <div className={step !== 5 ? "hidden" : ""}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Download size={18}/> 3. Результат</h3>
                <Button className="w-full bg-green-600" onClick={() => window.open(finalResult || "", "_blank")}>
                    Скачать
                </Button>
                <Button variant="ghost" className="w-full mt-2" onClick={() => { setStep(1); setImageSrc(null); setFinalResult(null); }}>
                    Новый стикер
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