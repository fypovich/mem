"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Wand2, Download, Edit3, Scissors, Check, Type, Stamp, RefreshCcw, Move, Layers } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

// Список новых анимаций
const ANIMATIONS = [
    { id: 'none', label: 'Нет' },
    { id: 'flippy', label: 'Flippy' },
    { id: 'jelly', label: 'Jelly' },
    { id: 'spinny', label: 'Spinny' },
    { id: 'zoomie', label: 'Zoomie' },
    { id: 'tilty', label: 'Tilty' },
    { id: 'peeker', label: 'Peeker' },
    { id: 'floaties', label: 'Floaties' },
    { id: 'bouncy', label: 'Bouncy' },
];

export default function StickerMakerPage() {
  const [step, setStep] = useState(1);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Настройки
  const [anim, setAnim] = useState("none");
  const [outlineColor, setOutlineColor] = useState<string | null>(null);
  const [outlineWidth, setOutlineWidth] = useState(10);
  
  // Текст
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(15);
  const [textPos, setTextPos] = useState({ x: 50, y: 85 });
  
  // Dragging
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);

  // 1. ЗАГРУЗКА
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setOriginalSrc(URL.createObjectURL(file));
    setStep(2);
  };

  // 2. УДАЛЕНИЕ ФОНА (AI)
  const runAutoRemove = async () => {
    if (!originalSrc) return;
    setIsProcessing(true);
    const toastId = toast.loading("Умное удаление фона...");
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
                    setImageSrc(fullUrl);
                    setServerPath(status.result.server_path);
                    setIsProcessing(false);
                    setStep(3); // Проверка маски
                    toast.dismiss(toastId);
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка AI");
                }
            } catch (e) {}
        }, 1000);
    } catch (e) { setIsProcessing(false); }
  };

  // Ручной режим
  const startManualMode = () => {
      setImageSrc(null);
      setStep(3);
  };

  // Сохранение после редактора маски
  const handleMaskSave = async (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
      setStep(4); // Переход к эффектам
      
      // Фоновая загрузка маски
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

  // 3. ТЕКСТ DRAG & DROP
  const handleTextDrag = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingText || !previewRef.current) return;
      
      const rect = previewRef.current.getBoundingClientRect();
      let clientX, clientY;
      
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      
      setTextPos({
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y))
      });
  };

  // 4. ГЕНЕРАЦИЯ
  const handleGenerate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Применяем анимации...");

    try {
        // @ts-ignore
        const { task_id } = await createSticker(serverPath, anim, {
            text: text,
            textColor: textColor,
            textSize: textSize,
            textX: textPos.x / 100,
            textY: textPos.y / 100,
            outlineColor: outlineColor,
            outlineWidth: outlineWidth
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
    } catch (e) { 
        setIsProcessing(false); 
        toast.dismiss(toastId);
        toast.error("Ошибка сервера");
    }
  };

  // --- UI COMPONENT ---

  if (step === 3 && originalSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-zinc-950 p-4 flex flex-col">
               <div className="flex items-center justify-between mb-2 px-2">
                   <h2 className="text-white font-bold flex items-center gap-2">
                       <Scissors size={18}/> Точная настройка фона
                   </h2>
                   <div className="text-xs text-zinc-400">Используйте Лассо для лучшего результата</div>
               </div>
              <div className="flex-1 overflow-hidden border border-zinc-800 rounded-lg bg-zinc-900/50">
                <MaskEditor 
                    originalUrl={originalSrc} 
                    initialMaskedUrl={imageSrc || undefined}
                    onSave={handleMaskSave}
                    onCancel={() => setStep(2)}
                />
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-950 text-white p-4 md:p-8 flex flex-col items-center">
      
      {/* HEADER */}
      <div className="w-full max-w-6xl mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-white bg-clip-text text-transparent">
            Sticker Studio
          </h1>
          {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => {setStep(1); setOriginalSrc(null); setImageSrc(null); setFinalResult(null);}}>
                  <RefreshCcw className="mr-2" size={14}/> Новый стикер
              </Button>
          )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl flex-1 min-h-[600px]">
        
        {/* === LEFT: PREVIEW AREA === */}
        <div className="flex-[2] bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center justify-center relative overflow-hidden backdrop-blur-sm min-h-[400px]">
            
            {/* Checkerboard Background */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#888 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            {/* Step 1: Upload */}
            {step === 1 && (
                <div className="text-center p-10 animate-in zoom-in-95">
                    <div className="relative group cursor-pointer w-40 h-40 mx-auto">
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all" />
                        <div className="relative w-full h-full bg-zinc-900 rounded-full border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center group-hover:border-blue-500 transition-all">
                            <Upload className="text-zinc-500 group-hover:text-blue-400 mb-2" size={32} />
                            <span className="text-xs text-zinc-400 font-medium">Перетащите фото</span>
                        </div>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                    </div>
                </div>
            )}

            {/* Step 2: Source Preview */}
            {(step === 2 && originalSrc) && (
                <img src={originalSrc} className="max-w-full max-h-full object-contain p-4" />
            )}
            
            {/* Step 4: Editor Preview */}
            {step === 4 && imageSrc && (
                <div 
                    ref={previewRef}
                    className="relative w-full h-full flex items-center justify-center p-8 cursor-crosshair overflow-hidden"
                    onMouseMove={handleTextDrag}
                    onMouseUp={() => setIsDraggingText(false)}
                    onMouseLeave={() => setIsDraggingText(false)}
                    onTouchMove={handleTextDrag}
                    onTouchEnd={() => setIsDraggingText(false)}
                >
                    <div className="relative pointer-events-none select-none transition-transform duration-300">
                        <img 
                            src={imageSrc} 
                            className="max-w-full max-h-full object-contain drop-shadow-2xl"
                            style={{ 
                                // Симуляция обводки CSS (не идеальна, но для превью пойдет)
                                filter: outlineColor ? `drop-shadow(0px 0px 1px ${outlineColor}) drop-shadow(0px 0px ${outlineWidth/3}px ${outlineColor})` : 'none',
                                // Предпросмотр анимаций (упрощенный)
                                animation: anim === 'spinny' ? 'spin 3s linear infinite' : 
                                           anim === 'jelly' ? 'pulse 1s infinite' : 
                                           anim === 'tilty' ? 'swing 2s ease-in-out infinite' : 
                                           anim === 'bouncy' ? 'bounce 1s infinite' : 'none',
                                transform: anim === 'flippy' ? 'scaleX(-1)' : 'none'
                            }}
                        />
                    </div>

                    {/* Text Layer */}
                    {text && (
                        <div 
                            className="absolute cursor-move select-none whitespace-nowrap z-50 group hover:scale-105 transition-transform"
                            style={{ 
                                left: `${textPos.x}%`, 
                                top: `${textPos.y}%`,
                                transform: 'translate(-50%, -50%)',
                                fontSize: `${textSize * 2.5}px`,
                                color: textColor,
                                // Stroke emulation for text preview
                                textShadow: '3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: '900'
                            }}
                            onMouseDown={() => setIsDraggingText(true)}
                            onTouchStart={() => setIsDraggingText(true)}
                        >
                            {text}
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-black/60 text-[10px] px-2 rounded text-white pointer-events-none">
                                Перетащи меня
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 5: Final GIF */}
            {step === 5 && finalResult && (
                <div className="flex flex-col items-center">
                    <img src={finalResult} className="max-h-[400px] object-contain mb-4 rounded-md border border-zinc-700" />
                </div>
            )}

            {isProcessing && (
                <div className="absolute inset-0 bg-zinc-950/90 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4" />
                    <p className="text-zinc-300 font-medium animate-pulse">Создаем шедевр...</p>
                </div>
            )}
        </div>

        {/* === RIGHT: CONTROLS === */}
        <Card className="w-full lg:w-[380px] bg-zinc-900 border-zinc-800 flex flex-col h-full shadow-2xl">
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                
                {/* STEP 2: CHOICE */}
                {step === 2 && (
                    <div className="space-y-4 animate-in slide-in-from-right-4">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-white">Удаление фона</h3>
                            <p className="text-xs text-zinc-400">Обязательный шаг</p>
                        </div>
                        
                        <Button onClick={runAutoRemove} className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-md font-semibold">
                            <Wand2 className="mr-2" size={18}/> Автоматически (AI)
                        </Button>
                        
                        <div className="text-center text-xs text-zinc-600 uppercase tracking-widest my-2">Или вручную</div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={startManualMode} variant="outline" className="h-20 flex flex-col border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:text-white hover:border-blue-500/50">
                                <Scissors className="mb-2 text-pink-500" size={20}/>
                                <span>Лассо</span>
                            </Button>
                            <Button onClick={startManualMode} variant="outline" className="h-20 flex flex-col border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:text-white hover:border-blue-500/50">
                                <Edit3 className="mb-2 text-cyan-500" size={20}/>
                                <span>Ластик</span>
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: EDITOR */}
                {step === 4 && (
                    <div className="space-y-8 animate-in fade-in">
                        
                        {/* 1. STROKE */}
                        <div className="space-y-3">
                            <Label className="text-zinc-300 flex justify-between">
                                <span className="flex items-center gap-2"><Stamp size={14}/> Обводка</span>
                                {outlineColor && <span className="text-xs text-blue-400">{outlineWidth}px</span>}
                            </Label>
                            
                            <div className="flex gap-2 flex-wrap">
                                <button 
                                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${!outlineColor ? 'border-blue-500 bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'}`}
                                    onClick={() => setOutlineColor(null)}
                                >
                                    <span className="text-red-500 text-xs">✕</span>
                                </button>
                                {['#ffffff', '#000000', '#ff0055', '#00ff99', '#ffff00', '#00ccff'].map(c => (
                                    <button 
                                        key={c}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${outlineColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                        style={{ background: c }}
                                        onClick={() => setOutlineColor(c)}
                                    />
                                ))}
                            </div>
                            {outlineColor && (
                                <Slider min={2} max={40} step={1} value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} />
                            )}
                        </div>

                        <div className="h-px bg-zinc-800" />

                        {/* 2. TEXT */}
                        <div className="space-y-3">
                            <Label className="text-zinc-300 flex items-center gap-2"><Type size={14}/> Текст</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Текст..." 
                                    value={text} 
                                    onChange={e => setText(e.target.value)} 
                                    className="bg-zinc-950 border-zinc-700 focus:border-blue-500"
                                />
                                <div className="relative w-10 h-10 shrink-0 rounded-md border border-zinc-700 overflow-hidden" style={{backgroundColor: textColor}}>
                                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer"/>
                                </div>
                            </div>
                            {text && (
                                <div className="pt-2">
                                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                        <span>Размер</span>
                                        <span>{textSize}</span>
                                    </div>
                                    <Slider min={10} max={60} step={1} value={[textSize]} onValueChange={v => setTextSize(v[0])} />
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-zinc-800" />

                        {/* 3. ANIMATION */}
                        <div className="space-y-3">
                            <Label className="text-zinc-300 flex items-center gap-2"><Layers size={14}/> Анимация</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {ANIMATIONS.map(a => (
                                    <button 
                                        key={a.id}
                                        onClick={() => setAnim(a.id)} 
                                        className={`text-[10px] py-2 rounded-md font-medium transition-all border ${
                                            anim === a.id 
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-200' 
                                            : 'bg-zinc-800 border-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                    >
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="pt-6 flex flex-col gap-3">
                            <Button onClick={handleGenerate} className="w-full bg-white text-black hover:bg-zinc-200 h-12 font-bold shadow-lg shadow-white/5">
                                <Wand2 className="mr-2" size={18}/> Создать
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="w-full text-zinc-500">
                                <Edit3 className="mr-2" size={14}/> Назад к маске
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 5: RESULT */}
                {step === 5 && (
                    <div className="flex flex-col h-full justify-center animate-in fade-in">
                        <h3 className="text-xl font-bold text-center text-white mb-6">Готово! 🎉</h3>
                        <Button className="w-full bg-green-600 hover:bg-green-700 h-12 mb-3" onClick={() => window.open(finalResult || "", "_blank")}>
                            <Download className="mr-2" size={18}/> Скачать
                        </Button>
                        <Button variant="outline" className="w-full border-zinc-700" onClick={() => { setStep(1); setOriginalSrc(null); setImageSrc(null); setFinalResult(null); setText(""); }}>
                            Создать новый
                        </Button>
                    </div>
                )}
            </div>
        </Card>
      </div>

      {/* Global CSS Animations for Preview */}
      <style jsx global>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes swing { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(15deg); } 75% { transform: rotate(-15deg); } }
      `}</style>
    </div>
  );
}