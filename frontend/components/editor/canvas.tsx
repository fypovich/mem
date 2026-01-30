"use client";
import React, { useRef, useState, useEffect } from "react";
import { Layer } from "@/types/editor";
import { Rnd } from "react-rnd";

interface CanvasProps {
  videoUrl: string | null;
  layers: Layer[];
  currentTime: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoAspectRatio?: number; // Новое свойство для пропорций
}

export function Canvas({ 
  videoUrl, layers, currentTime, selectedLayerId, 
  onSelectLayer, onUpdateLayer, videoRef, videoAspectRatio
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Обновляем размеры контейнера при изменении окна или загрузке видео
  useEffect(() => {
    const updateSize = () => {
        if (containerRef.current) {
            setContainerSize({
                w: containerRef.current.offsetWidth,
                h: containerRef.current.offsetHeight
            });
        }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    setTimeout(updateSize, 500); 
    return () => window.removeEventListener('resize', updateSize);
  }, [videoUrl, videoAspectRatio]);

  const visibleLayers = layers.filter(
    l => currentTime >= l.start && currentTime <= (l.start + l.duration)
  );

  return (
    <div 
        className="relative w-full h-full flex items-center justify-center bg-zinc-900/50 overflow-hidden p-8" 
        onClick={() => onSelectLayer(null)}
    >
      {videoUrl ? (
        <div 
            ref={containerRef}
            className="relative bg-black shadow-2xl overflow-hidden"
            style={{
                // Динамический расчет размеров, чтобы видео вписывалось без полос
                aspectRatio: videoAspectRatio ? `${videoAspectRatio}` : 'auto',
                height: '100%',
                width: videoAspectRatio ? 'auto' : '100%',
                maxWidth: '100%'
            }}
        >
            <video 
                ref={videoRef}
                src={videoUrl} 
                className="w-full h-full object-contain pointer-events-none"
                style={{ width: '100%', height: '100%' }} // Заставляем видео заполнять контейнер
            />

            {visibleLayers.map(layer => (
                <Rnd
                    key={layer.id}
                    size={{ 
                        width: `${layer.width}%`, 
                        height: layer.type === 'text' ? 'auto' : `${layer.height}%` 
                    }}
                    position={{ 
                        x: (layer.x / 100) * containerSize.w, 
                        y: (layer.y / 100) * containerSize.h 
                    }}
                    bounds="parent"
                    onDragStop={(e, d) => {
                        const xPercent = (d.x / containerSize.w) * 100;
                        const yPercent = (d.y / containerSize.h) * 100;
                        onUpdateLayer(layer.id, { x: xPercent, y: yPercent });
                        onSelectLayer(layer.id);
                    }}
                    // ВАЖНО: Используем onResize для плавности
                    onResize={(e, direction, ref, delta, position) => {
                         // Тут можно обновлять локальный стейт для супер-плавности, 
                         // но пока попробуем обновлять слой напрямую
                         const wPercent = (ref.offsetWidth / containerSize.w) * 100;
                         const hPercent = (ref.offsetHeight / containerSize.h) * 100;
                         // Для текста обновляем fontsize визуально (можно доработать логику)
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                        const wPercent = (ref.offsetWidth / containerSize.w) * 100;
                        const hPercent = (ref.offsetHeight / containerSize.h) * 100;
                        const xPercent = (position.x / containerSize.w) * 100;
                        const yPercent = (position.y / containerSize.h) * 100;
                        
                        onUpdateLayer(layer.id, { 
                            width: wPercent, 
                            height: hPercent,
                            x: xPercent,
                            y: yPercent
                        });
                    }}
                    onClick={(e: any) => { e.stopPropagation(); onSelectLayer(layer.id); }}
                    enableResizing={selectedLayerId === layer.id}
                    disableDragging={selectedLayerId !== layer.id}
                    className={`
                        ${selectedLayerId === layer.id ? 'border-2 border-blue-500 z-50' : 'hover:border border-white/30 z-10'}
                        flex items-center justify-center
                    `}
                    lockAspectRatio={layer.type === 'image'}
                >
                    {layer.type === 'text' ? (
                        <div style={{ 
                            // Динамический шрифт относительно ширины контейнера
                            fontSize: `${(layer.width / 100) * containerSize.w * 0.25}px`, 
                            color: layer.color,
                            fontWeight: 'bold',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            width: '100%',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap'
                        }}>
                            {layer.content}
                        </div>
                    ) : (
                        // Используем URL картинки (если есть) или заглушку
                        // ВАЖНО: layer.content здесь может хранить URL, если мы так настроим в page.tsx
                        <img 
                            src={layer.content.startsWith('http') || layer.content.startsWith('/') ? layer.content : ''}
                            alt="sticker"
                            className="w-full h-full object-contain pointer-events-none"
                            style={{ 
                                filter: `brightness(${layer.filters?.brightness || 1})`,
                                opacity: layer.filters?.opacity || 1
                            }}
                        />
                    )}
                </Rnd>
            ))}
        </div>
      ) : (
        <div className="text-zinc-500">Загрузите видео</div>
      )}
    </div>
  );
}