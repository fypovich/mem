"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, ChevronLeft, Download, Sparkles, Image as ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor, MaskEditorRef } from "@/components/editor/mask-editor";

// Animations
const ANIMATIONS = [
    { id: 'none', label: 'None', icon: '🚫' },
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
  
  // Images
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [maskedSrc, setMaskedSrc] = useState<string | null>(null); 
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // MaskEditor Ref
  const maskEditorRef = useRef<MaskEditorRef>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Design State
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

  // 2. AUTO REMOVE
  const handleAutoRemove = async () => {
    if (!originalSrc) return;
    setIsProcessing(true);
    const toastId = toast.loading("AI removing background...");
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
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("AI Error");
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
      setMaskedSrc(url);
      setStep("design");

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
        toast.error("Image is still processing...");
        return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Creating sticker...");
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
        toast.error("Creation failed");
    }
  };

  // --- RENDERERS ---

  const StickerPreviewContent = () => (
      <div className="relative inline-block select-none pointer-events-none">
          <img 
              src={maskedSrc!} 
              className="max-h-[60vh] max-w-full w-auto object-contain drop-shadow-2xl"
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
                      textShadow: '3px 3px 0 #000'
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
        // Используем fixed позиционирование и здесь, чтобы перекрыть стандартный лейаут
        <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex h-[calc(100vh-3.5rem)] items-center justify-center bg-zinc-950 p-4">
            <div className="text-center animate-in zoom-in-95">
                <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 shadow-xl">
                    <ImageIcon className="h-12 w-12 text-zinc-500" />
                </div>
                <h1 className="mb-2 text-3xl font-bold text-white">Sticker Maker</h1>
                <p className="mb-8 text-zinc-400">Upload a photo to create a meme</p>
                <Button size="lg" className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 py-6 text-lg transition-all hover:scale-105">
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="mr-2 h-5 w-5" /> Select Photo
                </Button>
            </div>
        </div>
    );
  }

  if (step === "result" && finalResult) {
      return (
          <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-zinc-950 p-4">
               <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center max-w-md w-full animate-in zoom-in-95">
                   <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                       <Check className="text-green-500" size={32}/>
                   </div>
                   <h2 className="text-2xl font-bold text-white mb-6">Done!</h2>
                   <div className="bg-[url('/transparent-grid.png')] rounded-xl overflow-hidden mb-8 border border-zinc-800">
                        <img src={finalResult} className="w-full h-auto object-contain" />
                   </div>
                   <div className="flex gap-3">
                       <Button className="flex-1 h-12 text-base font-semibold bg-white text-black hover:bg-zinc-200 rounded-xl" onClick={() => window.open(finalResult, "_blank")}>
                           <Download className="mr-2 h-4 w-4"/> Download
                       </Button>
                       <Button variant="outline" className="h-12 border-zinc-700 hover:bg-zinc-800 text-white rounded-xl" onClick={() => { setStep("upload"); setOriginalSrc(null); setMaskedSrc(null); setText(""); }}>
                           New
                       </Button>
                   </div>
               </div>
          </div>
      );
  }

  return (
    // ГЛАВНЫЙ КОНТЕЙНЕР
    // fixed: Вырываем из потока layout.tsx
    // top-14: Отступаем высоту хедера (3.5rem)
    // left-0 md:left-64: Отступаем ширину сайдбара на десктопе
    <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col bg-zinc-950 overflow-hidden text-white">
      
      {/* HEADER (Top Bar) */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 shrink-0 z-30">
        <Button variant="ghost" size="icon" onClick={() => step === "design" ? setStep("cutout") : setStep("upload")} className="text-zinc-400 hover:text-white">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <span className="font-bold text-lg tracking-tight text-white">{step === 'cutout' ? 'Cut Out' : 'Design'}</span>
        <Button 
            variant="ghost" 
            className="text-blue-500 hover:text-blue-400 font-semibold"
            onClick={step === 'cutout' ? handleCutoutFinish : handleGenerate}
            disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : (step === 'cutout' ? 'Next' : 'Save')}
        </Button>
      </div>

      {/* Editor Workspace */}
      <div className="flex-1 min-h-0 relative bg-zinc-950">
        {step === "cutout" && originalSrc && (
            <MaskEditor
                key={maskedSrc || "original"} 
                ref={maskEditorRef}
                originalUrl={originalSrc}
                initialMaskedUrl={maskedSrc} 
                isProcessing={isProcessing}
                onAutoRemove={handleAutoRemove}
                onNext={handleCutoutFinish}
            />
        )}

        {step === "design" && maskedSrc && (
            <div className="flex h-full w-full gap-6 p-6 box-border overflow-hidden">
                {/* Left: Preview Area */}
                <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 h-full">
                    <div className="flex items-center gap-2 shrink-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setStep('cutout')} 
                            className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 h-9 px-4 text-sm"
                        >
                            <ChevronLeft size={16} className="mr-2" /> Back to Cutout
                        </Button>
                    </div>

                    <div 
                        ref={previewRef}
                        className="flex-1 relative overflow-hidden rounded-xl border border-zinc-800 bg-[#121212] flex items-center justify-center touch-none shadow-2xl"
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
                             {/* SVG Filter for Outline */}
                            <svg width="0" height="0" className="absolute">
                                <filter id="hard-outline">
                                    <feMorphology operator="dilate" radius={outlineWidth / 3} in="SourceAlpha" result="dilated"/>
                                    <feFlood floodColor={outlineColor || 'transparent'} result="flood"/>
                                    <feComposite in="flood" in2="dilated" operator="in" result="outline"/>
                                    <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
                                </filter>
                            </svg>

                             {anim === 'floaties' && [1, 2, 3].map(i => (
                                <div key={i} className="absolute inset-0 opacity-20" style={{ animation: `floaties 2s infinite ease-in-out`, animationDelay: `-${i * 0.15}s`, zIndex: -i }}>
                                    <StickerPreviewContent />
                                </div>
                             ))}
                             <StickerPreviewContent />
                        </div>
                    </div>
                </div>

                {/* Right: Design Controls Sidebar */}
                <div className="w-80 flex flex-col bg-[#18181b] rounded-xl border border-zinc-800 shadow-xl h-full flex-shrink-0 overflow-hidden">
                     <div className="p-6 border-b border-zinc-800 shrink-0">
                        <h3 className="text-xl font-bold text-white mb-1">Design</h3>
                        <p className="text-sm text-zinc-400">Style your sticker</p>
                     </div>

                     <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        {/* Section: Outline */}
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                1. Outline
                            </Label>
                            <div className="grid grid-cols-6 gap-2">
                                <button 
                                    onClick={() => setOutlineColor(null)} 
                                    className={`aspect-square rounded-full border-2 flex items-center justify-center hover:bg-zinc-800 text-zinc-400 transition-all ${!outlineColor ? 'border-white bg-zinc-800' : 'border-zinc-700'}`}
                                    title="No Outline"
                                >
                                    ✕
                                </button>
                                {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4', '#8b5cf6'].slice(0, 11).map(c => (
                                    <button 
                                        key={c}
                                        className={`aspect-square rounded-full border-2 transition-all hover:scale-110 ${outlineColor === c ? 'border-white scale-110 ring-2 ring-white/20' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setOutlineColor(c)}
                                    />
                                ))}
                            </div>
                            
                            {outlineColor && (
                                <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex justify-between text-xs font-medium text-zinc-400">
                                        <span>Thickness</span>
                                        <span className="text-white">{outlineWidth}px</span>
                                    </div>
                                    <Slider value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} max={20} step={1} className="py-1" />
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-zinc-800/50 w-full" />

                        {/* Section: Text */}
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                2. Text
                            </Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Add caption..." 
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    className="bg-zinc-900 border-zinc-700 text-white focus:ring-indigo-500 focus:border-indigo-500 h-10"
                                />
                                <div className="w-10 h-10 rounded-lg border border-zinc-700 overflow-hidden relative flex-shrink-0 cursor-pointer hover:border-zinc-500 transition-colors shadow-sm">
                                        <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                                        <div className="w-full h-full" style={{backgroundColor: textColor}}/>
                                </div>
                            </div>
                            {text && (
                                <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex justify-between text-xs font-medium text-zinc-400">
                                        <span>Size</span>
                                        <span className="text-white">{textSize}</span>
                                    </div>
                                    <Slider value={[textSize]} onValueChange={v => setTextSize(v[0])} min={10} max={80} step={1} className="py-1" />
                                    <p className="text-[10px] text-indigo-400 italic text-center pt-1">
                                        ✨ Drag text on image to move
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-zinc-800/50 w-full" />

                        {/* Section: Effects */}
                        <div className="space-y-4">
                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                                3. Animation
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                                {ANIMATIONS.map(a => (
                                    <button 
                                        key={a.id} 
                                        onClick={() => setAnim(a.id)}
                                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 ${anim === a.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-[1.02]' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'}`}
                                    >
                                        <span className="text-2xl">{a.icon}</span>
                                        <span className="text-[10px] font-bold">{a.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                     </div>

                     <div className="p-6 border-t border-zinc-800 bg-zinc-900 shrink-0">
                        <Button 
                            onClick={handleGenerate} 
                            disabled={isProcessing} 
                            className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg shadow-white/5 transition-all hover:scale-[1.02]"
                        >
                            {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2" size={20}/>}
                            Create Sticker
                        </Button>
                     </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}