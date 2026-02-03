"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, ChevronLeft, Download, Layers, Type, Sparkles, Image as ImageIcon, Check, ChevronRight } from "lucide-react";
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
          <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 p-4">
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
    <div className="flex h-screen flex-col bg-zinc-950 overflow-hidden">
      
      {/* Editor Workspace */}
      <div className="flex-1 relative bg-zinc-950 overflow-hidden">
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
            <div className="flex h-full w-full bg-zinc-950 p-4 gap-4">
                {/* Left: Preview Area */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setStep('cutout')} 
                            className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800"
                        >
                            <ChevronLeft size={18} className="mr-1" /> Back
                        </Button>
                    </div>

                    <div 
                        ref={previewRef}
                        className="flex-1 relative overflow-hidden rounded-xl border border-zinc-800 bg-[url('/transparent-grid.png')] flex items-center justify-center touch-none shadow-inner"
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

                {/* Right: Design Controls */}
                <div className="w-80 flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl h-full overflow-hidden flex-shrink-0">
                     <Tabs defaultValue="outline" className="flex-1 flex flex-col">
                         
                         <div className="p-4 border-b border-zinc-800">
                            <h3 className="text-lg font-bold text-white mb-4">Design</h3>
                            <TabsList className="w-full grid grid-cols-3 bg-zinc-950">
                                <TabsTrigger value="outline">Outline</TabsTrigger>
                                <TabsTrigger value="text">Text</TabsTrigger>
                                <TabsTrigger value="effects">Effect</TabsTrigger>
                            </TabsList>
                         </div>

                         <div className="flex-1 p-6 overflow-y-auto">
                            <TabsContent value="outline" className="mt-0 space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="space-y-4">
                                    <Label className="text-white">Color</Label>
                                    <div className="grid grid-cols-5 gap-2">
                                        <button onClick={() => setOutlineColor(null)} className="aspect-square rounded-full border border-zinc-700 flex items-center justify-center hover:bg-zinc-800 text-zinc-400">✕</button>
                                        {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#f97316'].map(c => (
                                            <button 
                                                key={c}
                                                className={`aspect-square rounded-full border-2 transition-all ${outlineColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => setOutlineColor(c)}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm text-zinc-400"><span>Width</span><span>{outlineWidth}px</span></div>
                                    <Slider value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} max={20} step={1} />
                                </div>
                            </TabsContent>

                            <TabsContent value="text" className="mt-0 space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="space-y-3">
                                    <Label className="text-white">Content</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Top text..." 
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            className="bg-zinc-950 border-zinc-800 text-white focus:ring-purple-500"
                                        />
                                        <div className="w-10 h-10 rounded-md border border-zinc-700 overflow-hidden relative flex-shrink-0 cursor-pointer">
                                             <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                                             <div className="w-full h-full" style={{backgroundColor: textColor}}/>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm text-zinc-400"><span>Size</span><span>{textSize}</span></div>
                                    <Slider value={[textSize]} onValueChange={v => setTextSize(v[0])} min={10} max={60} step={1} />
                                </div>
                                <div className="text-xs text-zinc-500 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                                    Tip: Drag text on the image to position it.
                                </div>
                            </TabsContent>

                            <TabsContent value="effects" className="mt-0 space-y-4 animate-in fade-in slide-in-from-right-4">
                                <div className="grid grid-cols-3 gap-3">
                                    {ANIMATIONS.map(a => (
                                        <button 
                                            key={a.id} 
                                            onClick={() => setAnim(a.id)}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${anim === a.id ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                        >
                                            <span className="text-2xl">{a.icon}</span>
                                            <span className="text-[10px] font-medium">{a.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </TabsContent>
                         </div>

                         <div className="p-6 border-t border-zinc-800 bg-zinc-900 mt-auto">
                            <Button onClick={handleGenerate} disabled={isProcessing} className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg">
                                {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2" size={18}/>}
                                Create Sticker
                            </Button>
                         </div>
                    </Tabs>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}