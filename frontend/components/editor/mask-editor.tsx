"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"; // <-- Fixed: Added Import
import { Eraser, RotateCcw, Scissors, Wand2, Undo, Redo, ZoomIn, ChevronRight, MousePointer2, Move } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MaskEditorProps {
  originalUrl: string;
  initialMaskedUrl?: string | null;
  isProcessing?: boolean;
  onAutoRemove?: () => void;
  onNext?: () => void;
}

export interface MaskEditorRef {
  save: () => Promise<Blob | null>;
  undo: () => void;
  redo: () => void;
}

export const MaskEditor = forwardRef<MaskEditorRef, MaskEditorProps>(
  ({ originalUrl, initialMaskedUrl, isProcessing, onAutoRemove, onNext }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Image State
    const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
    
    // UI State
    const [tool, setTool] = useState<'eraser' | 'restore' | 'lasso' | 'move'>('eraser');
    const [brushSize, setBrushSize] = useState(30);
    
    // Canvas State (Zoom/Pan)
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [lastPointerPos, setLastPointerPos] = useState({ x: 0, y: 0 });

    // History
    const [history, setHistory] = useState<ImageData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Drawing
    const [isDrawing, setIsDrawing] = useState(false);
    const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
    const [currentPointer, setCurrentPointer] = useState<{x: number, y: number} | null>(null);

    // 1. Initialization
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
        
        // Initial setup
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Apply initial mask if exists
        if (initialMaskedUrl) {
          const mask = new Image();
          mask.crossOrigin = "anonymous";
          mask.src = initialMaskedUrl;
          mask.onload = () => {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
             saveState(); // Initial state with mask
             fitImageToContainer(img.width, img.height);
          };
        } else {
            saveState(); // Initial state original
            fitImageToContainer(img.width, img.height);
        }
      };
    }, [originalUrl, initialMaskedUrl]);

    // Resize observer to handle window resize
    useEffect(() => {
        if (!originalImg || !containerRef.current) return;
        const handleResize = () => fitImageToContainer(originalImg.width, originalImg.height);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [originalImg]);

    const fitImageToContainer = (imgW: number, imgH: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        
        // Add some padding (e.g. 40px)
        const availableW = clientWidth - 40;
        const availableH = clientHeight - 40;

        const scaleX = availableW / imgW;
        const scaleY = availableH / imgH;
        const newScale = Math.min(scaleX, scaleY, 1); // Don't zoom in more than 100% initially
        
        setScale(newScale);
        setOffset({
            x: (clientWidth - imgW * newScale) / 2,
            y: (clientHeight - imgH * newScale) / 2
        });
    };

    // 2. History Logic
    const saveState = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(imageData);
        
        if (newHistory.length > 15) newHistory.shift(); // Limit history
        
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

    useImperativeHandle(ref, () => ({
        save: async () => {
            return new Promise((resolve) => {
                canvasRef.current?.toBlob((blob) => resolve(blob), 'image/png');
            });
        },
        undo: handleUndo,
        redo: handleRedo
    }));

    // 3. Drawing & Interaction
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
        
        // Middle mouse or Spacebar (simulated) or Move tool triggers pan
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

    const draw = (x: number, y: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !originalImg) return;

        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (tool === 'restore') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(originalImg, 0, 0);
            ctx.restore();
        }
    };

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
        <div className="flex h-full w-full gap-6 p-6 box-border overflow-hidden bg-zinc-950">
            {/* Left Column: Canvas & History */}
            <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 h-full">
                {/* Header Actions (Undo/Redo) - над картинкой */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={handleUndo} 
                            disabled={historyIndex <= 0} 
                            className="bg-zinc-800 text-white hover:bg-zinc-700 w-10 h-10 rounded-full"
                            title="Undo"
                        >
                            <Undo size={18} />
                        </Button>
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            onClick={handleRedo} 
                            disabled={historyIndex >= history.length - 1} 
                            className="bg-zinc-800 text-white hover:bg-zinc-700 w-10 h-10 rounded-full"
                            title="Redo"
                        >
                            <Redo size={18} />
                        </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800/50">
                        <MousePointer2 size={12}/> Прокрутка для зума • Зажмите для перемещения
                    </div>
                </div>

                {/* Canvas Area Container - занимает всю оставшуюся высоту */}
                <div className="flex-1 relative overflow-hidden rounded-xl border border-zinc-800 bg-[#121212] shadow-2xl flex items-center justify-center">
                    <div 
                        ref={containerRef}
                        className="w-full h-full relative overflow-hidden touch-none cursor-crosshair bg-[url('/transparent-grid.png')] bg-repeat"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={(e) => {
                            const newScale = Math.max(0.1, Math.min(5, scale - e.deltaY * 0.001));
                            setScale(newScale);
                        }}
                        style={{ cursor: tool === 'move' ? 'grab' : 'crosshair' }}
                    >
                        <canvas 
                            ref={canvasRef}
                            className="absolute origin-top-left shadow-lg"
                            style={{
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                            }}
                        />

                        {/* Overlay SVG for UI elements (Cursor, Lasso) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            {tool === 'lasso' && lassoPoints.length > 0 && (
                                <path 
                                    d={`M ${lassoPoints.map(p => `${p.x * scale + offset.x},${p.y * scale + offset.y}`).join(' L ')}`}
                                    fill="rgba(147, 51, 255, 0.2)"
                                    stroke="#9333ea"
                                    strokeWidth="2"
                                />
                            )}
                            {currentPointer && tool !== 'lasso' && tool !== 'move' && (
                                <circle 
                                    cx={currentPointer.x * scale + offset.x}
                                    cy={currentPointer.y * scale + offset.y}
                                    r={(brushSize * scale) / 2}
                                    fill="rgba(255,255,255,0.1)"
                                    stroke={tool === 'restore' ? '#22c55e' : 'white'}
                                    strokeWidth="1"
                                    className="drop-shadow-md"
                                />
                            )}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Right Column: Tools Panel - фиксированная ширина, внутренний скролл */}
            <div className="w-80 flex flex-col bg-[#18181b] rounded-xl border border-zinc-800 shadow-xl h-full flex-shrink-0 overflow-hidden">
                {/* Panel Header */}
                <div className="p-6 border-b border-zinc-800 shrink-0">
                    <h3 className="text-xl font-bold text-white mb-1">Вырезание фона</h3>
                    <p className="text-sm text-zinc-400 leading-snug">Используйте инструменты для удаления фона.</p>
                </div>

                {/* Panel Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* Auto Magic */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">ИИ</Label>
                        <Button 
                            variant="outline"
                            onClick={onAutoRemove}
                            disabled={isProcessing}
                            className="w-full justify-start gap-4 h-16 bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-purple-500/50 text-left group transition-all relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30 group-hover:scale-110 transition-transform">
                                {isProcessing ? <Loader2 className="animate-spin text-purple-400" size={20}/> : <Wand2 className="text-purple-400" size={20}/>}
                            </div>
                            <div className="flex flex-col items-start z-10">
                                <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">Авто-удаление</span>
                                <span className="text-[11px] text-zinc-500">Определить и удалить фон</span>
                            </div>
                        </Button>
                    </div>

                    {/* Manual Tools Grid */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Инструменты</Label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <ToolButton 
                                active={tool === 'lasso'} 
                                onClick={() => setTool('lasso')} 
                                icon={<Scissors size={24} />} 
                                label="Лассо"
                                color="text-blue-400"
                            />
                            <ToolButton
                                active={tool === 'eraser'}
                                onClick={() => setTool('eraser')}
                                icon={<Eraser size={24} />}
                                label="Ластик"
                                color="text-pink-400"
                            />
                            <ToolButton
                                active={tool === 'restore'}
                                onClick={() => setTool('restore')}
                                icon={<RotateCcw size={24} />}
                                label="Восстановить"
                                color="text-green-400"
                            />
                            <ToolButton
                                active={tool === 'move'}
                                onClick={() => setTool('move')}
                                icon={<Move size={24} />}
                                label="Двигать"
                                color="text-yellow-400"
                            />
                        </div>
                    </div>

                    {/* Tool Settings (Contextual) */}
                    {(tool === 'eraser' || tool === 'restore') && (
                        <div className="space-y-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center text-xs font-medium text-zinc-400">
                                <span>Размер кисти</span>
                                <span className="text-white bg-zinc-800 px-2 py-1 rounded">{brushSize}px</span>
                            </div>
                            <Slider 
                                value={[brushSize]} 
                                onValueChange={v => setBrushSize(v[0])} 
                                min={5} max={150} step={1} 
                                className="py-2 cursor-pointer" 
                            />
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-zinc-800 bg-zinc-900 shrink-0">
                    <Button 
                        className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02]"
                        onClick={onNext}
                    >
                        Далее к дизайну <ChevronRight size={20} className="ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
});

MaskEditor.displayName = "MaskEditor";

function ToolButton({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color?: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 h-28",
                active 
                ? "bg-zinc-800 border-white/20 text-white shadow-lg scale-[1.02]" 
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-zinc-700"
            )}
        >
            <div className={cn("p-2 rounded-full bg-zinc-950", active ? color : "text-current")}>
                {icon}
            </div>
            <span className="text-xs font-bold">{label}</span>
        </button>
    )
}