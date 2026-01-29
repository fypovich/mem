"use client";
import { Layer } from "@/types/editor";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface CanvasProps {
  videoUrl: string | null;
  layers: Layer[];
  currentTime: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function Canvas({ videoUrl, layers, currentTime, selectedLayerId, onSelectLayer, onUpdatePosition, videoRef }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Фильтруем слои, которые должны быть видны в текущий момент времени
  const visibleLayers = layers.filter(
    l => currentTime >= l.start && currentTime <= (l.start + l.duration)
  );

  return (
    <div 
        className="relative w-full h-full flex items-center justify-center bg-black/90 overflow-hidden" 
        onClick={() => onSelectLayer(null)}
        ref={containerRef}
    >
      {videoUrl ? (
        <div className="relative aspect-[9/16] h-[90%] bg-black shadow-2xl">
            {/* Base Video */}
            <video 
                ref={videoRef}
                src={videoUrl} 
                className="w-full h-full object-contain pointer-events-none"
            />

            {/* Overlays */}
            {visibleLayers.map(layer => (
                <motion.div
                    key={layer.id}
                    initial={false}
                    drag
                    dragMomentum={false}
                    // Ограничиваем перетаскивание размерами видео (примерно)
                    dragConstraints={containerRef} 
                    onDragEnd={(e, info) => {
                        // В реальном приложении нужно конвертировать пиксели экрана в координаты видео
                        // Пока сохраняем просто смещение, чтобы показать принцип
                        // onUpdatePosition(layer.id, info.point.x, info.point.y);
                    }}
                    onClick={(e) => { e.stopPropagation(); onSelectLayer(layer.id); }}
                    style={{
                        position: 'absolute',
                        // Центрируем начальную позицию (упрощенно)
                        top: '50%', 
                        left: '50%',
                        x: '-50%',
                        y: '-50%',
                        cursor: 'grab',
                        zIndex: 10
                    }}
                    className={`
                        ${selectedLayerId === layer.id ? 'ring-2 ring-blue-500' : ''}
                    `}
                >
                    {layer.type === 'text' ? (
                        <p style={{ 
                            fontSize: `${layer.fontsize}px`, 
                            color: layer.color,
                            fontWeight: 'bold',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            whiteSpace: 'nowrap',
                            lineHeight: 1
                        }}>
                            {layer.content}
                        </p>
                    ) : (
                        <img 
                            src={layer.path ? layer.path.replace('uploads/', '/static/') : ''} // Хак для локального пути
                            alt="sticker"
                            style={{ width: `${layer.width}px` }}
                            className="pointer-events-none"
                        />
                    )}
                </motion.div>
            ))}
        </div>
      ) : (
        <div className="text-zinc-500">Нет видео</div>
      )}
    </div>
  );
}