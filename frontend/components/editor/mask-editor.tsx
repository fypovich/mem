"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw, Scissors, Wand2, Undo, Redo, ZoomIn } from "lucide-react";
import { Loader2 } from "lucide-react";

interface MaskEditorProps {
  originalUrl: string;
  initialMaskedUrl?: string | null;
  isProcessing?: boolean;
  onAutoRemove?: () => void;
}

export interface MaskEditorRef {
  save: () => Promise<Blob | null>;
  undo: () => void;
  redo: () => void;
}

export const MaskEditor = forwardRef<MaskEditorRef, MaskEditorProps>(
  ({ originalUrl, initialMaskedUrl, isProcessing, onAutoRemove }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Состояние изображения
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    
    // Состояние UI (убрали 'brush', так как есть 'restore')
    const [tool, setTool] = useState<'eraser' | 'restore' | 'lasso' | 'move'>('eraser');
    const [brushSize, setBrushSize] = useState(30);
    
    // Состояние холста (Zoom/Pan)
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [lastPointerPos, setLastPointerPos] = useState({ x: 0, y: 0 });

    // История
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Рисование
    const [isDrawing, setIsDrawing] = useState(false);
    const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
    const [currentPointer, setCurrentPointer] = useState<{x: number, y: number} | null>(null);

    // 1. Инициализация
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = originalUrl;
      img.onload = () => {
        setOriginalImg(img);
        
        // Устанавливаем размер канваса равным размеру картинки
        canvas.width = img.width;
        canvas.height = img.height;

        // Начальная отрисовка
        ctx.drawImage(img, 0, 0);

        // Если есть маска от AI
        if (initialMaskedUrl) {
          const mask = new Image();
          mask.crossOrigin = "anonymous";
          mask.src = initialMaskedUrl;
          mask.onload = () => {
             // Очищаем канвас и рисуем маску
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
             saveState();
             centerImage(img.width, img.height);
          };
        } else {
            saveState();
            centerImage(img.width, img.height);
        }
      };
    }, [originalUrl, initialMaskedUrl]);

    // Центрирование изображения при загрузке
    const centerImage = (imgW: number, imgH: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const scaleX = clientWidth / imgW;
        const scaleY = clientHeight / imgH;
        const newScale = Math.min(scaleX, scaleY) * 0.9; // 90% заполнения
        
        setScale(newScale);
        setOffset({
            x: (clientWidth - imgW * newScale) / 2,
            y: (clientHeight - imgH * newScale) / 2
        });
    };

    // 2. История изменений
    const saveState = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(imageData);
        
        if (newHistory.length > 20) newHistory.shift(); // Лимит истории
        
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            const ctx = canvasRef.current?.getContext('2d');
            ctx?.putImageData(history[newIndex], 0, 0);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            const ctx = canvasRef.current?.getContext('2d');
            ctx?.putImageData(history[newIndex], 0, 0);
        }
    };

    // 3. API для родителя
    useImperativeHandle(ref, () => ({
        save: async () => {
            return new Promise((resolve) => {
                canvasRef.current?.toBlob((blob) => resolve(blob), 'image/png');
            });
        },
        undo: handleUndo,
        redo: handleRedo
    }));

    // 4. Логика взаимодействия
    const getPointerPos = (e: React.PointerEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const toCanvasCoords = (screenX: number, screenY: number) => {
        return {
            x: (screenX - offset.x) / scale,
            y: (screenY - offset.y) / scale
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        const { x, y } = getPointerPos(e);
        setLastPointerPos({ x, y });
        
        // Если это перемещение холста (или пробел/средняя кнопка)
        if (tool === 'move' || e.button === 1) {
            setIsDraggingCanvas(true);
            return;
        }

        setIsDrawing(true);
        const p = toCanvasCoords(x, y);
        
        if (tool === 'lasso') {
            setLassoPoints([{ x: p.x, y: p.y }]);
        } else {
            draw(p.x, p.y);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const { x, y } = getPointerPos(e);
        const p = toCanvasCoords(x, y);
        setCurrentPointer(p);

        // Перемещение холста
        if (isDraggingCanvas) {
            const dx = x - lastPointerPos.x;
            const dy = y - lastPointerPos.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPointerPos({ x, y });
            return;
        }

        if (!isDrawing) return;

        if (tool === 'lasso') {
            setLassoPoints(prev => [...prev, { x: p.x, y: p.y }]);
        } else {
            draw(p.x, p.y);
        }
    };

    const handlePointerUp = () => {
        setIsDraggingCanvas(false);
        if (!isDrawing) return;
        setIsDrawing(false);

        if (tool === 'lasso') {
            applyLasso();
        } else {
            saveState();
        }
    };

    // Функция рисования (Кисть / Ластик)
    const draw = (x: number, y: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !originalImg) return;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.moveTo(x, y); // Для точек
            ctx.lineTo(x, y); // Для линий
            ctx.stroke();
        } else if (tool === 'restore') {
            // Восстановление: рисуем оригинальным изображением
            ctx.globalCompositeOperation = 'source-over';
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.clip();
            // Рисуем оригинал ровно в том месте, где он должен быть
            ctx.drawImage(originalImg, 0, 0);
            ctx.restore();
        }
    };

    // Применение лассо
    const applyLasso = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || lassoPoints.length < 3) {
            setLassoPoints([]);
            return;
        }

        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
        lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();
        
        ctx.globalCompositeOperation = 'source-over';
        
        setLassoPoints([]);
        saveState();
        setTool('eraser'); 
    };

    return (
        <div className="relative w-full h-full flex flex-col bg-zinc-950 overflow-hidden">
            {/* Рабочая область */}
            <div 
                ref={containerRef}
                className="flex-1 relative overflow-hidden touch-none bg-[url('/transparent-grid.png')]"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={(e) => {
                    const newScale = Math.max(0.1, Math.min(5, scale - e.deltaY * 0.001));
                    setScale(newScale);
                }}
            >
                <canvas 
                    ref={canvasRef}
                    className="absolute origin-top-left"
                    style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        cursor: tool === 'move' ? 'grab' : 'none'
                    }}
                />

                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    {/* Линия лассо */}
                    {tool === 'lasso' && lassoPoints.length > 0 && (
                        <path 
                            d={`M ${lassoPoints.map(p => `${p.x * scale + offset.x},${p.y * scale + offset.y}`).join(' L ')}`}
                            fill="rgba(59, 130, 246, 0.2)"
                            stroke="#3b82f6"
                            strokeWidth="2"
                        />
                    )}
                    
                    {/* Курсор кисти */}
                    {currentPointer && tool !== 'lasso' && tool !== 'move' && (
                        <circle 
                            cx={currentPointer.x * scale + offset.x}
                            cy={currentPointer.y * scale + offset.y}
                            r={(brushSize * scale) / 2}
                            fill="none"
                            stroke={tool === 'restore' ? '#22c55e' : 'white'}
                            strokeWidth="2"
                            className="drop-shadow-md"
                        />
                    )}
                </svg>
            </div>

            {/* Нижняя панель инструментов */}
            <div className="h-auto bg-zinc-950 border-t border-zinc-900 p-4 pb-8 flex flex-col gap-4 z-20">
                
                {/* Слайдер размера (только для кисти/ластика) - ИСПРАВЛЕНА ОШИБКА ТУТ */}
                {(tool === 'eraser' || tool === 'restore') && (
                    <div className="flex items-center gap-4 px-4 animate-in slide-in-from-bottom-2">
                        <span className="text-xs text-zinc-500 font-medium w-12">Размер</span>
                        <Slider 
                            value={[brushSize]} 
                            onValueChange={v => setBrushSize(v[0])} 
                            min={5} max={100} step={1} 
                            className="flex-1"
                        />
                        <span className="text-xs text-zinc-400 w-8 text-right">{brushSize}</span>
                    </div>
                )}

                {/* Основные кнопки */}
                <div className="flex items-center justify-between max-w-md mx-auto w-full px-2">
                    {/* История */}
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} className="text-zinc-400 hover:text-white">
                            <Undo size={20} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="text-zinc-400 hover:text-white">
                            <Redo size={20} />
                        </Button>
                    </div>

                    {/* Инструменты */}
                    <div className="flex bg-zinc-900 rounded-full p-1 gap-1 border border-zinc-800">
                        <ToolButton 
                            active={tool === 'lasso'} 
                            onClick={() => setTool('lasso')} 
                            icon={<Scissors size={18} />} 
                        />
                         <ToolButton 
                            active={tool === 'eraser'} 
                            onClick={() => setTool('eraser')} 
                            icon={<Eraser size={18} />} 
                        />
                         <ToolButton 
                            active={tool === 'restore'} 
                            onClick={() => setTool('restore')} 
                            icon={<RotateCcw size={18} />} 
                        />
                         <ToolButton 
                            active={tool === 'move'} 
                            onClick={() => setTool('move')} 
                            icon={<ZoomIn size={18} />} 
                        />
                    </div>

                    {/* AI Magic */}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onAutoRemove}
                        disabled={isProcessing}
                        className={`text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 ${isProcessing ? 'animate-pulse' : ''}`}
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={22}/> : <Wand2 size={22}/>}
                    </Button>
                </div>
            </div>
        </div>
    );
});

MaskEditor.displayName = "MaskEditor";

// Вспомогательный компонент кнопки
function ToolButton({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                active 
                ? 'bg-zinc-700 text-white shadow-sm' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
        >
            {icon}
        </button>
    )
}