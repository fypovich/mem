"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, ChevronLeft, Download, Sparkles, Image as ImageIcon, Check, ArrowUpFromLine, Crop } from "lucide-react";
import type { CropOptions } from "@/types/editor";
import { toast } from "sonner";
import { processImage, checkStatus, createSticker, getFullUrl, uploadTempFile } from "@/lib/api/editor";
import { MaskEditor, MaskEditorRef } from "@/components/editor/mask-editor";
import { getEditorSource, setEditorResult } from "@/lib/editor-bridge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// Анимации
const ANIMATIONS = [
    { id: 'none', label: 'Нет', icon: '🚫', desc: 'Без анимации' },
    { id: 'bouncy', label: 'Прыжок', icon: '🏀', desc: 'Подпрыгивание с отскоком' },
    { id: 'jelly', label: 'Желе', icon: '🍮', desc: 'Желеобразное покачивание' },
    { id: 'flippy', label: 'Переворот', icon: '🔄', desc: 'Плавный переворот по горизонтали' },
    { id: 'spinny', label: 'Вращение', icon: '🌪️', desc: 'Непрерывное вращение на 360°' },
    { id: 'zoomie', label: 'Пульс', icon: '🔎', desc: 'Пульсирующее увеличение' },
    { id: 'tilty', label: 'Качание', icon: '🤪', desc: 'Покачивание из стороны в сторону' },
    { id: 'floaties', label: 'Призрак', icon: '👻', desc: 'Парящие призрачные следы' },
    { id: 'peeker', label: 'Прятки', icon: '🙈', desc: 'Выглядывание снизу вверх' },
];

