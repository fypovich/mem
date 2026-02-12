"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react"
import type { VideoProcessOptions, CropOptions, TextOptions } from "@/types/editor"

interface VideoEditorProps {
  videoUrl: string;
  isProcessing: boolean;
  onProcess: (options: VideoProcessOptions) => void;
}

type InteractionMode = 'none' | 'crop-move' | 'crop-resize' | 'text-move';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

export default function VideoEditor({ videoUrl, isProcessing, onProcess }: VideoEditorProps) {
  // --- Video State ---
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [videoDimensions, setVideoDimensions] = useState({ w: 0, h: 0 }) 
  const [layout, setLayout] = useState({ width: 0, height: 0 })

  // --- Editor Options ---
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100])
  const [crop, setCrop] = useState<CropOptions>({ x: 0, y: 0, width: 0, height: 0 }) 
  const [textConfig, setTextConfig] = useState<TextOptions>({
    text: "",
    size: 40,
    color: "#ffffff",
    x: 0.5,
    y: 0.8
  })
  const [removeAudio, setRemoveAudio] = useState(false)

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const dragStartRef = useRef<{ x: number, y: number } | null>(null)
  const cropStartRef = useRef<CropOptions | null>(null)
  const activeHandleRef = useRef<ResizeHandle | null>(null)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none')

  // --- Layout Calculation ---
  const calculateLayout = useCallback(() => {
      if (!wrapperRef.current || videoDimensions.w === 0) return;

      const wrapper = wrapperRef.current.getBoundingClientRect();
      const videoRatio = videoDimensions.w / videoDimensions.h;
      const wrapperRatio = wrapper.width / wrapper.height;

      let newWidth, newHeight;

      if (wrapperRatio > videoRatio) {
          newHeight = wrapper.height;
          newWidth = newHeight * videoRatio;
      } else {
          newWidth = wrapper.width;
          newHeight = newWidth / videoRatio;
      }

      setLayout({ width: newWidth, height: newHeight });
      // Reset crop only if it's 0 (first load)
      if (crop.width === 0) {
          setCrop({ x: 0, y: 0, width: newWidth, height: newHeight });
      }

  }, [videoDimensions, crop.width]);

  useEffect(() => {
      window.addEventListener('resize', calculateLayout);
      return () => window.removeEventListener('resize', calculateLayout);
  }, [calculateLayout]);

  useEffect(() => {
      calculateLayout();
  }, [calculateLayout]);


  // --- Initialization ---
  useEffect(() => {
    const generateThumbnails = async () => {
        if (!videoRef.current) return;
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

    setTimeout(generateThumbnails, 500);
  }, [videoUrl]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight });
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
      setCurrentTime(videoRef.current.currentTime);
      const endSecond = (trimRange[1] / 100) * duration;
      const startSecond = (trimRange[0] / 100) * duration;
      if (videoRef.current.currentTime >= endSecond) {
          videoRef.current.currentTime = startSecond;
          if(!isPlaying) togglePlay(); 
      }
    }
  }

  // --- Interaction Logic ---
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

      if (interactionMode === 'text-move') {
          const x = Math.max(0, Math.min(1, pos.x / pos.containerW));
          const y = Math.max(0, Math.min(1, pos.y / pos.containerH));
          setTextConfig(prev => ({ ...prev, x, y }));
          return;
      }

      if (interactionMode === 'crop-move' && cropStartRef.current) {
          let newX = cropStartRef.current.x + deltaX;
          let newY = cropStartRef.current.y + deltaY;
          newX = Math.max(0, Math.min(newX, pos.containerW - crop.width));
          newY = Math.max(0, Math.min(newY, pos.containerH - crop.height));
          setCrop({ ...crop, x: newX, y: newY });
      }

      if (interactionMode === 'crop-resize' && cropStartRef.current && activeHandleRef.current) {
          const start = cropStartRef.current;
          let { x, y, width, height } = start; 
          const handle = activeHandleRef.current;
          if (handle.includes('e')) width = start.width + deltaX;
          if (handle.includes('w')) { width = start.width - deltaX; x = start.x + deltaX; }
          if (handle.includes('s')) height = start.height + deltaY;
          if (handle.includes('n')) { height = start.height - deltaY; y = start.y + deltaY; }
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

  const prepareAndProcess = () => {
    if (!videoRef.current || !containerRef.current) return;
    const scaleX = videoDimensions.w / layout.width;
    const scaleY = videoDimensions.h / layout.height;
    const finalCrop = {
        x: Math.round(crop.x * scaleX),
        y: Math.round(crop.y * scaleY),
        width: Math.round(crop.width * scaleX),
        height: Math.round(crop.height * scaleY)
    };
    const start = (trimRange[0] / 100) * duration;
    const end = (trimRange[1] / 100) * duration;
    // Convert text position from full-video-relative to crop-area-relative
    let adjustedTextConfig: TextOptions | undefined = undefined;
    if (textConfig.text) {
        const textPixelX = textConfig.x * layout.width;
        const textPixelY = textConfig.y * layout.height;
        adjustedTextConfig = {
            ...textConfig,
            size: Math.round(textConfig.size * scaleY),
            x: Math.max(0, Math.min(1, (textPixelX - crop.x) / crop.width)),
            y: Math.max(0, Math.min(1, (textPixelY - crop.y) / crop.height)),
        };
    }

    onProcess({
      trim_start: start,
      trim_end: end,
      remove_audio: removeAudio,
      text_config: adjustedTextConfig,
      crop: finalCrop
    });
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] bg-background text-foreground overflow-hidden"
         onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseMove={handleMouseMove}>

      {/* Video Preview */}
      <div ref={wrapperRef} className="flex-1 min-h-0 relative flex items-center justify-center bg-muted/30 overflow-hidden select-none">
          {videoUrl ? (
              <div
                  ref={containerRef}
                  style={{ width: layout.width, height: layout.height }}
                  className="relative shadow-2xl bg-black"
              >
                  <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain pointer-events-none block"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                  />

                  {/* Crop Overlay */}
                  <div
                      className="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] cursor-move group z-20"
                      style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }}
                      onMouseDown={(e) => handleMouseDown(e, 'crop-move')}
                  >
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity">
                          <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                          <div className="border-r border-white/50 col-span-1 row-span-3"></div>
                          <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-1/3"></div>
                          <div className="border-b border-white/50 col-span-3 row-span-1 absolute w-full top-2/3"></div>
                      </div>
                      {(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as ResizeHandle[]).map((h) => (
                          <div key={h} onMouseDown={(e) => handleMouseDown(e, 'crop-resize', h)}
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

                  {textConfig.text && (
                      <div
                          className="absolute cursor-grab active:cursor-grabbing border border-transparent hover:border-white/50 p-1 rounded z-30"
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
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="animate-spin h-8 w-8 text-primary"/>
                  <span className="text-sm">Загрузка видео...</span>
              </div>
          )}
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto">
          {/* Таймлайн */}
          <div className="p-4 border-b border-border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Таймлайн</Label>
              <div className="flex items-center gap-2 mb-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-accent shrink-0" onClick={togglePlay}>
                      {isPlaying ? <Pause size={14}/> : <Play size={14} className="ml-0.5"/>}
                  </Button>
                  <span className="text-xs font-medium text-foreground font-mono tabular-nums">{currentTime.toFixed(1)}s</span>
                  <span className="text-[10px] text-muted-foreground font-mono">/ {duration.toFixed(1)}s</span>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground hover:text-foreground px-2" onClick={() => {
                      if (videoRef.current) {
                          videoRef.current.currentTime = (trimRange[0]/100) * duration;
                          setTrimRange([0, 100]);
                      }
                  }}>
                      <RotateCcw size={10} className="mr-1"/> Сброс
                  </Button>
              </div>
              <div className="relative h-12 w-full rounded-lg overflow-hidden bg-popover/50 select-none">
                  <div className="absolute inset-0 flex">
                      {thumbnails.length > 0 ? thumbnails.map((src, i) => {
                          const thumbPercent = (i / thumbnails.length) * 100;
                          const isInRange = thumbPercent >= trimRange[0] && thumbPercent <= trimRange[1];
                          return (
                              <img key={i} src={src} className={`h-full flex-1 object-cover pointer-events-none transition-all duration-300 ${isInRange ? 'opacity-80 grayscale-0' : 'opacity-30 grayscale'}`} alt="frame" />
                          );
                      }) : (
                          <div className="flex h-full w-full gap-0.5">
                              {Array.from({length: 10}).map((_, i) => (
                                  <div key={i} className="flex-1 bg-muted animate-pulse rounded-sm" />
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="absolute inset-0 flex items-center z-10">
                      <Slider
                          value={trimRange}
                          min={0} max={100} step={0.1}
                          onValueChange={(val) => {
                              setTrimRange(val as [number, number]);
                              if (videoRef.current) {
                                  if (isPlaying) videoRef.current.pause();
                                  setIsPlaying(false);
                                  videoRef.current.currentTime = (val[0] / 100) * duration;
                              }
                          }}
                          className="cursor-pointer"
                      />
                  </div>
                  <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-0 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                      style={{ left: `${(currentTime / duration) * 100}%` }} />
              </div>
          </div>

          {/* Текст */}
          <div className="p-4 border-b border-border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Текст</Label>
              <Input placeholder="Подпись..." className="mb-3 bg-background border-input"
                  value={textConfig.text} onChange={(e) => setTextConfig({...textConfig, text: e.target.value})} />
              {textConfig.text && (
                  <div className="space-y-3">
                      <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground shrink-0">Размер: {textConfig.size}</span>
                          <Slider value={[textConfig.size]} min={10} max={100} step={1} className="flex-1"
                              onValueChange={(v) => setTextConfig({...textConfig, size: v[0]})} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                          {['#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899'].map(c => (
                              <button key={c} onClick={() => setTextConfig({...textConfig, color: c})}
                                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${textConfig.color === c ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
                                  style={{ backgroundColor: c }} />
                          ))}
                      </div>
                  </div>
              )}
          </div>

          {/* Аудио */}
          <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Аудио</Label>
                  <button
                      onClick={() => setRemoveAudio(!removeAudio)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${removeAudio ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                  >
                      {removeAudio ? <VolumeX size={14}/> : <Volume2 size={14}/>}
                      {removeAudio ? 'Выключен' : 'Включён'}
                  </button>
              </div>
          </div>

          {/* Экспорт */}
          <div className="p-4">
              <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg transition-all hover:scale-[1.01]"
                  onClick={prepareAndProcess} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Обработка...</> : 'Далее'}
              </Button>
          </div>
      </div>
    </div>
  )
}