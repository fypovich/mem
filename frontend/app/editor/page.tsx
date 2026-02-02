"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// ИСПРАВЛЕНО: Добавлен Check в импорты
import { Loader2, Upload, Download, RefreshCcw, Layers, Type, Stamp, Sparkles, Wand2, Scissors, Edit3, Check } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor } from "@/components/editor/mask-editor";

// Анимации с превью-иконками
const ANIMATIONS = [
    { id: 'none', label: 'Нет', icon: '🚫' },
    { id: 'bouncy', label: 'Bouncy', icon: '🏀' },
    { id: 'jelly', label: 'Jelly', icon: '🍮' },
    { id: 'flippy', label: 'Flippy', icon: '🔄' },
    { id: 'spinny', label: 'Spinny', icon: '🌪️' },
    { id: 'zoomie', label: 'Zoomie', icon: '🔎' },
    { id: 'tilty', label: 'Tilty', icon: '🤪' },
    { id: 'floaties', label: 'Floaties', icon: '👻' },
    { id: 'peeker', label: 'Peeker', icon: '🙈' },
];

export default function StickerMakerPage() {
  const [step, setStep] = useState(1); // 1:Upload -> 2:Mask -> 3:Effects -> 4:Result
  
  const [imageSrc, setImageSrc] = useState<string | null>(null); // Маска
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Settings
  const [anim, setAnim] = useState("none");
  const [outlineColor, setOutlineColor] = useState<string | null>("#ffffff");
  const [outlineWidth, setOutlineWidth] = useState(6);
  
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(25);
  const [textPos, setTextPos] = useState({ x: 50, y: 85 });
  
  // Dragging
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);

  // 1. UPLOAD
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setOriginalSrc(URL.createObjectURL(file));
    setStep(2); // Сразу в редактор фона
  };

  // 2. AUTO REMOVE (вызывается из MaskEditor)
  const handleAutoRemove = async () => {
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
                    // Обновляем imageSrc, MaskEditor перерисуется
                    setImageSrc(fullUrl); 
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.success("Готово!");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка AI");
                }
            } catch (e) {}
        }, 1000);
    } catch (e) { setIsProcessing(false); toast.dismiss(toastId); }
  };

  // 3. SAVE MASK & GO TO EFFECTS
  const handleMaskSave = async (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
      setStep(3); // Переход к эффектам
      
      // Фоновая загрузка маски на сервер
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

  // 4. GENERATE GIF
  const handleGenerate = async () => {
    if (!serverPath) return;
    setIsProcessing(true);
    const toastId = toast.loading("Рендеринг...");
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
                setStep(4);
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

  // PREVIEW RENDERER
  const StickerPreviewContent = () => (
      <div className="relative inline-block select-none">
          <img 
              src={imageSrc!} 
              className="max-h-[350px] w-auto object-contain pointer-events-none"
          />
          {text && (
              <div 
                  className="absolute cursor-move whitespace-nowrap z-50 font-black text-center leading-none"
                  style={{ 
                      left: `${textPos.x}%`, 
                      top: `${textPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${textSize * 2.5}px`,
                      color: textColor,
                      WebkitTextStroke: '2px black',
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
    setTextPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  // --- UI ---

  // STEP 2: MASK EDITOR
  if (step === 2 && originalSrc) {
      return (
          <div className="h-[calc(100vh-64px)] w-full bg-zinc-950 flex flex-col">
              <MaskEditor 
                  originalUrl={originalSrc} 
                  initialMaskedUrl={imageSrc || undefined}
                  isProcessing={isProcessing}
                  onAutoRemove={handleAutoRemove}
                  onSave={handleMaskSave}
                  onCancel={() => setStep(1)}
              />
          </div>
      )
  }

  // STEP 4: RESULT
  if (step === 4 && finalResult) {
      return (
          <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-zinc-950 p-8 text-white">
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                        <Check className="text-green-500" size={40}/>
                  </div>
                  <h2 className="text-2xl font-bold mb-6">Стикер готов!</h2>
                  <img src={finalResult} className="w-full h-auto object-contain mb-8 rounded-lg bg-[url('/transparent-bg.png')]" />
                  <div className="flex gap-3">
                      <Button className="flex-1 h-12 text-lg bg-white text-black hover:bg-zinc-200" onClick={() => window.open(finalResult || "", "_blank")}>
                          <Download className="mr-2"/> Скачать
                      </Button>
                      <Button variant="outline" className="h-12 border-zinc-700 hover:bg-zinc-800" onClick={() => { setStep(1); setOriginalSrc(null); setImageSrc(null); setFinalResult(null); setText(""); }}>
                          Заново
                      </Button>
                  </div>
              </div>
          </div>
      )
  }

  // STEP 1 & 3
  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-950 text-white flex flex-col items-center">
      
      {/* HEADER */}
      <div className="w-full max-w-6xl p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-white bg-clip-text text-transparent">Sticker Maker</h1>
          {step > 1 && <Button variant="ghost" onClick={() => window.location.reload()}><RefreshCcw className="mr-2" size={14}/> Сброс</Button>}
      </div>

      {/* SVG FILTER */}
      <svg width="0" height="0" className="absolute">
        <filter id="hard-outline">
          <feMorphology operator="dilate" radius={outlineWidth / 3} in="SourceAlpha" result="dilated"/>
          <feFlood floodColor={outlineColor || 'transparent'} result="flood"/>
          <feComposite in="flood" in2="dilated" operator="in" result="outline"/>
          <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </svg>

      {/* MAIN CONTENT */}
      {step === 1 ? (
          // STEP 1: UPLOAD
          <div className="flex-1 flex items-center justify-center w-full animate-in fade-in zoom-in-95">
              <div 
                  className="w-full max-w-xl h-80 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-zinc-900/50 transition-all group"
                  onClick={() => document.getElementById('file-upload')?.click()}
              >
                  <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-xl">
                      <Upload className="text-zinc-400 group-hover:text-indigo-400" size={32}/>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Загрузите изображение</h3>
                  <p className="text-zinc-500">JPG, PNG, WEBP</p>
                  <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>
          </div>
      ) : (
          // STEP 3: EFFECTS
          <div className="flex flex-col lg:flex-row gap-0 w-full max-w-6xl flex-1 border-t border-zinc-800 lg:border-none">
              
              {/* PREVIEW CANVAS */}
              <div className="flex-[2] bg-zinc-900/30 flex items-center justify-center relative overflow-hidden min-h-[500px] lg:rounded-xl lg:border lg:border-zinc-800 lg:mb-8 lg:ml-8">
                  <div className="absolute inset-0 bg-[url('/transparent-bg.png')] opacity-10" />
                  
                  {isProcessing && (
                      <div className="absolute inset-0 bg-zinc-950/80 z-50 flex flex-col items-center justify-center">
                          <Loader2 className="animate-spin text-indigo-500 w-10 h-10 mb-4"/>
                          <p className="text-zinc-400">Рендеринг...</p>
                      </div>
                  )}

                  <div 
                      ref={previewRef}
                      className="relative w-full h-full flex items-center justify-center p-10 cursor-crosshair overflow-hidden"
                      onMouseMove={handleTextDrag}
                      onMouseUp={() => setIsDraggingText(false)}
                      onMouseLeave={() => setIsDraggingText(false)}
                      onTouchMove={handleTextDrag}
                      onTouchEnd={() => setIsDraggingText(false)}
                      onMouseDown={() => setIsDraggingText(true)}
                      onTouchStart={() => setIsDraggingText(true)}
                  >
                      <div className={`relative ${anim === 'peeker' ? 'w-full h-full flex justify-center items-end' : ''}`}>
                          <div 
                              className="will-change-transform relative inline-block transition-transform"
                              style={{ 
                                  animation: `${anim} 2s infinite linear`,
                                  animationTimingFunction: ['bouncy','jelly','zoomie','tilty','floaties'].includes(anim) ? 'ease-in-out' : anim === 'flippy' ? 'steps(1, end)' : 'linear',
                                  transformOrigin: ['tilty','bouncy'].includes(anim) ? 'bottom center' : 'center center',
                                  filter: outlineColor ? 'url(#hard-outline)' : 'none'
                              }}
                          >
                              {anim === 'floaties' && [1, 2, 3].map(i => (
                                  <div key={i} className="absolute inset-0 opacity-20" style={{ animation: `floaties 2s infinite ease-in-out`, animationDelay: `-${i * 0.15}s`, zIndex: -i }}>
                                      <StickerPreviewContent />
                                  </div>
                              ))}
                              <StickerPreviewContent />
                          </div>
                      </div>
                  </div>
              </div>

              {/* CONTROLS SIDEBAR */}
              <div className="w-full lg:w-[400px] bg-zinc-950 lg:bg-zinc-900 border-l border-zinc-800 lg:border lg:rounded-xl lg:mb-8 lg:mr-8 flex flex-col">
                  <div className="p-4 border-b border-zinc-800">
                      <h3 className="font-bold">Настройки</h3>
                  </div>
                  
                  <Tabs defaultValue="stroke" className="flex-1 flex flex-col">
                      <div className="px-4 pt-4">
                          <TabsList className="w-full grid grid-cols-3 bg-zinc-800 text-zinc-400">
                              <TabsTrigger value="stroke" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white"><Stamp size={16} className="mr-2"/> Обводка</TabsTrigger>
                              <TabsTrigger value="text" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white"><Type size={16} className="mr-2"/> Текст</TabsTrigger>
                              <TabsTrigger value="anim" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white"><Layers size={16} className="mr-2"/> Эффект</TabsTrigger>
                          </TabsList>
                      </div>

                      <div className="flex-1 p-6 overflow-y-auto">
                          {/* TAB: STROKE */}
                          <TabsContent value="stroke" className="space-y-6 m-0">
                              <div className="space-y-4">
                                  <Label>Цвет обводки</Label>
                                  <div className="grid grid-cols-6 gap-2">
                                      <button className={`aspect-square rounded-lg border-2 flex items-center justify-center ${!outlineColor ? 'border-indigo-500 bg-zinc-800' : 'border-zinc-800 hover:border-zinc-600'}`} onClick={() => setOutlineColor(null)}>✕</button>
                                      {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4'].map(c => (
                                          <button key={c} className={`aspect-square rounded-lg border-2 transition-all ${outlineColor === c ? 'border-white scale-110' : 'border-zinc-800'}`} style={{ background: c }} onClick={() => setOutlineColor(c)}/>
                                      ))}
                                  </div>
                              </div>
                              {outlineColor && (
                                  <div className="space-y-4">
                                      <div className="flex justify-between"><Label>Толщина</Label><span className="text-xs text-zinc-500">{outlineWidth}px</span></div>
                                      <Slider min={0} max={20} step={1} value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} />
                                  </div>
                              )}
                          </TabsContent>

                          {/* TAB: TEXT */}
                          <TabsContent value="text" className="space-y-6 m-0">
                              <div className="space-y-2">
                                  <Label>Текст стикера</Label>
                                  <Input placeholder="Введите текст..." value={text} onChange={e => setText(e.target.value)} className="bg-zinc-900 border-zinc-700 focus:border-indigo-500 h-12 text-lg"/>
                              </div>
                              <div className="space-y-2">
                                  <Label>Цвет текста</Label>
                                  <div className="flex gap-2 items-center">
                                      <div className="w-10 h-10 rounded-lg border border-zinc-700 overflow-hidden relative">
                                          <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                                          <div className="w-full h-full" style={{backgroundColor: textColor}}/>
                                      </div>
                                      <Input value={textColor} onChange={e => setTextColor(e.target.value)} className="w-28 font-mono uppercase"/>
                                  </div>
                              </div>
                              <div className="space-y-4">
                                  <div className="flex justify-between"><Label>Размер</Label><span className="text-xs text-zinc-500">{textSize}</span></div>
                                  <Slider min={10} max={60} step={1} value={[textSize]} onValueChange={v => setTextSize(v[0])} />
                              </div>
                              <p className="text-xs text-zinc-500 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                                  💡 Перетащите текст прямо на картинке, чтобы изменить его положение.
                              </p>
                          </TabsContent>

                          {/* TAB: ANIMATION */}
                          <TabsContent value="anim" className="m-0">
                              <div className="grid grid-cols-2 gap-3">
                                  {ANIMATIONS.map(a => (
                                      <button 
                                          key={a.id} 
                                          onClick={() => setAnim(a.id)} 
                                          className={`
                                              h-20 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all
                                              ${anim === a.id 
                                                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700'
                                              }
                                          `}
                                      >
                                          <span className="text-2xl">{a.icon}</span>
                                          <span className="text-xs font-medium">{a.label}</span>
                                      </button>
                                  ))}
                              </div>
                          </TabsContent>
                      </div>

                      <div className="p-4 border-t border-zinc-800 bg-zinc-950/50">
                          <Button onClick={handleGenerate} className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold text-lg shadow-lg shadow-white/5">
                              <Sparkles className="mr-2" size={18}/> Создать
                          </Button>
                      </div>
                  </Tabs>
              </div>
          </div>
      )}
    </div>
  );
}