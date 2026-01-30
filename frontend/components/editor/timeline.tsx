"use client";
import { Layer } from "@/types/editor";
import { useRef, useState, useEffect } from "react";

interface TimelineProps {
  layers: Layer[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onLayerUpdate: (id: string, updates: Partial<Layer>) => void; // Обновили тип
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
}

export function Timeline({ 
    layers, duration, currentTime, onSeek, 
    onLayerUpdate, selectedLayerId, onSelectLayer 
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<{id: string, startX: number, initDur: number} | null>(null);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!containerRef.current || isDragging) return; // Не кликаем, если тянем
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    onSeek(percent * duration);
  };

  // Логика перетаскивания (Resizing)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const deltaX = e.clientX - isDragging.startX;
        const deltaPercent = deltaX / rect.width;
        const deltaTime = deltaPercent * duration;
        
        const newDuration = Math.max(0.5, isDragging.initDur + deltaTime);
        
        // Ограничиваем, чтобы не вылезло за пределы видео
        // const layer = layers.find(l => l.id === isDragging.id);
        // if (layer && (layer.start + newDuration) > duration) return;

        onLayerUpdate(isDragging.id, { duration: newDuration });
    };

    const handleMouseUp = () => {
        setIsDragging(null);
    };

    if (isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, onLayerUpdate]);

  return (
    <div className="w-full bg-zinc-950 h-48 flex flex-col select-none overflow-hidden border-t border-zinc-800">
        <div className="h-8 border-b border-zinc-800 flex items-center px-2 text-xs text-zinc-400 bg-zinc-900">
            <span>00:00</span>
            <div className="flex-1"/>
            <span>{duration.toFixed(1)}s</span>
        </div>

        <div className="flex-1 relative overflow-y-auto p-2" ref={containerRef} onClick={handleTimelineClick}>
            <div 
                className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-50 pointer-events-none transition-all duration-75"
                style={{ left: `${(currentTime / duration) * 100}%` }}
            >
                <div className="w-3 h-3 bg-red-500 -ml-[5px] rotate-45 transform -mt-1 shadow" />
            </div>

            <div className="space-y-2 relative min-h-full pb-10">
                {layers.map((layer) => (
                    <div 
                        key={layer.id} 
                        className={`
                            h-8 rounded relative cursor-pointer overflow-hidden border group
                            ${layer.type === 'text' ? 'bg-purple-600/40 border-purple-500' : 'bg-blue-600/40 border-blue-500'}
                            ${selectedLayerId === layer.id ? 'ring-2 ring-white' : ''}
                        `}
                        style={{
                            left: `${(layer.start / duration) * 100}%`,
                            width: `${(layer.duration / duration) * 100}%`,
                            minWidth: '10px'
                        }}
                        onClick={(e) => { e.stopPropagation(); onSelectLayer(layer.id); }}
                    >
                        <div className="px-2 text-[10px] text-white truncate leading-8 font-medium shadow-sm pointer-events-none">
                            {layer.type === 'text' ? 'T: ' + layer.content : 'IMG'}
                        </div>
                        
                        {/* Ручка изменения размера справа */}
                        <div 
                            className="absolute right-0 top-0 bottom-0 w-3 bg-white/20 hover:bg-white/50 cursor-e-resize z-20"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsDragging({ id: layer.id, startX: e.clientX, initDur: layer.duration });
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
}