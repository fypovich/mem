"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Wand2, Download, Image as ImageIcon, Edit3, Scissors, Check, Type, Stamp } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

export default function StickerMakerPage() {
  const [step, setStep] = useState(1);
  
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [maskedSrc, setMaskedSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Settings
  const [anim, setAnim] = useState("none");
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [outlineColor, setOutlineColor] = useState<string | null>(null); // null = нет обводки

  // 1. Загрузка
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setOriginalSrc(URL.createObjectURL(file));
    setStep(2);
  };

  // AI Удаление
  const runAutoRemove = async () => {
    if (!originalSrc) return;
    setIsProcessing(true);
    const toastId = toast.loading("AI удаляет фон...");
    try {
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
                    setStep(3); // ОБЯЗАТЕЛЬНО проверяем результат в редакторе
                    toast.dismiss(toastId);
                }
            } catch (e) {}
        }, 1000);
    } catch (e) { setIsProcessing(false); }
  };

  // Ручной режим
  const startManualMode = () => {
      setMaskedSrc(null);
      setStep(3);
  };

  // Сохранение маски
  const handleMaskSave = async (blob: Blob) => {
      setMaskedSrc(URL.createObjectURL(blob));
      setStep(4);
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
      } catch (e) { setIsProcessing(false); }
  };

  // Генерация
  const handleGenerate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Создание...");

    try {
        // Отправляем все параметры: анимация, текст, обводка
        // @ts-ignore
        const { task_id } = await createSticker(serverPath, anim, {
            text: text,
            text_color: textColor,
            outline_color: outlineColor
        });
        
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
    } catch (e) { setIsProcessing(false); }
  };

  // Рендер MaskEditor
  if (step === 3 && originalSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-black p-4 flex flex-col">
              <h2 className="text-white mb-2 font-bold flex items-center gap-2"><Scissors size={18}/> Удаление фона (Шаг 2/3)</h2>
              <div className="flex-1 overflow-hidden border border-zinc-800 rounded-lg">
                <MaskEditor 
                    originalUrl={originalSrc} 
                    initialMaskedUrl={maskedSrc || undefined}
                    onSave={handleMaskSave}
                    onCancel={() => setStep(2)}
                />
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-white p-6 flex flex-col items-center">
      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl h-[600px]">
        
        {/* ПРЕВЬЮ */}
        <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            
            {step === 1 && (
                <div className="text-center">
                    <Button variant="outline" className="relative cursor-pointer h-32 w-32 rounded-full border-dashed border-2 flex flex-col gap-2">
                        <Upload className="text-zinc-500" />
                        <span className="text-xs text-zinc-500">Загрузить</span>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                    </Button>
                </div>
            )}

            {(step === 2 && originalSrc) && <img src={originalSrc} className="max-h-[80%] object-contain" />}
            
            {step === 4 && maskedSrc && (
                <div className="relative">
                    {/* Эмуляция стилей для превью (не идеально, но дает представление) */}
                    <div style={{ filter: outlineColor ? `drop-shadow(0px 0px 3px ${outlineColor})` : 'none' }}>
                        <img src={maskedSrc} className="max-h-[350px] object-contain" 
                            style={{ 
                                animation: anim === 'spin' ? 'spin 2s linear infinite' : 
                                           anim === 'pulse' ? 'pulse 1s infinite' : 
                                           anim === 'shake' ? 'shake 0.5s infinite' : 'none'
                            }}
                        />
                    </div>
                    {text && (
                        <div className="absolute bottom-0 w-full text-center font-bold text-xl" style={{ 
                            color: textColor, 
                            textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' 
                        }}>
                            {text}
                        </div>
                    )}
                </div>
            )}

            {step === 5 && finalResult && <img src={finalResult} className="max-h-[80%]" />}
            
            {isProcessing && <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500"/></div>}
        </div>

        {/* НАСТРОЙКИ */}
        <Card className="w-full lg:w-80 bg-zinc-950 border-zinc-800 p-4 flex flex-col gap-4 overflow-y-auto">
            {step === 2 && (
                <div className="space-y-3">
                    <h3 className="font-bold">1. Удаление фона</h3>
                    <Button onClick={runAutoRemove} className="w-full bg-blue-600"><Wand2 className="mr-2" size={16}/> Авто (AI)</Button>
                    <div className="text-center text-xs text-zinc-500">- или -</div>
                    <Button onClick={startManualMode} variant="outline" className="w-full"><Scissors className="mr-2" size={16}/> Вручную</Button>
                </div>
            )}

            {step === 4 && (
                <div className="space-y-6">
                    <div>
                        <h3 className="font-bold mb-2 flex items-center gap-2"><Stamp size={16}/> Обводка</h3>
                        <div className="flex gap-2">
                            <div 
                                className={`w-8 h-8 rounded-full border cursor-pointer ${!outlineColor ? 'border-blue-500' : 'border-zinc-700'}`} 
                                onClick={() => setOutlineColor(null)}
                                style={{ background: 'linear-gradient(to right, transparent 50%, red 50%)'}} // перечеркнутый
                                title="Без обводки"
                            />
                            {['#ffffff', '#000000', '#ff0000', '#00ff00', '#ffff00'].map(c => (
                                <div 
                                    key={c}
                                    className={`w-8 h-8 rounded-full border cursor-pointer ${outlineColor === c ? 'ring-2 ring-white' : 'border-zinc-700'}`}
                                    style={{ background: c }}
                                    onClick={() => setOutlineColor(c)}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold mb-2 flex items-center gap-2"><Type size={16}/> Текст</h3>
                        <Input placeholder="Текст стикера..." value={text} onChange={e => setText(e.target.value)} className="mb-2"/>
                        <div className="flex gap-2">
                             <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="h-8 w-full cursor-pointer"/>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold mb-2">Анимация</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {['none', 'zoom_in', 'pulse', 'shake', 'spin', 'swing'].map(a => (
                                <Button 
                                    key={a} variant={anim === a ? "default" : "secondary"} size="sm"
                                    onClick={() => setAnim(a)} className="text-xs"
                                >
                                    {a}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleGenerate} className="w-full bg-purple-600 h-12">Создать</Button>
                </div>
            )}

             {step === 5 && (
                <div className="space-y-3">
                    <h3 className="font-bold text-green-500">Готово!</h3>
                    <Button className="w-full" onClick={() => window.open(finalResult || "", "_blank")}><Download className="mr-2"/> Скачать</Button>
                    <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>Заново</Button>
                </div>
            )}
        </Card>
      </div>
      <style jsx global>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 50% { transform: scale(1.05); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px) rotate(-5deg); } 75% { transform: translateX(5px) rotate(5deg); } }
      `}</style>
    </div>
  );
}