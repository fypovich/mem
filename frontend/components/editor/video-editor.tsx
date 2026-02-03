"use client"

import React, { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Wand2, Play, Pause, RotateCcw, Type, MonitorPlay } from "lucide-react"
import { toast } from "sonner"
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
  const [crop, setCrop] = useState<CropOptions>({ x: 0, y: 0, width: 0, height: 0 }) // Pixels relative to container
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
    // Generate thumbnails roughly representing the video content
    const generateThumbnails = async () => {
        if (!videoRef.current) return;
        const vid = document.createElement('video');
        vid.src = videoUrl;
        vid.crossOrigin = "anonymous";
        vid.muted = true;
        
        await new Promise((resolve) => {
            vid.onloadedmetadata = () => resolve(true);
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const thumbs: string[] = [];
        const count = 10; // Number of thumbnails
        const interval = vid.duration / count;
        
        canvas.width = 160; // Low res for performance
        canvas.height = 90;

        for (let i = 0; i < count; i++) {
            vid.currentTime = i * interval;
            await new Promise(r => vid.onseeked = r);
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
            thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
        }
        setThumbnails(thumbs);
    };

    // Delay slightly to let DOM render
    setTimeout(generateThumbnails, 1000);
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && containerRef.current) {
      setDuration(videoRef.current.duration)
      // Initialize Crop to full size by default
      const { width, height } = containerRef.current.getBoundingClientRect()
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
      
      // Auto-loop within trim range
      const endSecond = (trimRange[1] / 100) * duration;
      const startSecond = (trimRange[0] / 100) * duration;
      
      if (time >= endSecond) {
          videoRef.current.currentTime = startSecond;
          if(!isPlaying) togglePlay(); // Optional: stop or loop
      }
    }
  }

// --- Interaction Helpers ---
  const getMousePos = (e: React.MouseEvent) => {
      // ИСПРАВЛЕНИЕ: Всегда возвращаем полный объект, даже если реф пуст
      if (!containerRef.current) return { x: 0, y: 0, containerW: 0, containerH: 0 };
      
      const rect = containerRef.current.getBoundingClientRect();
      return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          containerW: rect.width,
          containerH: rect.height
      }
  }

