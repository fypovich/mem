"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Wand2, Download, Edit3, Scissors, Check, Type, Stamp, RefreshCcw, Move, Layers, Palette } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

const ANIMATIONS = [
    { id: 'none', label: 'Нет' },
    { id: 'spinny', label: 'Spinny' },
    { id: 'zoomie', label: 'Zoomie' },
    { id: 'flippy', label: 'Flippy' },
    { id: 'tilty', label: 'Tilty' },
    { id: 'jelly', label: 'Jelly' },
    { id: 'bouncy', label: 'Bouncy' },
    { id: 'peeker', label: 'Peeker' },
    { id: 'floaties', label: 'Floaties' },
];

export default function StickerMakerPage() {
  const [step, setStep] = useState(1);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Settings
  const [anim, setAnim] = useState("none");
  const [outlineColor, setOutlineColor] = useState<string | null>(null);
  const [outlineWidth, setOutlineWidth] = useState(6);
  
  // Text
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(20);
  const [textPos, setTextPos] = useState({ x: 50, y: 80 });
  
  // Dragging
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setOriginalSrc(URL.createObjectURL(file));
    setStep(2);
  };

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
                    setImageSrc(fullUrl);
                    setServerPath(status.result.server_path);
                    setIsProcessing(false);
                    setStep(3);
                    toast.dismiss(toastId);
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

  const handleGenerate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Создаем GIF...");

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
        toast.error("Ошибка");
    }
  };

  // --- CONTENT COMPONENT (SYNC TEXT AND IMAGE) ---
  const StickerContent = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
      <div className={`relative inline-block ${className}`} style={style}>
          <img 
              src={imageSrc!} 
              className="max-h-[300px] w-auto object-contain pointer-events-none select-none"
              style={{ filter: outlineColor ? 'url(#hard-outline)' : 'none' }} // Применяем фильтр к изображению
          />
          {text && (
              <div 
                  className="absolute cursor-move select-none whitespace-nowrap z-50 font-black leading-none text-center"
                  style={{ 
                      left: `${textPos.x}%`, 
                      top: `${textPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${textSize * 2.5}px`,
                      color: textColor,
                      WebkitTextStroke: '1.5px black', // Hard stroke for preview text
                      fontFamily: 'Impact, sans-serif',
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); setIsDraggingText(true); }}
                  onTouchStart={(e) => { e.stopPropagation(); setIsDraggingText(true); }}
              >
                  {text}
              </div>
          )}
      </div>
  );

  if (step === 3 && originalSrc) {
      return (
          <div className="h-[calc(100vh-64px)] bg-zinc-950 p-4 flex flex-col">
               <div className="flex items-center justify-between mb-2 px-2">
                   <h2 className="text-white font-bold flex items-center gap-2"><Scissors size={18}/> Точная настройка</h2>
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
      
      {/* SVG FILTER FOR HARD STROKE */}
      <svg width="0" height="0" className="absolute">
        {/* Увеличиваем область фильтра, чтобы обводка не обрезалась */}
        <filter id="hard-outline" x="-50%" y="-50%" width="200%" height="200%">
          <feMorphology operator="dilate" radius={outlineWidth / 3} in="SourceAlpha" result="dilated"/>
          <feFlood floodColor={outlineColor || 'transparent'} result="flood"/>
          <feComposite in="flood" in2="dilated" operator="in" result="outline"/>
          <feMerge>
            <feMergeNode in="outline"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </svg>

      <div className="w-full max-w-6xl mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-indigo-500 bg-clip-text text-transparent">Sticker Maker</h1>
          {step > 1 && <Button variant="ghost" size="sm" onClick={() => {setStep(1); setOriginalSrc(null); setImageSrc(null); setFinalResult(null); setText(""); }}><RefreshCcw className="mr-2" size={14}/> Заново</Button>}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl flex-1 min-h-[600px]">
        
        {/* === PREVIEW === */}
        <div className="flex-[2] bg-zinc-900/50 rounded-xl border border-zinc-800 flex items-center justify-center relative overflow-hidden backdrop-blur-sm min-h-[400px]">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#888 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            {step === 1 && (
                <div className="text-center p-10 cursor-pointer" onClick={() => document.getElementById('file-upload')?.click()}>
                    <div className="relative w-40 h-40 mx-auto bg-zinc-900 rounded-full border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center hover:border-pink-500 transition-colors">
                        <Upload className="text-zinc-500 mb-2" size={32} />
                        <span className="text-xs text-zinc-400 font-medium">Загрузить фото</span>
                    </div>
                    <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </div>
            )}

            {(step === 2 && originalSrc) && <img src={originalSrc} className="max-w-full max-h-full object-contain p-4" />}
            
            {step === 4 && imageSrc && (
                <div 
                    ref={previewRef}
                    className="relative w-full h-full flex items-center justify-center p-10 cursor-crosshair overflow-hidden"
                    onMouseMove={handleTextDrag}
                    onMouseUp={() => setIsDraggingText(false)}
                    onMouseLeave={() => setIsDraggingText(false)}
                    onTouchMove={handleTextDrag}
                    onTouchEnd={() => setIsDraggingText(false)}
                >
                    {/* CONTAINER WRAPPER FOR SYNCED ANIMATION */}
                    {/* Для Peeker нужен flex-end, чтобы объект выезжал снизу */}
                    <div className={`relative ${anim === 'peeker' ? 'w-full h-full flex justify-center items-end overflow-hidden pb-10' : ''}`}>
                         <div 
                            className="will-change-transform relative inline-block"
                            style={{ 
                                animation: `${anim} 2s infinite linear`,
                                animationTimingFunction: 
                                    ['bouncy', 'jelly', 'zoomie', 'tilty'].includes(anim) ? 'ease-in-out' : 
                                    anim === 'flippy' ? 'steps(1, end)' : 'linear',
                                transformOrigin: ['tilty', 'bouncy'].includes(anim) ? 'bottom center' : 'center center',
                                // Фильтр применяется внутри StickerContent к картинке, чтобы не мылить весь контейнер
                            }}
                        >
                            {/* Floaties Ghosts - слои для шлейфа */}
                            {anim === 'floaties' && [1, 2, 3].map(i => (
                                <div key={i} className="absolute inset-0 pointer-events-none" 
                                     style={{ 
                                         animation: `floaties 2s infinite ease-in-out`, 
                                         animationDelay: `-${i * 0.15}s`,
                                         opacity: 0.4 / i,
                                         zIndex: -i 
                                     }}>
                                     <StickerContent />
                                </div>
                            ))}
                            
                            {/* Main Content */}
                            <div style={{ animation: anim === 'floaties' ? 'floaties 2s infinite ease-in-out' : 'none' }}>
                                <StickerContent />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 5 && finalResult && <div className="flex flex-col items-center"><img src={finalResult} className="max-h-[400px] object-contain mb-4 rounded-md border border-zinc-700" /></div>}
            
            {isProcessing && (
                <div className="absolute inset-0 bg-zinc-950/90 z-50 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-pink-500 w-12 h-12 mb-4" />
                    <p className="text-zinc-300">Обработка...</p>
                </div>
            )}
        </div>

        {/* === CONTROLS === */}
        <Card className="w-full lg:w-[380px] bg-zinc-900 border-zinc-800 flex flex-col h-full shadow-2xl">
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                
                {step === 2 && (
                    <div className="space-y-4">
                        <Button onClick={runAutoRemove} className="w-full bg-blue-600 hover:bg-blue-700 h-14 font-semibold"><Wand2 className="mr-2" size={18}/> Авто (AI)</Button>
                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={startManualMode} variant="outline" className="h-20 flex flex-col"><Scissors className="mb-2 text-pink-500" size={20}/> <span>Лассо</span></Button>
                            <Button onClick={startManualMode} variant="outline" className="h-20 flex flex-col"><Edit3 className="mb-2 text-cyan-500" size={20}/> <span>Ластик</span></Button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-8 animate-in fade-in">
                        {/* STROKE */}
                        <div className="space-y-3">
                            <Label className="flex justify-between"><span className="flex gap-2"><Stamp size={14}/> Обводка</span>{outlineColor && <span className="text-xs text-blue-400">{outlineWidth}px</span>}</Label>
                            <div className="flex gap-2 flex-wrap">
                                <button className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${!outlineColor ? 'border-blue-500' : 'border-zinc-700'}`} onClick={() => setOutlineColor(null)}>✕</button>
                                {['#ffffff', '#000000', '#ff0055', '#00ff99', '#ffff00', '#00ccff'].map(c => (
                                    <button key={c} className={`w-8 h-8 rounded-full border-2 ${outlineColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }} onClick={() => setOutlineColor(c)}/>
                                ))}
                            </div>
                            {outlineColor && <Slider min={0} max={20} step={1} value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} />}
                        </div>
                        <div className="h-px bg-zinc-800" />
                        
                        {/* TEXT */}
                        <div className="space-y-3">
                            <Label className="flex gap-2"><Type size={14}/> Текст</Label>
                            <div className="flex gap-2">
                                <Input placeholder="Текст..." value={text} onChange={e => setText(e.target.value)} className="bg-zinc-950 border-zinc-700"/>
                                <div className="relative w-10 h-10 rounded-md border border-zinc-700 overflow-hidden" style={{backgroundColor: textColor}}>
                                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer"/>
                                </div>
                            </div>
                            {text && <Slider min={10} max={50} step={1} value={[textSize]} onValueChange={v => setTextSize(v[0])} className="mt-2"/>}
                        </div>
                        <div className="h-px bg-zinc-800" />
                        
                        {/* ANIMATION */}
                        <div className="space-y-3">
                            <Label className="flex gap-2"><Layers size={14}/> Анимация</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {ANIMATIONS.map(a => (
                                    <button key={a.id} onClick={() => setAnim(a.id)} className={`text-[10px] py-2 rounded-md font-medium border ${anim === a.id ? 'bg-blue-600/20 border-blue-500 text-blue-200' : 'bg-zinc-800 border-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{a.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="pt-4 flex flex-col gap-3">
                            <Button onClick={handleGenerate} className="w-full bg-white text-black hover:bg-zinc-200 h-12 font-bold"><Wand2 className="mr-2" size={18}/> Создать</Button>
                            <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="w-full text-zinc-500"><Edit3 className="mr-2" size={14}/> Назад</Button>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="flex flex-col h-full justify-center animate-in fade-in">
                        <h3 className="text-xl font-bold text-center text-white mb-6">Готово! 🎉</h3>
                        <Button className="w-full bg-green-600 hover:bg-green-700 h-12 mb-3" onClick={() => window.open(finalResult || "", "_blank")}><Download className="mr-2" size={18}/> Скачать</Button>
                        <Button variant="outline" className="w-full border-zinc-700" onClick={() => { setStep(1); setOriginalSrc(null); setImageSrc(null); setFinalResult(null); setText(""); }}>Создать новый</Button>
                    </div>
                )}
            </div>
        </Card>
      </div>
    </div>
  );
}