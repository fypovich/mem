"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Wand2, Download, Image as ImageIcon, Edit3, Scissors, Check, Type, Stamp, RefreshCcw, Move } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

export default function StickerMakerPage() {
  const [step, setStep] = useState(1);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // --- SETTINGS ---
  const [anim, setAnim] = useState("none");
  const [outlineColor, setOutlineColor] = useState<string | null>(null);
  const [outlineWidth, setOutlineWidth] = useState(10);
  
  // Text State
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(15); // % от высоты
  const [textPos, setTextPos] = useState({ x: 50, y: 80 }); // % (50, 80)
  
  // Dragging logic for text
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
    const toastId = toast.loading("AI анализирует изображение...");
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
                    setMaskedSrcHelper(fullUrl, status.result.server_path);
                    setStep(4);
                    toast.dismiss(toastId);
                    toast.success("Фон удален успешно!");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("AI не справился");
                }
            } catch (e) {}
        }, 1000);
    } catch (e) { setIsProcessing(false); }
  };

  // Helpers
  const setMaskedSrcHelper = (url: string, path: string) => {
      setImageSrc(url);
      setServerPath(path);
      setIsProcessing(false);
  };

  const startManualMode = () => {
      setImageSrc(null);
      setStep(3);
  };

  const handleMaskSave = async (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
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

  // 3. ТЕКСТ DRAG & DROP
  const handleTextDrag = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDraggingText || !previewRef.current) return;
      e.preventDefault(); // Prevent scrolling on touch

      const rect = previewRef.current.getBoundingClientRect();
      let clientX, clientY;
      
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      // Вычисляем % относительно контейнера
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      
      // Ограничиваем 0-100
      setTextPos({
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y))
      });
  };

  // 4. ГЕНЕРАЦИЯ
  const handleGenerate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Рендеринг стикера...");

    try {
        // @ts-ignore
        const { task_id } = await createSticker(serverPath, anim, {
            text: text,
            text_color: textColor,
            text_size: textSize,
            text_x: textPos.x / 100, // Переводим в 0.0-1.0
            text_y: textPos.y / 100,
            outline_color: outlineColor,
            outline_width: outlineWidth
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
        toast.error("Ошибка генерации");
    }
  };

  // --- RENDERERS ---

  if (step === 3 && originalSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-zinc-950 p-4 flex flex-col">
               <div className="flex items-center justify-between mb-2 px-2">
                   <h2 className="text-white font-bold flex items-center gap-2"><Scissors size={18}/> Удаление фона</h2>
                   <div className="text-xs text-zinc-400">Шаг 2 из 3</div>
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
      <div className="w-full max-w-6xl mb-8 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Sticker Maker
          </h1>
          {step > 1 && (
              <Button variant="ghost" size="sm" onClick={() => {setStep(1); setOriginalSrc(null); setImageSrc(null);}}>
                  <RefreshCcw className="mr-2" size={14}/> Начать заново
              </Button>
          )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl h-[calc(100vh-200px)] min-h-[600px]">
        
        {/* === LEFT: PREVIEW === */}
        <div className="flex-1 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 flex items-center justify-center relative overflow-hidden backdrop-blur-sm">
            
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            {/* Step 1: Upload UI */}
            {step === 1 && (
                <div className="text-center p-8 animate-in zoom-in-95 duration-300">
                    <div className="relative group cursor-pointer">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
                        <div className="relative w-32 h-32 bg-zinc-900 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center group-hover:border-indigo-500 group-hover:scale-105 transition-all duration-300">
                            <Upload className="text-zinc-500 group-hover:text-indigo-400 transition-colors" size={40} />
                        </div>
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileSelect} />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-white">Загрузите изображение</h3>
                    <p className="text-zinc-500 mt-2 text-sm">JPG, PNG, WEBP до 10MB</p>
                </div>
            )}

            {/* Step 2: Original Preview */}
            {(step === 2 && originalSrc) && (
                <img src={originalSrc} className="max-h-[80%] max-w-[90%] object-contain shadow-2xl rounded-lg animate-in fade-in" />
            )}
            
            {/* Step 4: Editor Preview (Interactive) */}
            {step === 4 && imageSrc && (
                <div 
                    ref={previewRef}
                    className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-crosshair"
                    onMouseMove={handleTextDrag}
                    onMouseUp={() => setIsDraggingText(false)}
                    onMouseLeave={() => setIsDraggingText(false)}
                    onTouchMove={handleTextDrag}
                    onTouchEnd={() => setIsDraggingText(false)}
                >
                    <div className="relative max-h-[80%] max-w-[90%] pointer-events-none select-none">
                        <img 
                            src={imageSrc} 
                            className="w-full h-full object-contain drop-shadow-2xl"
                            style={{ 
                                filter: outlineColor ? `drop-shadow(0px 0px 1px ${outlineColor}) drop-shadow(0px 0px ${outlineWidth/2}px ${outlineColor})` : 'none',
                                animation: anim === 'spin' ? 'spin 3s linear infinite' : 
                                           anim === 'pulse' ? 'pulse 1.5s infinite' : 
                                           anim === 'shake' ? 'shake 0.5s infinite' : 
                                           anim === 'swing' ? 'swing 2s ease-in-out infinite' : 'none',
                                transform: anim === 'zoom_in' ? 'scale(1.1)' : 'none'
                            }}
                        />
                    </div>

                    {/* Text Overlay Layer */}
                    {text && (
                        <div 
                            className="absolute cursor-move select-none whitespace-nowrap z-50 group"
                            style={{ 
                                left: `${textPos.x}%`, 
                                top: `${textPos.y}%`,
                                transform: 'translate(-50%, -50%)',
                                fontSize: `${textSize * 2}px`, // Множитель для превью
                                color: textColor,
                                textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                                fontFamily: 'sans-serif',
                                fontWeight: 'bold'
                            }}
                            onMouseDown={() => setIsDraggingText(true)}
                            onTouchStart={() => setIsDraggingText(true)}
                        >
                            {text}
                            {/* Drag Indicator */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded px-1">
                                <Move size={12}/>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 5: Final Result */}
            {step === 5 && finalResult && (
                <div className="text-center animate-in zoom-in-95">
                    <img src={finalResult} className="max-h-[400px] object-contain mb-4 rounded-lg border border-zinc-700 bg-zinc-950/50" />
                    <div className="text-sm text-zinc-500">Стикер готов к отправке!</div>
                </div>
            )}

            {/* Loader Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-zinc-950/80 z-50 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in">
                    <Loader2 className="animate-spin text-indigo-500 w-12 h-12 mb-4" />
                    <p className="text-zinc-300 font-medium animate-pulse">Магия в процессе...</p>
                </div>
            )}
        </div>

        {/* === RIGHT: CONTROLS === */}
        <Card className="w-full lg:w-[400px] bg-zinc-900 border-zinc-800 p-0 flex flex-col h-full overflow-hidden shadow-xl">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                
                {/* STEP 2: REMOVAL METHOD */}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Удаление фона</h3>
                            <p className="text-sm text-zinc-400">Выберите способ обработки</p>
                        </div>
                        
                        <Button 
                            onClick={runAutoRemove} 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-14 text-md relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <Wand2 className="mr-3" size={20}/> Автоматически (AI)
                        </Button>
                        
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-900 px-2 text-zinc-500">Ручной режим</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={startManualMode} variant="outline" className="h-24 flex flex-col gap-2 border-zinc-700 hover:bg-zinc-800 hover:text-white">
                                <Scissors className="text-pink-500" size={24}/>
                                <span>Лассо</span>
                            </Button>
                            <Button onClick={startManualMode} variant="outline" className="h-24 flex flex-col gap-2 border-zinc-700 hover:bg-zinc-800 hover:text-white">
                                <Edit3 className="text-blue-500" size={24}/>
                                <span>Ластик</span>
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: EDITOR CONTROLS */}
                {step === 4 && (
                    <div className="space-y-8 animate-in fade-in">
                        {/* 1. Outline */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-zinc-200 flex items-center gap-2"><Stamp size={16}/> Обводка</Label>
                                {outlineColor && <span className="text-xs text-zinc-500">{outlineWidth}px</span>}
                            </div>
                            
                            <div className="flex gap-2 flex-wrap">
                                <button 
                                    className={`w-8 h-8 rounded-full border transition-all ${!outlineColor ? 'border-indigo-500 scale-110' : 'border-zinc-700 hover:border-zinc-500'}`}
                                    onClick={() => setOutlineColor(null)}
                                    title="Нет обводки"
                                >
                                    <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center">
                                        <div className="w-full h-[2px] bg-red-500 rotate-45 transform" />
                                    </div>
                                </button>
                                {['#ffffff', '#000000', '#ff0055', '#00ff99', '#ffff00', '#00ccff'].map(c => (
                                    <button 
                                        key={c}
                                        className={`w-8 h-8 rounded-full border transition-all ${outlineColor === c ? 'border-white scale-110 ring-2 ring-white/20' : 'border-zinc-700'}`}
                                        style={{ background: c }}
                                        onClick={() => setOutlineColor(c)}
                                    />
                                ))}
                            </div>
                            
                            {outlineColor && (
                                <Slider 
                                    min={2} max={30} step={1} 
                                    value={[outlineWidth]} 
                                    onValueChange={(v) => setOutlineWidth(v[0])}
                                    className="mt-2"
                                />
                            )}
                        </div>

                        <div className="h-px bg-zinc-800/50" />

                        {/* 2. Text */}
                        <div className="space-y-3">
                            <Label className="text-zinc-200 flex items-center gap-2"><Type size={16}/> Текст</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Введите текст..." 
                                    value={text} 
                                    onChange={e => setText(e.target.value)} 
                                    className="bg-zinc-950 border-zinc-800 focus:ring-indigo-500/50"
                                />
                                <div className="relative w-10 h-10 shrink-0">
                                    <input 
                                        type="color" 
                                        value={textColor} 
                                        onChange={e => setTextColor(e.target.value)} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="w-full h-full rounded-md border border-zinc-700 flex items-center justify-center" style={{ backgroundColor: textColor }}>
                                        <Type size={14} className="mix-blend-difference text-white"/>
                                    </div>
                                </div>
                            </div>
                            {text && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-zinc-500">
                                        <span>Размер</span>
                                        <span>{textSize}%</span>
                                    </div>
                                    <Slider min={5} max={40} step={1} value={[textSize]} onValueChange={v => setTextSize(v[0])} />
                                    <p className="text-[10px] text-indigo-400 mt-1">* Перетащите текст на картинке для позиционирования</p>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-zinc-800/50" />

                        {/* 3. Animation */}
                        <div className="space-y-3">
                            <Label className="text-zinc-200">Анимация</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['none', 'zoom_in', 'pulse', 'shake', 'spin', 'swing'].map(a => (
                                    <Button 
                                        key={a} 
                                        variant={anim === a ? "default" : "secondary"} 
                                        size="sm"
                                        onClick={() => setAnim(a)} 
                                        className={`text-xs h-9 ${anim === a ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'}`}
                                    >
                                        {a === 'none' ? 'Нет' : a.replace('_', ' ')}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button onClick={handleGenerate} className="w-full bg-white text-black hover:bg-zinc-200 h-12 font-bold shadow-lg shadow-white/5">
                                <Wand2 className="mr-2" size={18}/> Создать Стикер
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="w-full mt-2 text-zinc-500 hover:text-zinc-300">
                                <Edit3 size={14} className="mr-2"/> Вернуться к маске
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 5: DONE */}
                {step === 5 && (
                    <div className="flex flex-col h-full justify-center animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                <Check className="text-green-500" size={32}/>
                            </div>
                            <h3 className="text-xl font-bold text-white">Готово!</h3>
                            <p className="text-zinc-500 mt-1">Ваш стикер создан</p>
                        </div>
                        
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 mb-3" onClick={() => window.open(finalResult || "", "_blank")}>
                            <Download className="mr-2" size={18}/> Скачать GIF
                        </Button>
                        <Button variant="outline" className="w-full border-zinc-800 hover:bg-zinc-900" onClick={() => { setStep(1); setOriginalSrc(null); setMaskedSrc(null); setFinalResult(null); }}>
                            Создать новый
                        </Button>
                    </div>
                )}

            </div>
        </Card>
      </div>

      <style jsx global>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 50% { transform: scale(1.05); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px) rotate(-5deg); } 75% { transform: translateX(5px) rotate(5deg); } }
        @keyframes swing { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(15deg); } 75% { transform: rotate(-15deg); } }
      `}</style>
    </div>
  );
}