// --- Mouse Handlers (The Core Logic) ---
  const handleMouseDown = (e: React.MouseEvent, mode: InteractionMode, handle?: ResizeHandle) => {
      e.stopPropagation();
      e.preventDefault(); // Предотвращаем выделение текста браузером
      const pos = getMousePos(e);
      
      dragStartRef.current = { x: pos.x, y: pos.y };
      setInteractionMode(mode);

      if (mode === 'crop-resize' && handle) {
          activeHandleRef.current = handle;
          // Копируем текущий кроп, чтобы отталкиваться от него
          cropStartRef.current = { ...crop };
      } else if (mode === 'crop-move') {
          cropStartRef.current = { ...crop };
      }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
      if (interactionMode === 'none' || !dragStartRef.current || !containerRef.current) return;
      
      const pos = getMousePos(e);
      // Если контейнер вдруг 0 (например, не загрузился), выходим
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

          // Constraints
          newX = Math.max(0, Math.min(newX, pos.containerW - crop.width));
          newY = Math.max(0, Math.min(newY, pos.containerH - crop.height));

          setCrop({ ...crop, x: newX, y: newY });
      }

      // 3. RESIZE CROP
      if (interactionMode === 'crop-resize' && cropStartRef.current && activeHandleRef.current) {
          const start = cropStartRef.current;
          let { x, y, width, height } = start; // Используем let, так как будем менять значения
          const handle = activeHandleRef.current;

          // Horizontal Resize
          if (handle.includes('e')) width = start.width + deltaX;
          if (handle.includes('w')) {
              width = start.width - deltaX;
              x = start.x + deltaX;
          }

          // Vertical Resize
          if (handle.includes('s')) height = start.height + deltaY;
          if (handle.includes('n')) {
              height = start.height - deltaY;
              y = start.y + deltaY;
          }

          // Min Size Constraints
          if (width < 50) width = 50;
          if (height < 50) height = 50;

          // Boundary Constraints (prevent resizing outside container)
          if (x < 0) { width += x; x = 0; }
          if (y < 0) { height += y; y = 0; }
          
          // Исправлено: теперь TypeScript знает, что pos.containerW существует
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

    // Scale Crop to Real Video Resolution
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

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] bg-zinc-950 text-white overflow-hidden" 
         onMouseUp={handleMouseUp} 
         onMouseLeave={handleMouseUp}
         onMouseMove={handleMouseMove}>
      
      {/* --- LEFT COLUMN: PREVIEW & TIMELINE --- */}
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-2"> {/* gap-4 -> gap-2 */}
        
        {/* Video Container */}
        {/* Added min-h-0 to allow proper flex shrinking */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden select-none">
            <div ref={containerRef} className="relative shadow-2xl">
                {videoUrl ? (
                    <>
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="max-h-[50vh] max-w-full pointer-events-none block" // Reduced to 50vh
                            style={{ filter: FILTER_STYLES[filter] || 'none' }}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                        />

                        {/* CROP OVERLAY (Always Active) */}
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
                            {/* Grid Lines (Rule of Thirds) */}
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity">
                                <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                                <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                                <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-1/3"></div>
                                <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-2/3"></div>
                            </div>

                            {/* Resize Handles */}
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
                    <div className="w-96 h-64 flex items-center justify-center text-zinc-500">
                        <Loader2 className="animate-spin mr-2"/> Loading Video...
                    </div>
                )}
            </div>
        </div>

        {/* Timeline Area */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shrink-0">
            <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                    <Button size="icon" variant="secondary" className="rounded-full h-10 w-10" onClick={togglePlay}>
                        {isPlaying ? <Pause size={18}/> : <Play size={18} className="ml-1"/>}
                    </Button>
                    <div className="flex flex-col justify-center px-2">
                        <span className="text-sm font-medium text-white">{currentTime.toFixed(1)}s</span>
                        <span className="text-xs text-zinc-500">/ {duration.toFixed(1)}s</span>
                    </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => {
                    if (videoRef.current) {
                        videoRef.current.currentTime = (trimRange[0]/100) * duration;
                        setTrimRange([0, 100]);
                    }
                }}>
                    <RotateCcw size={14} className="mr-1"/> Reset Trim
                </Button>
            </div>

            {/* Visual Timeline Track */}
            <div className="relative h-16 w-full rounded-lg overflow-hidden bg-black mt-2 group">
                {/* Thumbnails Background */}
                <div className="absolute inset-0 flex opacity-50">
                    {thumbnails.map((src, i) => (
                        <img key={i} src={src} className="h-full flex-1 object-cover" alt="frame" />
                    ))}
                </div>

                {/* Slider */}
                <div className="absolute inset-0 px-0 flex items-center">
                    <Slider
                        value={trimRange}
                        min={0}
                        max={100}
                        step={0.1}
                        onValueChange={(val) => {
                            setTrimRange(val as [number, number]);
                            // Seek on drag
                            if (videoRef.current) {
                                videoRef.current.currentTime = (val[0] / 100) * duration;
                            }
                        }}
                        className="w-full relative z-10 cursor-pointer py-8" // Increased touch area
                    />
                </div>
                
                {/* Playhead Indicator */}
                <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-0 pointer-events-none transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                />
            </div>
        </div>
      </div>

      {/* --- RIGHT COLUMN: SETTINGS --- */}
      <div className="w-full lg:w-80 border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
          <div className="p-4 border-b border-zinc-800 font-semibold flex items-center gap-2">
              <Wand2 size={18} className="text-blue-500"/> Editor Tools
          </div>
          
          <ScrollArea className="flex-1">
              <div className="p-4 space-y-8">
                  
                  {/* 1. Filters */}
                  <div className="space-y-3">
                      <Label className="text-zinc-400 text-xs uppercase tracking-wider">Filters</Label>
                      <div className="grid grid-cols-2 gap-2">
                          {Object.keys(FILTER_STYLES).map((f) => (
                              <button
                                  key={f}
                                  onClick={() => setFilter(f)}
                                  className={`relative h-16 rounded-lg overflow-hidden border-2 transition-all ${filter === f ? 'border-blue-500 scale-105' : 'border-transparent hover:border-zinc-600'}`}
                              >
                                  <div 
                                      className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-black"
                                      style={{ filter: FILTER_STYLES[f] }}
                                  />
                                  <span className="absolute bottom-1 left-2 text-[10px] font-medium z-10 shadow-black drop-shadow-md">{f}</span>
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* 2. Text */}
                  <div className="space-y-3">
                      <Label className="text-zinc-400 text-xs uppercase tracking-wider">Text Overlay</Label>
                      <div className="space-y-3 bg-black/20 p-3 rounded-lg border border-zinc-800/50">
                          <div className="flex gap-2">
                              <Type size={16} className="mt-2.5 text-zinc-500"/>
                              <Input 
                                  placeholder="Type text..." 
                                  className="bg-zinc-950 border-zinc-700 focus-visible:ring-blue-500"
                                  value={textConfig.text}
                                  onChange={(e) => setTextConfig({...textConfig, text: e.target.value})}
                              />
                          </div>
                          {textConfig.text && (
                              <div className="space-y-4 pt-2">
                                  <div>
                                      <div className="flex justify-between mb-1 text-xs text-zinc-400">
                                          <span>Size</span>
                                          <span>{textConfig.size}px</span>
                                      </div>
                                      <Slider 
                                          value={[textConfig.size]} 
                                          min={10} max={120} step={1}
                                          onValueChange={(v) => setTextConfig({...textConfig, size: v[0]})}
                                      />
                                  </div>
                                  <div>
                                      <span className="text-xs text-zinc-400 mb-2 block">Color</span>
                                      <div className="flex gap-1.5 flex-wrap">
                                          {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899'].map(c => (
                                              <button
                                                  key={c}
                                                  className={`w-6 h-6 rounded-full border ${textConfig.color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                  style={{ backgroundColor: c }}
                                                  onClick={() => setTextConfig({...textConfig, color: c})}
                                              />
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* 3. Audio */}
                  <div className="space-y-3">
                      <Label className="text-zinc-400 text-xs uppercase tracking-wider">Audio</Label>
                      <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-zinc-800/50">
                          <span className="text-sm">Mute Audio</span>
                          <Switch 
                              checked={removeAudio} 
                              onCheckedChange={setRemoveAudio}
                              className="data-[state=checked]:bg-red-500" 
                          />
                      </div>
                  </div>

              </div>
          </ScrollArea>

          {/* Action Footer */}
          {/* Increased padding to lift the button visually */}
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
              <Button 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20" 
                  onClick={prepareAndProcess} 
                  disabled={isProcessing}
              >
                  {isProcessing ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Exporting...</>
                  ) : (
                      <><MonitorPlay className="mr-2 h-5 w-5"/> Export Video</>
                  )}
              </Button>
          </div>
      </div>
    </div>
  )
}