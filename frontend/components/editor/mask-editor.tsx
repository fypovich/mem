"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, RotateCcw, Check, Scissors, Wand2, MousePointer2 } from "lucide-react";
import { Loader2 } from "lucide-react";

interface MaskEditorProps {
  originalUrl: string;
  initialMaskedUrl?: string;
  isProcessing?: boolean;
  onAutoRemove?: () => void;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function MaskEditor({ originalUrl, initialMaskedUrl, isProcessing, onAutoRemove, onSave, onCancel }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  
  const [tool, setTool] = useState<'eraser' | 'restore' | 'lasso'>('lasso');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);

  // Инициализация
  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;
    
    const context = canvasRef.current.getContext('2d', { willReadFrequently: true });
    const ovCtx = overlayRef.current.getContext('2d');
    
    if (!context || !ovCtx) return;

    setCtx(context);
    setOverlayCtx(ovCtx);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = originalUrl;
    img.onload = () => {
      setOriginalImg(img);
      const maxW = 1000;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);

      [canvasRef.current, overlayRef.current].forEach(c => {
          if (c) { c.width = w; c.height = h; }
      });

      // Рисуем начальное состояние
      context.clearRect(0, 0, w, h);
      if (initialMaskedUrl) {
          const mask = new Image();
          mask.crossOrigin = "anonymous";
          mask.src = initialMaskedUrl;
          mask.onload = () => context.drawImage(mask, 0, 0, w, h);
      } else {
          context.drawImage(img, 0, 0, w, h);
      }
    };
  }, [originalUrl, initialMaskedUrl]);

  // Отрисовка UI (лассо, курсор)
  useEffect(() => {
      if (!overlayCtx || !overlayRef.current) return;
      const w = overlayRef.current.width;
      const h = overlayRef.current.height;
      overlayCtx.clearRect(0, 0, w, h);

      // Лассо
      if (tool === 'lasso' && lassoPoints.length > 0) {
          overlayCtx.beginPath();
          overlayCtx.lineWidth = 2;
          overlayCtx.strokeStyle = '#3b82f6';
          overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.2)';
          
          overlayCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
          lassoPoints.forEach(p => overlayCtx.lineTo(p.x, p.y));
          if (mousePos) overlayCtx.lineTo(mousePos.x, mousePos.y);
          
          overlayCtx.stroke();
          lassoPoints.forEach(p => {
              overlayCtx.beginPath();
              overlayCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
              overlayCtx.fillStyle = 'white';
              overlayCtx.fill();
          });
      }

      // Курсор кисти
      if (tool !== 'lasso' && mousePos) {
          overlayCtx.beginPath();
          overlayCtx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, Math.PI * 2);
          overlayCtx.strokeStyle = tool === 'eraser' ? 'red' : '#10b981';
          overlayCtx.lineWidth = 2;
          overlayCtx.stroke();
      }
  }, [lassoPoints, mousePos, tool, brushSize]);

  // Логика рисования
  const handleInteract = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx || !canvasRef.current || !originalImg) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = (clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (clientY - rect.top) * (canvasRef.current.height / rect.height);
    
    setMousePos({x, y});

    if (tool === 'lasso') {
        if (e.type === 'mousedown' || e.type === 'touchstart') {
            if (lassoPoints.length > 2) {
                const start = lassoPoints[0];
                if (Math.hypot(x - start.x, y - start.y) < 20) {
                    applyLasso();
                    return;
                }
            }
            setLassoPoints(prev => [...prev, {x, y}]);
        }
        return;
    }

    if (e.type === 'mousedown' || e.type === 'touchstart') setIsDrawing(true);
    if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') setIsDrawing(false);

    if (isDrawing || e.type === 'mousedown') {
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x, y); ctx.stroke();
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(originalImg, 0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.restore();
        }
    }
  };

  const applyLasso = () => {
      if (!ctx || !canvasRef.current || !originalImg) return;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      setLassoPoints([]);
      setTool('eraser');
  };

  const handleSave = () => {
      canvasRef.current?.toBlob(blob => blob && onSave(blob), 'image/png');
  };

  return (
    <div className="flex flex-col h-full w-full gap-4 relative bg-zinc-950">
      
      {/* Тулбар (Плавающий снизу или сверху) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-zinc-900/90 backdrop-blur border border-zinc-800 p-2 rounded-full shadow-2xl flex items-center gap-2">
        {onAutoRemove && (
            <Button 
                size="icon" 
                variant="ghost" 
                className="rounded-full text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 w-10 h-10"
                onClick={onAutoRemove}
                disabled={isProcessing}
                title="Авто-удаление (AI)"
            >
                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20}/>}
            </Button>
        )}
        
        <div className="w-px h-6 bg-zinc-700 mx-1"/>

        <Button 
            size="icon" variant={tool === 'lasso' ? "default" : "ghost"} 
            className={`rounded-full w-10 h-10 ${tool === 'lasso' ? 'bg-blue-600' : 'text-zinc-400'}`}
            onClick={() => setTool('lasso')}
            title="Лассо"
        >
            <Scissors size={20}/>
        </Button>
        
        <Button 
            size="icon" variant={tool === 'eraser' ? "default" : "ghost"} 
            className={`rounded-full w-10 h-10 ${tool === 'eraser' ? 'bg-red-600' : 'text-zinc-400'}`}
            onClick={() => setTool('eraser')}
            title="Ластик"
        >
            <Eraser size={20}/>
        </Button>

        <Button 
            size="icon" variant={tool === 'restore' ? "default" : "ghost"} 
            className={`rounded-full w-10 h-10 ${tool === 'restore' ? 'bg-green-600' : 'text-zinc-400'}`}
            onClick={() => setTool('restore')}
            title="Кисть (Восстановить)"
        >
            <RotateCcw size={20}/>
        </Button>
      </div>

      {/* Настройки кисти (Слева) */}
      {tool !== 'lasso' && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-zinc-900/80 backdrop-blur border border-zinc-800 p-4 rounded-xl shadow-xl flex flex-col items-center gap-4 h-48">
              <span className="text-[10px] text-zinc-500 font-bold uppercase rotate-180" style={{writingMode: 'vertical-rl'}}>Размер</span>
              <Slider 
                  orientation="vertical" 
                  min={5} max={100} step={1} 
                  value={[brushSize]} 
                  onValueChange={(v) => setBrushSize(v[0])} 
                  className="h-full"
              />
          </div>
      )}

      {/* Канвас */}
      <div className="flex-1 bg-[url('/transparent-bg.png')] bg-repeat rounded-xl overflow-hidden relative flex items-center justify-center cursor-none touch-none select-none border border-zinc-800/50">
        <div className="absolute inset-0 bg-zinc-900/50 pointer-events-none" /> {/* Затемнение фона */}
        
        <div className="relative z-10 shadow-2xl">
            <canvas ref={canvasRef} className="max-w-full max-h-full block" />
            <canvas 
                ref={overlayRef}
                className="absolute inset-0 w-full h-full cursor-none"
                onMouseDown={handleInteract}
                onMouseMove={handleInteract}
                onMouseUp={handleInteract}
                onMouseLeave={(e) => { setIsDrawing(false); setMousePos(null); handleInteract(e); }}
                onTouchStart={handleInteract}
                onTouchMove={handleInteract}
                onTouchEnd={handleInteract}
            />
        </div>
      </div>

      {/* Кнопки действий (Снизу справа) */}
      <div className="absolute bottom-6 right-6 z-20 flex gap-3">
          <Button variant="outline" className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white" onClick={onCancel}>
              Отмена
          </Button>
          <Button className="bg-white text-black hover:bg-zinc-200 font-bold px-6 shadow-lg shadow-white/10" onClick={handleSave}>
              Далее <Check size={18} className="ml-2"/>
          </Button>
      </div>

      {tool === 'lasso' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-900/80 text-blue-100 px-4 py-2 rounded-full text-xs pointer-events-none backdrop-blur-sm border border-blue-500/30">
              Обведите объект и кликните в начало для вырезания
          </div>
      )}
    </div>
  );
}