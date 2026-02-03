"use client"

import React, { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Wand2, Play, Pause, RotateCcw, Type, MonitorPlay } from "lucide-react"
import type { VideoProcessOptions, CropOptions, TextOptions } from "@/types/editor"

// --- CSS Filters Mapping ---
const FILTER_STYLES: Record<string, string> = {
  "No Filter": "none",
  "Black & White": "grayscale(100%)",
  "Sepia": "sepia(100%)",
  "Vintage": "sepia(50%) contrast(120%) brightness(90%)",
  "Blur": "blur(2px)",
  "Rainbow": "saturate(250%)", 
  "VHS": "contrast(150%) brightness(110%) hue-rotate(-10deg)",
  "Groovy": "invert(100%)"
}

interface VideoEditorProps {
  videoUrl: string;
  isProcessing: boolean;
  onProcess: (options: VideoProcessOptions) => void;
}

// Типы взаимодействия
type InteractionMode = 'none' | 'crop-move' | 'crop-resize' | 'text-move';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

export default function VideoEditor({ videoUrl, isProcessing, onProcess }: VideoEditorProps) {
  // --- Video State ---
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  
  // --- Editor Options ---
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]) // %
  const [crop, setCrop] = useState<CropOptions>({ x: 0, y: 0, width: 0, height: 0 }) 
  const [textConfig, setTextConfig] = useState<TextOptions>({
    text: "",
    size: 40,
    color: "#ffffff",
    x: 0.5,
    y: 0.8
  })
  const [filter, setFilter] = useState("No Filter")
  const [removeAudio, setRemoveAudio] = useState(false)

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // --- Dragging Internal State ---
  const dragStartRef = useRef<{ x: number, y: number } | null>(null)
  const cropStartRef = useRef<CropOptions | null>(null)
  const activeHandleRef = useRef<ResizeHandle | null>(null)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none')

  // --- Initialization & Thumbnail Generation ---
  useEffect(() => {
    const generateThumbnails = async () => {
        if (!videoRef.current) return;
        // Create detached video element to scan frames
        const vid = document.createElement('video');
        vid.src = videoUrl;
        vid.crossOrigin = "anonymous";
        vid.muted = true;
        vid.preload = "auto";
        
        await new Promise((resolve) => {
            vid.onloadedmetadata = () => resolve(true);
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const thumbs: string[] = [];
        const count = 10;
        const interval = vid.duration / count;
        
        canvas.width = 160;
        canvas.height = 90;

        for (let i = 0; i < count; i++) {
            vid.currentTime = i * interval;
            await new Promise(r => vid.onseeked = r);
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
        }
        setThumbnails(thumbs);
    };

    // Small delay to ensure render
    setTimeout(generateThumbnails, 1000);
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && containerRef.current) {
      setDuration(videoRef.current.duration)
      const { width, height } = containerRef.current.getBoundingClientRect()
      // Init crop to full size
      setCrop({ x: 0, y: 0, width: width, height: height })
    }
  }

  // --- Playback Controls ---
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause()
      else videoRef.current.play()
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      const endSecond = (trimRange[1] / 100) * duration;
      const startSecond = (trimRange[0] / 100) * duration;
      
      if (time >= endSecond) {
          videoRef.current.currentTime = startSecond;
          if(!isPlaying) togglePlay(); 
      }
    }
  }

  // --- Interaction Helpers ---
  const getMousePos = (e: React.MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0, containerW: 0, containerH: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          containerW: rect.width,
          containerH: rect.height
      }
  }

  // --- Mouse Handlers ---
  const handleMouseDown = (e: React.MouseEvent, mode: InteractionMode, handle?: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault(); 
      const pos = getMousePos(e);
      
      dragStartRef.current = { x: pos.x, y: pos.y };
      setInteractionMode(mode);

      if (mode === 'crop-resize' && handle) {
          activeHandleRef.current = handle;
          cropStartRef.current = { ...crop };
      } else if (mode === 'crop-move') {
          cropStartRef.current = { ...crop };
      }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
      if (interactionMode === 'none' || !dragStartRef.current || !containerRef.current) return;
      
      const pos = getMousePos(e);
      if (pos.containerW === 0) return;

      const deltaX = pos.x - dragStartRef.current.x;
      const deltaY = pos.y - dragStartRef.current.y;

      // 1. MOVE TEXT
      if (interactionMode === 'text-move') {
          const x = Math.max(0, Math.min(1, pos.x / pos.containerW));
          const y = Math.max(0, Math.min(1, pos.y / pos.containerH));
          setTextConfig(prev => ({ ...prev, x, y }));
          return;
      }

      // 2. MOVE CROP
      if (interactionMode === 'crop-move' && cropStartRef.current) {
          let newX = cropStartRef.current.x + deltaX;
          let newY = cropStartRef.current.y + deltaY;

          newX = Math.max(0, Math.min(newX, pos.containerW - crop.width));
          newY = Math.max(0, Math.min(newY, pos.containerH - crop.height));

          setCrop({ ...crop, x: newX, y: newY });
      }

      // 3. RESIZE CROP
      if (interactionMode === 'crop-resize' && cropStartRef.current && activeHandleRef.current) {
          const start = cropStartRef.current;
          let { x, y, width, height } = start; 
          const handle = activeHandleRef.current;

          if (handle.includes('e')) width = start.width + deltaX;
          if (handle.includes('w')) {
              width = start.width - deltaX;
              x = start.x + deltaX;
          }

          if (handle.includes('s')) height = start.height + deltaY;
          if (handle.includes('n')) {
              height = start.height - deltaY;
              y = start.y + deltaY;
          }

          if (width < 50) width = 50;
          if (height < 50) height = 50;

          if (x < 0) { width += x; x = 0; }
          if (y < 0) { height += y; y = 0; }
          if (x + width > pos.containerW) width = pos.containerW - x;
          if (y + height > pos.containerH) height = pos.containerH - y;

          setCrop({ x, y, width, height });
      }
  }

  const handleMouseUp = () => {
      setInteractionMode('none');
      dragStartRef.current = null;
      activeHandleRef.current = null;
      cropStartRef.current = null;
  }

  // --- Final Process ---
  const prepareAndProcess = () => {
    if (!videoRef.current || !containerRef.current) return;

    const videoRect = containerRef.current.getBoundingClientRect();
    const naturalWidth = videoRef.current.videoWidth;
    const naturalHeight = videoRef.current.videoHeight;
    const scaleX = naturalWidth / videoRect.width;
    const scaleY = naturalHeight / videoRect.height;

    const finalCrop = {
        x: Math.round(crop.x * scaleX),
        y: Math.round(crop.y * scaleY),
        width: Math.round(crop.width * scaleX),
        height: Math.round(crop.height * scaleY)
    };

    const start = (trimRange[0] / 100) * duration;
    const end = (trimRange[1] / 100) * duration;

    const options: VideoProcessOptions = {
      trim_start: start,
      trim_end: end,
      remove_audio: removeAudio,
      filter_name: filter === "No Filter" ? undefined : filter,
      text_config: textConfig.text ? textConfig : undefined,
      crop: finalCrop
    };
    
    onProcess(options);
  }

  // --- RENDER ---
  return (
    // ГЛАВНЫЙ КОНТЕЙНЕР:
    // h-[calc(100vh-140px)] - это ключевая правка. Мы вычитаем место под навбар и отступы страницы.
    // overflow-hidden - чтобы ничего не вылезало.
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] bg-zinc-950 text-white overflow-hidden border border-zinc-800 rounded-lg" 
         onMouseUp={handleMouseUp} 
         onMouseLeave={handleMouseUp}
         onMouseMove={handleMouseMove}>
      
      {/* --- ЛЕВАЯ КОЛОНКА: ПРЕВЬЮ + ТАЙМЛАЙН --- */}
      <div className="flex-1 flex flex-col min-w-0 p-3 gap-3 h-full">
        
        {/* 1. БЛОК ВИДЕО */}
        {/* flex-1: занимает всё свободное место */}
        {/* min-h-0: КРИТИЧНО! Позволяет блоку сжиматься, если места мало, не выталкивая Timeline */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center bg-zinc-900/50 rounded-lg overflow-hidden select-none border border-zinc-800/50">
            <div ref={containerRef} className="relative h-full w-full flex items-center justify-center">
                {videoUrl ? (
                    <>
                        {/* Видео само подстраивается под размер родителя (h-full w-full object-contain) */}
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="h-full w-full object-contain pointer-events-none block"
                            style={{ filter: FILTER_STYLES[filter] || 'none' }}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                        />

                        {/* CROP OVERLAY */}
                        {/* Позиционирование должно быть корректным. Сейчас оно работает от containerRef */}
                        {/* Важно: containerRef должен совпадать с реальным размером видео для точности, 
                            но для простоты UI мы пока оставляем его на wrapper'е.
                            При object-contain кроп может визуально вылезать за видео, если соотношение сторон разное.
                            Это допустимый компромисс для простого UI. */}
                        <div 
                            className="absolute border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] cursor-move group"
                            style={{
                                left: crop.x,
                                top: crop.y,
                                width: crop.width,
                                height: crop.height,
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'crop-move')}
                        >
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity">
                                <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                                <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                                <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-1/3"></div>
                                <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-2/3"></div>
                            </div>

                            {(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as ResizeHandle[]).map((h) => (
                                <div
                                    key={h}
                                    className={`absolute w-3 h-3 bg-blue-500 rounded-full border border-white z-10
                                        ${h === 'nw' ? '-top-1.5 -left-1.5 cursor-nw-resize' : ''}
                                        ${h === 'ne' ? '-top-1.5 -right-1.5 cursor-ne-resize' : ''}
                                        ${h === 'sw' ? '-bottom-1.5 -left-1.5 cursor-sw-resize' : ''}
                                        ${h === 'se' ? '-bottom-1.5 -right-1.5 cursor-se-resize' : ''}
                                        ${h === 'n' ? '-top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize' : ''}
                                        ${h === 's' ? '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize' : ''}
                                        ${h === 'w' ? 'left-[-6px] top-1/2 -translate-y-1/2 cursor-w-resize' : ''}
                                        ${h === 'e' ? 'right-[-6px] top-1/2 -translate-y-1/2 cursor-e-resize' : ''}
                                    `}
                                    onMouseDown={(e) => handleMouseDown(e, 'crop-resize', h)}
                                />
                            ))}
                        </div>

                        {/* TEXT OVERLAY */}
                        {textConfig.text && (
                            <div
                                className="absolute cursor-grab active:cursor-grabbing border border-transparent hover:border-white/50 p-2 rounded z-20"
                                style={{
                                    left: `${textConfig.x * 100}%`,
                                    top: `${textConfig.y * 100}%`,
                                    transform: 'translate(-50%, -50%)',
                                    fontSize: `${textConfig.size}px`,
                                    color: textConfig.color,
                                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseDown={(e) => handleMouseDown(e, 'text-move')}
                            >
                                {textConfig.text}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
                        <Loader2 className="animate-spin h-8 w-8 text-blue-500"/> 
                        <span className="text-sm">Loading Video...</span>
                    </div>
                )}
            </div>
        </div>

        {/* 2. БЛОК TIMELINE */}
        {/* shrink-0: Запрещаем сжимать этот блок. Он всегда будет виден. */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 shrink-0 h-[100px] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2 items-center">
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={togglePlay}>
                        {isPlaying ? <Pause size={16}/> : <Play size={16} className="ml-0.5"/>}
                    </Button>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-medium text-white font-mono">{currentTime.toFixed(1)}s</span>
                        <span className="text-xs text-zinc-500 font-mono">/ {duration.toFixed(1)}s</span>
                    </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400 hover:text-white" onClick={() => {
                    if (videoRef.current) {
                        videoRef.current.currentTime = (trimRange[0]/100) * duration;
                        setTrimRange([0, 100]);
                    }
                }}>
                    <RotateCcw size={12} className="mr-1.5"/> Reset
                </Button>
            </div>

            {/* Слайдер и кадры */}
            <div className="relative h-10 w-full rounded-md overflow-hidden bg-black/50 group select-none">
                <div className="absolute inset-0 flex opacity-40 grayscale group-hover:grayscale-0 transition-all duration-300">
                    {thumbnails.map((src, i) => (
                        <img key={i} src={src} className="h-full flex-1 object-cover pointer-events-none" alt="frame" />
                    ))}
                </div>

                <div className="absolute inset-0 px-0 flex items-center z-10">
                    <Slider
                        value={trimRange}
                        min={0}
                        max={100}
                        step={0.1}
                        onValueChange={(val) => {
                            setTrimRange(val as [number, number]);
                            if (videoRef.current) {
                                // Pause while scrubbing for better performance
                                if (isPlaying) videoRef.current.pause();
                                setIsPlaying(false);
                                videoRef.current.currentTime = (val[0] / 100) * duration;
                            }
                        }}
                        className="cursor-pointer"
                    />
                </div>
                
                {/* Индикатор текущего времени (Playhead) */}
                <div 
                    className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-0 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />
            </div>
        </div>
      </div>

      {/* --- ПРАВАЯ КОЛОНКА: НАСТРОЙКИ --- */}
      <div className="w-full lg:w-72 border-l border-zinc-800 bg-zinc-900/30 flex flex-col h-full">
          <div className="p-4 border-b border-zinc-800 font-medium text-sm flex items-center gap-2 text-zinc-200">
              <Wand2 size={16} className="text-blue-500"/> Editing Tools
          </div>
          
          <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                  
                  {/* Filters */}
                  <div className="space-y-2">
                      <Label className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">Filters</Label>
                      <div className="grid grid-cols-3 gap-2">
                          {Object.keys(FILTER_STYLES).map((f) => (
                              <button
                                  key={f}
                                  onClick={() => setFilter(f)}
                                  className={`group relative aspect-square rounded-md overflow-hidden border transition-all ${filter === f ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-zinc-800 hover:border-zinc-600'}`}
                              >
                                  <div 
                                      className="absolute inset-0 bg-zinc-800"
                                      style={{ filter: FILTER_STYLES[f] }}
                                  />
                                  {/* Filter Preview Mockup Color */}
                                  <div className={`absolute inset-0 opacity-50 bg-gradient-to-br from-purple-500/20 to-blue-500/20 mix-blend-overlay`} style={{ filter: FILTER_STYLES[f] }}></div>
                                  
                                  <span className="absolute bottom-0 w-full bg-black/60 text-[8px] py-0.5 text-center truncate px-1 backdrop-blur-sm">
                                      {f}
                                  </span>
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Text */}
                  <div className="space-y-2">
                      <Label className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">Text</Label>
                      <div className="space-y-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                          <Input 
                              placeholder="Add caption..." 
                              className="h-8 text-xs bg-zinc-950 border-zinc-700"
                              value={textConfig.text}
                              onChange={(e) => setTextConfig({...textConfig, text: e.target.value})}
                          />
                          {textConfig.text && (
                              <>
                                  <div className="space-y-1">
                                      <div className="flex justify-between text-[10px] text-zinc-400">
                                          <span>Size</span>
                                          <span>{textConfig.size}px</span>
                                      </div>
                                      <Slider 
                                          value={[textConfig.size]} 
                                          min={10} max={100} step={1}
                                          className="py-1"
                                          onValueChange={(v) => setTextConfig({...textConfig, size: v[0]})}
                                      />
                                  </div>
                                  <div className="flex gap-1.5 flex-wrap pt-1">
                                      {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899'].map(c => (
                                          <button
                                              key={c}
                                              className={`w-5 h-5 rounded-full border ${textConfig.color === c ? 'border-white ring-1 ring-white/50' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                              style={{ backgroundColor: c }}
                                              onClick={() => setTextConfig({...textConfig, color: c})}
                                          />
                                      ))}
                                  </div>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Audio */}
                  <div className="space-y-2">
                      <Label className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold">Audio</Label>
                      <div className="flex items-center justify-between bg-zinc-900/50 p-2 px-3 rounded-lg border border-zinc-800">
                          <span className="text-xs">Mute Sound</span>
                          <Switch 
                              checked={removeAudio} 
                              onCheckedChange={setRemoveAudio}
                              className="scale-75 data-[state=checked]:bg-red-500" 
                          />
                      </div>
                  </div>

              </div>
          </ScrollArea>

          {/* Action Footer */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-900/20" 
                  onClick={prepareAndProcess} 
                  disabled={isProcessing}
              >
                  {isProcessing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Processing...</>
                  ) : (
                      <><MonitorPlay className="mr-2 h-4 w-4"/> Export Video</>
                  )}
              </Button>
          </div>
      </div>
    </div>
  )
}