const ASPECT_PRESETS = [
  { id: 'free', label: 'Свободное', ratio: null as number | null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

const MAX_POLL_ATTEMPTS = 300; // 5 минут при 1с интервале

function StickerMakerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUpload = searchParams.get('from') === 'upload';

  const [step, setStep] = useState<"upload" | "cutout" | "design" | "result">("upload");

  // Images
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [maskedSrc, setMaskedSrc] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // MaskEditor Ref
  const maskEditorRef = useRef<MaskEditorRef>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Polling refs для cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Design State
  const previewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [imgHeight, setImgHeight] = useState(0);

  // Design Settings
  const [anim, setAnim] = useState("none");
  const [outlineColor, setOutlineColor] = useState<string | null>("#ffffff");
  const [outlineWidth, setOutlineWidth] = useState(6);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(12);
  const [textPos, setTextPos] = useState({ x: 50, y: 85 });

  // Crop
  const [cropEnabled, setCropEnabled] = useState(false);
  const [cropRect, setCropRect] = useState<CropOptions>({ x: 0, y: 0, width: 0, height: 0 });
  const [aspectPreset, setAspectPreset] = useState('free');
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const cropDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<CropOptions | null>(null);
  const activeHandleRef = useRef<ResizeHandle | null>(null);
  const [cropInteraction, setCropInteraction] = useState<'none' | 'move' | 'resize'>('none');

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Track image dimensions for text size sync with backend + crop
  useEffect(() => {
    if (!imgRef.current) return;
    const observer = new ResizeObserver(() => {
      if (imgRef.current) {
        const w = imgRef.current.clientWidth;
        const h = imgRef.current.clientHeight;
        setImgHeight(h);
        setImgLayout({ width: w, height: h });
      }
    });
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [maskedSrc, step]);

  // Загрузить файл из upload page
  useEffect(() => {
    if (fromUpload) {
      const source = getEditorSource();
      if (source) {
        setOriginalSrc(source.url);
        setStep("cutout");
      }
    }
  }, [fromUpload]);

  // 1. UPLOAD
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (originalSrc && originalSrc.startsWith("blob:")) URL.revokeObjectURL(originalSrc);
    const url = URL.createObjectURL(file);
    setOriginalSrc(url);
    setStep("cutout");
  };

  // Polling helper
  const startPolling = (taskId: string, onSuccess: (result: any) => void, onFailure?: () => void) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsProcessing(false);
        toast.error("Таймаут: задача заняла слишком много времени");
        return;
      }
      try {
        const status = await checkStatus(taskId);
        if (status.status === "SUCCESS") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          onSuccess(status.result);
        } else if (status.status === "FAILURE") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setIsProcessing(false);
          onFailure?.();
        }
      } catch {}
    }, 1000);
  };

  // 2. AUTO REMOVE
  const handleAutoRemove = async () => {
    if (!originalSrc) return;
    setIsProcessing(true);
    const toastId = toast.loading("ИИ удаляет фон...");
    try {
        const blob = await fetch(originalSrc).then(r => r.blob());
        const file = new File([blob], "image.png", { type: blob.type });
        const { task_id } = await processImage(file, "remove_bg");

        startPolling(task_id, (result) => {
          const fullUrl = getFullUrl(result.url);
          setMaskedSrc(fullUrl);
          setIsProcessing(false);
          toast.dismiss(toastId);
        }, () => {
          setIsProcessing(false);
          toast.dismiss(toastId);
          toast.error("Ошибка ИИ");
        });
    } catch (e) { setIsProcessing(false); toast.dismiss(toastId); }
  };

  // 3. FINISH CUTOUT -> GO TO DESIGN
  const handleCutoutFinish = async () => {
      if (!maskEditorRef.current) return;
      const blob = await maskEditorRef.current.save();
      if (!blob) return;

      if (maskedSrc && maskedSrc.startsWith("blob:")) URL.revokeObjectURL(maskedSrc);
      const url = URL.createObjectURL(blob);
      setMaskedSrc(url);
      setStep("design");

      uploadMaskToServer(blob);
  };

  const uploadMaskToServer = async (blob: Blob) => {
      setIsProcessing(true);
      try {
          const file = new File([blob], "mask.png", { type: "image/png" });
          const result = await uploadTempFile(file);
          setServerPath(result.server_path);
          setIsProcessing(false);
      } catch (e) { setIsProcessing(false); }
  };

  // 4. GENERATE FINAL STICKER
  const handleGenerate = async () => {
    if (!serverPath) {
        toast.error("Изображение ещё обрабатывается...");
        return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Создание изображения...");
    try {
        const cropData = cropEnabled && imgRef.current && cropRect.width > 0 ? {
            x: Math.round(cropRect.x * (imgRef.current.naturalWidth / imgLayout.width)),
            y: Math.round(cropRect.y * (imgRef.current.naturalHeight / imgLayout.height)),
            width: Math.round(cropRect.width * (imgRef.current.naturalWidth / imgLayout.width)),
            height: Math.round(cropRect.height * (imgRef.current.naturalHeight / imgLayout.height)),
        } : undefined;

        const { task_id } = await createSticker(serverPath, anim, {
            text: text,
            textColor: textColor,
            textSize: textSize,
            textX: textPos.x / 100,
            textY: textPos.y / 100,
            outlineColor: outlineColor,
            outlineWidth: outlineWidth,
            crop: cropData,
        });
        startPolling(task_id, (result) => {
          setFinalResult(getFullUrl(result.url));
          setStep("result");
          setIsProcessing(false);
          toast.dismiss(toastId);
        }, () => {
          setIsProcessing(false);
          toast.dismiss(toastId);
          toast.error("Ошибка создания");
        });
    } catch (e) {
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Ошибка создания");
    }
  };

  // Использовать в мем
  const handleUseInUpload = () => {
    if (!finalResult) return;
    const isPng = finalResult.endsWith('.png');
    setEditorResult({
      url: finalResult,
      mediaType: 'image',
      fileName: isPng ? 'edited_sticker.png' : 'edited_sticker.gif',
    });
    router.push('/upload');
  };

  // --- RENDERERS ---

  const StickerPreviewContent = () => (
      <div className="relative inline-block select-none">
          <img
              ref={imgRef}
              src={maskedSrc!}
              className="max-h-[60vh] max-w-full w-auto object-contain drop-shadow-2xl pointer-events-none"
              onLoad={() => {
                if (imgRef.current) {
                  setImgHeight(imgRef.current.clientHeight);
                  setImgLayout({ width: imgRef.current.clientWidth, height: imgRef.current.clientHeight });
                }
              }}
          />
          {/* Crop overlay */}
          {cropEnabled && imgLayout.width > 0 && (
              <div className="absolute inset-0 z-40">
                  <div
                      className="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] cursor-move group"
                      style={{ left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height }}
                      onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                  >
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity">
                          <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                          <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                          <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-1/3"></div>
                          <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-2/3"></div>
                      </div>
                      {(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as ResizeHandle[]).map((h) => (
                          <div key={h} onMouseDown={(e) => handleCropMouseDown(e, 'resize', h)}
                              className={`absolute w-3 h-3 bg-primary rounded-full border border-white z-30
                                  ${h.includes('n') ? '-top-1.5' : ''} ${h.includes('s') ? '-bottom-1.5' : ''}
                                  ${h.includes('w') ? '-left-1.5' : ''} ${h.includes('e') ? '-right-1.5' : ''}
                                  ${h === 'n' || h === 's' ? 'left-1/2 -translate-x-1/2 cursor-ns-resize' : ''}
                                  ${h === 'w' || h === 'e' ? 'top-1/2 -translate-y-1/2 cursor-ew-resize' : ''}
                                  ${h === 'nw' ? 'cursor-nw-resize' : ''} ${h === 'ne' ? 'cursor-ne-resize' : ''}
                                  ${h === 'sw' ? 'cursor-sw-resize' : ''} ${h === 'se' ? 'cursor-se-resize' : ''}
                              `}
                          />
                      ))}
                  </div>
              </div>
          )}
          {text && !cropEnabled && (
              <div
                  className="absolute cursor-move whitespace-nowrap z-50 font-black text-center leading-none pointer-events-auto"
                  style={{
                      left: `${textPos.x}%`,
                      top: `${textPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${imgHeight > 0 ? Math.round(imgHeight * (textSize / 100)) : textSize * 2}px`,
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


  // --- CROP HANDLERS ---
  const initCrop = (enabled: boolean) => {
    setCropEnabled(enabled);
    if (enabled && imgRef.current) {
      const w = imgRef.current.clientWidth;
      const h = imgRef.current.clientHeight;
      setCropRect({ x: 0, y: 0, width: w, height: h });
      setAspectPreset('free');
    }
  };

  const handleAspectChange = (presetId: string) => {
    setAspectPreset(presetId);
    const preset = ASPECT_PRESETS.find(p => p.id === presetId);
    if (!preset?.ratio || !imgLayout.width) {
      if (!preset?.ratio && imgLayout.width) {
        setCropRect({ x: 0, y: 0, width: imgLayout.width, height: imgLayout.height });
      }
      return;
    }
    const ratio = preset.ratio;
    let w = imgLayout.width;
    let h = w / ratio;
    if (h > imgLayout.height) {
      h = imgLayout.height;
      w = h * ratio;
    }
    const x = (imgLayout.width - w) / 2;
    const y = (imgLayout.height - h) / 2;
    setCropRect({ x, y, width: w, height: h });
  };

  const getImgRelativePos = (e: React.MouseEvent) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleCropMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize', handle?: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = getImgRelativePos(e);
    cropDragStartRef.current = { x: pos.x, y: pos.y };
    setCropInteraction(mode);
    if (mode === 'resize' && handle) {
      activeHandleRef.current = handle;
    }
    cropStartRef.current = { ...cropRect };
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (cropInteraction === 'none' || !cropDragStartRef.current || !cropStartRef.current) return;
    const pos = getImgRelativePos(e);
    const deltaX = pos.x - cropDragStartRef.current.x;
    const deltaY = pos.y - cropDragStartRef.current.y;

    if (cropInteraction === 'move') {
      let newX = cropStartRef.current.x + deltaX;
      let newY = cropStartRef.current.y + deltaY;
      newX = Math.max(0, Math.min(newX, imgLayout.width - cropRect.width));
      newY = Math.max(0, Math.min(newY, imgLayout.height - cropRect.height));
      setCropRect(prev => ({ ...prev, x: newX, y: newY }));
    }

    if (cropInteraction === 'resize' && activeHandleRef.current) {
      const start = cropStartRef.current;
      let { x, y, width, height } = start;
      const hndl = activeHandleRef.current;
      if (hndl.includes('e')) width = start.width + deltaX;
      if (hndl.includes('w')) { width = start.width - deltaX; x = start.x + deltaX; }
      if (hndl.includes('s')) height = start.height + deltaY;
      if (hndl.includes('n')) { height = start.height - deltaY; y = start.y + deltaY; }

      const preset = ASPECT_PRESETS.find(p => p.id === aspectPreset);
      if (preset?.ratio) {
        height = width / preset.ratio;
      }

      if (width < 30) width = 30;
      if (height < 30) height = 30;
      if (x < 0) { width += x; x = 0; }
      if (y < 0) { height += y; y = 0; }
      if (x + width > imgLayout.width) width = imgLayout.width - x;
      if (y + height > imgLayout.height) height = imgLayout.height - y;
      setCropRect({ x, y, width, height });
    }
  };

  const handleCropMouseUp = () => {
    setCropInteraction('none');
    cropDragStartRef.current = null;
    activeHandleRef.current = null;
    cropStartRef.current = null;
  };

  // --- MAIN RENDER ---

  if (step === "upload") {
    return (
        <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-4">
            <div className="text-center animate-in zoom-in-95">
                <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-card border border-border shadow-xl">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
                <h1 className="mb-2 text-3xl font-bold text-foreground">Редактор фото</h1>
                <p className="mb-8 text-muted-foreground">Загрузите фото для редактирования</p>
                <Button size="lg" className="relative cursor-pointer bg-primary hover:bg-primary/90 text-foreground rounded-full px-10 py-6 text-lg transition-all hover:scale-105">
                    <input type="file" accept="image/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="mr-2 h-5 w-5" /> Выбрать фото
                </Button>
            </div>
        </div>
    );
  }

  if (step === "result" && finalResult) {
      return (
          <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-background p-4">
               <div className="bg-card border border-border p-8 rounded-3xl shadow-2xl text-center max-w-md w-full animate-in zoom-in-95">
                   <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                       <Check className="text-green-500" size={32}/>
                   </div>
                   <h2 className="text-2xl font-bold text-foreground mb-6">Готово!</h2>
                   <div className="bg-[url('/transparent-grid.png')] rounded-xl overflow-hidden mb-8 border border-border">
                        <img src={finalResult} className="w-full h-auto object-contain" />
                   </div>
                   <div className="flex gap-3">
                       {fromUpload && (
                           <Button className="flex-1 h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-foreground rounded-xl" onClick={handleUseInUpload}>
                               <ArrowUpFromLine className="mr-2 h-4 w-4"/> Использовать
                           </Button>
                       )}
                       <Button className={`${fromUpload ? '' : 'flex-1'} h-12 text-base font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl`} onClick={() => window.open(finalResult, "_blank")}>
                           <Download className="mr-2 h-4 w-4"/> Скачать
                       </Button>
                       <Button variant="outline" className="h-12 border-input hover:bg-accent text-foreground rounded-xl" onClick={() => { setFinalResult(null); setStep("design"); }}>
                           Заново
                       </Button>
                   </div>
                   <button
                       className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                       onClick={() => { setStep("upload"); setOriginalSrc(null); setMaskedSrc(null); setServerPath(null); setText(""); setFinalResult(null); }}
                   >
                       Загрузить другой файл
                   </button>
               </div>
          </div>
      );
  }

  return (
    <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col bg-background overflow-hidden text-foreground animate-in fade-in duration-300">

      {/* HEADER (Top Bar) */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border bg-background shrink-0 z-30">
        <Button variant="ghost" size="icon" onClick={() => step === "design" ? setStep("cutout") : (fromUpload ? router.push('/upload') : setStep("upload"))} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-base tracking-tight text-foreground">{step === 'cutout' ? 'Удаление фона' : 'Дизайн стикера'}</span>
        {step === 'cutout' ? (
          <Button variant="ghost" className="text-primary hover:text-primary/80 font-semibold text-sm h-8" onClick={handleCutoutFinish} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'Готово'}
          </Button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Editor Workspace */}
      <div className="flex-1 min-h-0 relative bg-background">
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
            <div className="flex flex-col md:flex-row h-full w-full">
                {/* Preview Area */}
                <div
                    ref={previewRef}
                    className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center touch-none bg-gradient-to-b from-background to-muted/30"
                    onMouseMove={cropEnabled ? handleCropMouseMove : handleTextDrag}
                    onMouseUp={cropEnabled ? handleCropMouseUp : () => setIsDraggingText(false)}
                    onMouseLeave={cropEnabled ? handleCropMouseUp : () => setIsDraggingText(false)}
                    onTouchMove={cropEnabled ? undefined : handleTextDrag}
                    onTouchEnd={cropEnabled ? undefined : () => setIsDraggingText(false)}
                    onMouseDown={cropEnabled ? undefined : () => setIsDraggingText(true)}
                    onTouchStart={cropEnabled ? undefined : () => setIsDraggingText(true)}
                >
                    <div
                        className="will-change-transform relative transition-transform"
                        style={{
                            animation: cropEnabled ? 'none' : `${anim} ${['flippy','spinny','floaties'].includes(anim) ? '3s' : '2s'} infinite linear`,
                            animationTimingFunction: ['bouncy','jelly','zoomie','tilty','floaties'].includes(anim) ? 'ease-in-out' : 'linear',
                            transformOrigin: ['tilty','bouncy'].includes(anim) ? 'bottom center' : 'center center',
                            filter: outlineColor ? 'url(#hard-outline)' : 'none'
                        }}
                    >
                        <svg width="0" height="0" className="absolute">
                            <filter id="hard-outline">
                                <feMorphology operator="dilate" radius={outlineWidth / 3} in="SourceAlpha" result="dilated"/>
                                <feFlood floodColor={outlineColor || 'transparent'} result="flood"/>
                                <feComposite in="flood" in2="dilated" operator="in" result="outline"/>
                                <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                        </svg>
                        {anim === 'floaties' && !cropEnabled && Array.from({length: 7}, (_, i) => (
                            <div key={i} className="absolute inset-0" style={{ animation: `floaties 3s infinite ease-in-out`, animationDelay: `-${(i + 1) * 0.15}s`, zIndex: -(i + 1) }}>
                                <StickerPreviewContent />
                            </div>
                        ))}
                        <StickerPreviewContent />
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border bg-card overflow-y-auto">
                    {/* Обрезка */}
                    <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Обрезка</Label>
                            <button
                                onClick={() => initCrop(!cropEnabled)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-sm ${cropEnabled ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                            >
                                <Crop size={14} />
                                {cropEnabled ? 'Вкл' : 'Выкл'}
                            </button>
                        </div>
                        {cropEnabled && (
                            <div className="grid grid-cols-3 gap-1.5">
                                {ASPECT_PRESETS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleAspectChange(p.id)}
                                        className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-all ${aspectPreset === p.id ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Обводка */}
                    <div className="p-4 border-b border-border">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Обводка</Label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                onClick={() => setOutlineColor(null)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all ${!outlineColor ? 'border-primary bg-secondary' : 'border-input hover:bg-accent'}`}
                            >✕</button>
                            {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4'].map(c => (
                                <button
                                    key={c}
                                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${outlineColor === c ? 'border-primary scale-110 ring-2 ring-primary/30' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setOutlineColor(c)}
                                />
                            ))}
                        </div>
                        {outlineColor && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">Толщина: {outlineWidth}</span>
                                <Slider value={[outlineWidth]} onValueChange={v => setOutlineWidth(v[0])} max={20} step={1} className="flex-1" />
                            </div>
                        )}
                    </div>

                    {/* Текст */}
                    <div className="p-4 border-b border-border">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Текст</Label>
                        <Input
                            placeholder="Подпись..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="mb-3 bg-background border-input"
                        />
                        {text && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground shrink-0">Цвет</span>
                                    <div className="w-8 h-8 rounded-md border border-input overflow-hidden relative cursor-pointer hover:border-muted-foreground/50 transition-colors">
                                        <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                                        <div className="w-full h-full" style={{backgroundColor: textColor}}/>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground shrink-0">Размер: {textSize}</span>
                                    <Slider value={[textSize]} onValueChange={v => setTextSize(v[0])} min={5} max={40} step={1} className="flex-1" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Анимация — 3 колонки */}
                    <div className="p-4 border-b border-border">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Анимация</Label>
                        <TooltipProvider delayDuration={300}>
                        <div className="grid grid-cols-3 gap-2">
                            {ANIMATIONS.map(a => (
                                <Tooltip key={a.id}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setAnim(a.id)}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${anim === a.id ? 'bg-primary border-primary text-primary-foreground shadow-md' : 'bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                        >
                                            <span className="text-xl leading-none">{a.icon}</span>
                                            <span className="text-[10px] font-bold leading-none">{a.label}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">{a.desc}</TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                        </TooltipProvider>
                    </div>

                    {/* Создать стикер */}
                    <div className="p-4">
                        <Button
                            onClick={handleGenerate}
                            disabled={isProcessing}
                            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg transition-all hover:scale-[1.01]"
                        >
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Sparkles className="mr-2" size={16}/>}
                            Создать стикер
                        </Button>
                    </div>
                </div>
            </div>
        )}
        {isProcessing && step === "design" && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary" />
                <p className="text-lg font-semibold text-foreground">Создание стикера...</p>
                <p className="text-sm text-muted-foreground">Это может занять некоторое время</p>
            </div>
        )}
      </div>
    </div>
  );
}

export default function StickerMakerPage() {
  return (
    <Suspense fallback={<div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex items-center justify-center bg-background"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>}>
      <StickerMakerInner />
    </Suspense>
  );
}
