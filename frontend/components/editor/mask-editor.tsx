"use client";

import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Eraser, RotateCcw, Scissors, Wand2, Undo, Redo, ZoomIn, ChevronRight, MousePointer2 } from "lucide-react";
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
        
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        if (initialMaskedUrl) {
          const mask = new Image();
          mask.crossOrigin = "anonymous";
          mask.src = initialMaskedUrl;
          mask.onload = () => {
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

    const centerImage = (imgW: number, imgH: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const scaleX = clientWidth / imgW;
        const scaleY = clientHeight / imgH;
        const newScale = Math.min(scaleX, scaleY) * 0.9;
        
        setScale(newScale);
        setOffset({
            x: (clientWidth - imgW * newScale) / 2,
            y: (clientHeight - imgH * newScale) / 2
        });
    };

    // 2. History
    const saveState = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(imageData);
        
        if (newHistory.length > 20) newHistory.shift();
        
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

    // 3. Interaction
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
        <div className="flex h-full w-full bg-zinc-950 p-4 gap-4">
            {/* Left Column: Canvas & History */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
                {/* Header Actions (Undo/Redo) */}
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleUndo} 
                        disabled={historyIndex <= 0} 
                        className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 w-10 h-10"
                    >
                        <Undo size={18} />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleRedo} 
                        disabled={historyIndex >= history.length - 1} 
                        className="bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800 w-10 h-10"
                    >
                        <Redo size={18} />
                    </Button>
                    
                    <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
                        <MousePointer2 size={12}/> Scroll to zoom • Drag to pan
                    </div>
                </div>

                {/* Canvas Area */}
                <div 
                    ref={containerRef}
                    className="flex-1 relative overflow-hidden rounded-xl border border-zinc-800 bg-[url('/transparent-grid.png')] touch-none shadow-inner"
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
                        {tool === 'lasso' && lassoPoints.length > 0 && (
                            <path 
                                d={`M ${lassoPoints.map(p => `${p.x * scale + offset.x},${p.y * scale + offset.y}`).join(' L ')}`}
                                fill="rgba(59, 130, 246, 0.2)"
                                stroke="#3b82f6"
                                strokeWidth="2"
                            />
                        )}
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
            </div>

            {/* Right Column: Tools */}
            <div className="w-80 flex flex-col gap-6 bg-zinc-900 rounded-xl p-6 border border-zinc-800 shadow-xl h-full flex-shrink-0">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Tools</h3>
                    <p className="text-xs text-zinc-500">Remove background and clean up</p>
                </div>

                {/* Auto Remove */}
                <Button 
                    variant="outline"
                    onClick={onAutoRemove}
                    disabled={isProcessing}
                    className="w-full justify-start gap-3 h-14 bg-zinc-950 border-zinc-800 hover:bg-zinc-800 hover:border-purple-500/50 text-left group transition-all"
                >
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20">
                        {isProcessing ? <Loader2 className="animate-spin text-purple-500" size={18}/> : <Wand2 className="text-purple-500" size={18}/>}
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-white">Auto Remove</span>
                        <span className="text-[10px] text-zinc-500">AI Background Removal</span>
                    </div>
                </Button>

                <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Manual Tools</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={20} />} label="Eraser" />
                        <ToolButton active={tool === 'restore'} onClick={() => setTool('restore')} icon={<RotateCcw size={20} />} label="Restore" />
                        <ToolButton active={tool === 'lasso'} onClick={() => setTool('lasso')} icon={<Scissors size={20} />} label="Lasso" />
                        <ToolButton active={tool === 'move'} onClick={() => setTool('move')} icon={<ZoomIn size={20} />} label="Move" />
                    </div>

                    {(tool === 'eraser' || tool === 'restore') && (
                        <div className="space-y-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800 mt-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between text-xs font-medium text-zinc-400">
                                <span>Brush Size</span>
                                <span className="text-white">{brushSize}px</span>
                            </div>
                            <Slider value={[brushSize]} onValueChange={v => setBrushSize(v[0])} min={5} max={100} step={1} className="py-2" />
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-6 border-t border-zinc-800">
                    <Button 
                        className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg shadow-white/5"
                        onClick={onNext}
                    >
                        Next Step <ChevronRight size={20} className="ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
});

MaskEditor.displayName = "MaskEditor";

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200",
                active 
                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20 scale-[1.02]" 
                : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-zinc-700"
            )}
        >
            {icon}
            <span className="text-xs font-medium">{label}</span>
        </button>
    )
}