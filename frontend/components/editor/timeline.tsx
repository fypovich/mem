"use client";
import { Layer } from "@/types/editor";
import { useRef } from "react";

interface TimelineProps {
  layers: Layer[];
  duration: number; // Общая длительность видео
  currentTime: number;
  onSeek: (time: number) => void;
  onLayerUpdate: (id: string, start: number, duration: number) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
}

export function Timeline({ layers, duration, currentTime, onSeek, onLayerUpdate, selectedLayerId, onSelectLayer }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Конвертация секунд в пиксели (1 сек = 50px)
  const PIXELS_PER_SEC = 50;
  const totalWidth = Math.max(duration * PIXELS_PER_SEC, 800); // Минимум 800px

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(x / PIXELS_PER_SEC, duration));
    onSeek(time);
  };

  return (
    <div className="w-full bg-zinc-900 border-t border-zinc-800 h-64 flex flex-col select-none">
        {/* Time Ruler */}
        <div className="h-8 border-b border-zinc-800 relative bg-zinc-950" ref={containerRef} onClick={handleTimelineClick}>
            {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-700 text-[10px] text-zinc-500 pl-1" style={{ left: i * PIXELS_PER_SEC }}>
                    {i}s
                </div>
            ))}
            {/* Playhead (Курсор) */}
            <div 
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none"
                style={{ left: currentTime * PIXELS_PER_SEC }}
            >
                <div className="w-3 h-3 bg-red-500 -ml-[5px] rotate-45 transform" />
            </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 relative">
            {layers.map(layer => (
                <div 
                    key={layer.id} 
                    className={`
                        h-10 rounded-md relative cursor-pointer group transition-colors
                        ${layer.type === 'text' ? 'bg-blue-900/50 border-blue-700' : 'bg-purple-900/50 border-purple-700'}
                        ${selectedLayerId === layer.id ? 'border-2 border-white' : 'border'}
                    `}
                    style={{
                        left: layer.start * PIXELS_PER_SEC,
                        width: layer.duration * PIXELS_PER_SEC,
                        position: 'absolute', // Простая реализация, в идеале relative внутри grid
                        top: layers.indexOf(layer) * 48 // Отступ сверху
                    }}
                    onClick={(e) => { e.stopPropagation(); onSelectLayer(layer.id); }}
                >
                    <div className="px-2 py-1 text-xs truncate text-white/90 font-medium flex items-center h-full">
                        {layer.type === 'text' ? 'T' : 'IMG'} {layer.content?.substring(0, 10)}
                    </div>
                    
                    {/* Handles for resize (simplified) */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/50" />
                </div>
            ))}
        </div>
    </div>
  );
}