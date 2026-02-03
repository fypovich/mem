"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, ChevronLeft, Download, Layers, Type, Sparkles, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor, MaskEditorRef } from "@/components/editor/mask-editor";

// Анимации
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
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "cutout" | "design" | "result">("upload");
  
  // Изображения
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [maskedSrc, setMaskedSrc] = useState<string | null>(null); // Результат обтравки
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Состояние MaskEditor
  const maskEditorRef = useRef<MaskEditorRef>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Состояние Design
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  
  // Design Settings
  const [anim, setAnim] = useState("none");
  const [outlineColor, setOutlineColor] = useState<string | null>("#ffffff");
  const [outlineWidth, setOutlineWidth] = useState(6);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(25);
  const [textPos, setTextPos] = useState({ x: 50, y: 85 });

  // 1. UPLOAD
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    setOriginalSrc(url);
    setStep("cutout");
  };

  // 2. AUTO REMOVE (Вызывается из MaskEditor)
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
                    // Мы не меняем originalSrc, а передаем initialMaskedUrl в редактор? 
                    // Лучше перезагрузить MaskEditor с маской
                    // Но MaskEditor принимает initialMaskedUrl.
                    // Проблема: MaskEditor сейчас монтируется один раз.
                    // Решение: заставим его перерисоваться, изменив ключ или просто передав проп
                    // Но проще: обновим состояние, которое MaskEditor слушает
                    // В текущей реализации MaskEditor реагирует на initialMaskedUrl в useEffect
                    // Но нам нужно сбросить историю.
                    
                    // Самый простой способ: обновить ключ компонента, чтобы он пересоздался с новой маской
                    setMaskedSrc(fullUrl); 
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
    } catch (e) { setIsProcessing(false); toast.dismiss(toastId); }
  };

  // 3. FINISH CUTOUT -> GO TO DESIGN
  const handleCutoutFinish = async () => {
      if (!maskEditorRef.current) return;
      const blob = await maskEditorRef.current.save();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      setMaskedSrc(url); // Теперь это наше базовое изображение для дизайна
      setStep("design");

      // Фоновая загрузка на сервер
      uploadMaskToServer(blob);
  };

  const uploadMaskToServer = async (blob: Blob) => {
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

  // 4. GENERATE FINAL STICKER
  const handleGenerate = async () => {
    if (!serverPath) {
        toast.error("Изображение еще обрабатывается...");
        return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Создаем стикер...");
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
                setStep("result");
                setIsProcessing(false);
                toast.dismiss(toastId);
            }
        }, 1000);
    } catch (e) { 
        setIsProcessing(false); 
        toast.dismiss(toastId);
        toast.error("Ошибка при создании");
    }
  };

  // --- RENDERERS ---

  const StickerPreviewContent = () => (
      <div className="relative inline-block select-none pointer-events-none">
          <img 
              src={maskedSrc!} 
              className="max-h-[50vh] max-w-full w-auto object-contain"
          />
          {text && (
              <div 
                  className="absolute cursor-move whitespace-nowrap z-50 font-black text-center leading-none pointer-events-auto"
                  style={{ 
                      left: `${textPos.x}%`, 
                      top: `${textPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${textSize * 2}px`,
                      color: textColor,
                      WebkitTextStroke: '2px black',
                      fontFamily: 'Impact, sans-serif',
                      textShadow: '2px 2px 0 #000'
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); setIsDraggingText(true); }}
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


  // --- MAIN RENDER ---

  if (step === "upload") {
    return (
        <div className="flex h-screen items-center justify-center bg-zinc-950 p-4">
            <div className="text-center animate-in zoom-in-95">
                <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 shadow-xl">
                    <ImageIcon className="h-12 w-12 text-zinc-500" />
                </div>
                <h1 className="mb-2 text-3xl font-bold text-white">Sticker Maker</h1>
                <p className="mb-8 text-zinc-400">Загрузи фото, чтобы создать мем</p>
                <Button size="lg" className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 py-6 text-lg">
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="mr-2 h-5 w-5" /> Выбрать фото
                </Button>
            </div>
        </div>
    );
  }

  if (step === "result" && finalResult) {
      return (
          <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 p-4">
               <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center max-w-md w-full animate-in zoom-in-95">
                   <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                       <Check className="text-green-500" size={32}/>
                   </div>
                   <h2 className="text-2xl font-bold text-white mb-6">Готово!</h2>
                   <div className="bg-[url('/transparent-grid.png')] rounded-xl overflow-hidden mb-8 border border-zinc-800">
                        <img src={finalResult} className="w-full h-auto object-contain" />
                   </div>
                   <div className="flex gap-3">
                       <Button className="flex-1 h-12 text-base font-semibold bg-white text-black hover:bg-zinc-200 rounded-xl" onClick={() => window.open(finalResult, "_blank")}>
                           <Download className="mr-2 h-4 w-4"/> Скачать
                       </Button>
                       <Button variant="outline" className="h-12 border-zinc-700 hover:bg-zinc-800 text-white rounded-xl" onClick={() => { setStep("upload"); setOriginalSrc(null); setMaskedSrc(null); setText(""); }}>
                           Заново
                       </Button>
                   </div>
               </div>
          </div>
      );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 overflow-hidden">
      
      {/* HEADER (Top Bar) */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-zinc-950 z-30">
        <Button variant="ghost" size="icon" onClick={() => step === "design" ? setStep("cutout") : setStep("upload")} className="text-zinc-400 hover:text-white">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="font-medium text-white">{step === 'cutout' ? 'Обтравка' : 'Дизайн'}</span>
        <Button 
            variant="ghost" 
            className="text-blue-500 hover:text-blue-400 font-semibold"
            onClick={step === 'cutout' ? handleCutoutFinish : handleGenerate}
            disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : (step === 'cutout' ? 'Далее' : 'Сохранить')}
        </Button>
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 relative bg-zinc-950 overflow-hidden">
        {step === "cutout" && originalSrc && (
            // Ключ maskedSrc заставит MaskEditor пересоздаться, если AI вернет маску
            <MaskEditor
                key={maskedSrc || "original"} 
                ref={maskEditorRef}
                originalUrl={originalSrc}
                initialMaskedUrl={maskedSrc} // Если AI удалил фон, передаем сюда
                isProcessing={isProcessing}
                onAutoRemove={handleAutoRemove}
            />
        )}

        {step === "design" && maskedSrc && (
            <div className="w-full h-full flex flex-col">
                {/* SVG Filter for Outline */}
                <svg width="0" height="0" className="absolute">
                    <filter id="hard-outline">
                        <feMorphology operator="dilate" radius={outlineWidth / 3} in="SourceAlpha" result="dilated"/>
                        <feFlood floodColor={outlineColor || 'transparent'} result="flood"/>
                        <feComposite in="flood" in2="dilated" operator="in" result="outline"/>
                        <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </svg>

                {/* Preview Area */}
                <div 
                    ref={previewRef}
                    className="flex-1 relative overflow-hidden flex items-center justify-center bg-[url('/transparent-grid.png')]"
                    onMouseMove={handleTextDrag}
                    onMouseUp={() => setIsDraggingText(false)}
                    onMouseLeave={() => setIsDraggingText(false)}
                    onTouchMove={handleTextDrag}
                    onTouchEnd={() => setIsDraggingText(false)}
                    onMouseDown={() => setIsDraggingText(true)}
                    onTouchStart={() => setIsDraggingText(true)}
                >
                    <div 
                        className="will-change-transform relative transition-transform"
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

                {/* Bottom Tabs (Style 2.png) */}
                <div className="bg-zinc-950 border-t border-zinc-900 pb-safe z-20">
                     <Tabs defaultValue="outline" className="w-full">
                         
                         {/* Controls Area */}
                         <div className="h-40 p-4 overflow-y-auto">
                            <TabsContent value="outline" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between text-sm text-zinc-400"><span>Толщина</span><span>{outlineWidth}px</span></div>
                                <Slider value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} max={20} step={1} />
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                    <button onClick={() => setOutlineColor(null)} className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center flex-shrink-0">✕</button>
                                    {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'].map(c => (
                                        <button 
                                            key={c}
                                            className={`w-8 h-8 rounded-full border-2 flex-shrink-0 transition-all ${outlineColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setOutlineColor(c)}
                                        />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="text" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Текст мема..." 
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white focus:ring-0"
                                    />
                                    <div className="w-10 h-10 rounded-md border border-zinc-700 overflow-hidden relative flex-shrink-0">
                                         <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full"/>
                                         <div className="w-full h-full" style={{backgroundColor: textColor}}/>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-zinc-500">Размер</span>
                                    <Slider value={[textSize]} onValueChange={v => setTextSize(v[0])} min={10} max={60} step={1} className="flex-1" />
                                </div>
                            </TabsContent>

                            <TabsContent value="effects" className="mt-0 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                    {ANIMATIONS.map(a => (
                                        <button 
                                            key={a.id} 
                                            onClick={() => setAnim(a.id)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-xl min-w-[70px] border transition-all ${anim === a.id ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-transparent text-zinc-500 hover:bg-zinc-900'}`}
                                        >
                                            <span className="text-2xl">{a.icon}</span>
                                            <span className="text-[10px] font-medium">{a.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </TabsContent>
                         </div>

                         {/* Tab Triggers */}
                         <TabsList className="w-full h-16 rounded-none bg-zinc-950 border-t border-zinc-900 grid grid-cols-3 p-0">
                            <TabsTrigger value="outline" className="h-full rounded-none border-t-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-zinc-900/50 data-[state=active]:text-white text-zinc-500 flex flex-col gap-1">
                                <div className="w-5 h-5 border-2 border-current rounded-full" />
                                <span className="text-[10px]">Обводка</span>
                            </TabsTrigger>
                            <TabsTrigger value="text" className="h-full rounded-none border-t-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-zinc-900/50 data-[state=active]:text-white text-zinc-500 flex flex-col gap-1">
                                <Type size={20} />
                                <span className="text-[10px]">Текст</span>
                            </TabsTrigger>
                             <TabsTrigger value="effects" className="h-full rounded-none border-t-2 border-transparent data-[state=active]:border-white data-[state=active]:bg-zinc-900/50 data-[state=active]:text-white text-zinc-500 flex flex-col gap-1">
                                <Sparkles size={20} />
                                <span className="text-[10px]">Эффекты</span>
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}