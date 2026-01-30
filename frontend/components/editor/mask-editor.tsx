"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, RotateCcw, Check, Scissors, AlertCircle } from "lucide-react";

interface MaskEditorProps {
  originalUrl: string; 
  initialMaskedUrl?: string; 
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function MaskEditor({ originalUrl, initialMaskedUrl, onSave, onCancel }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // Слой для интерфейса (линий лассо)
  
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [overlayCtx, setOverlayCtx] = useState<CanvasRenderingContext2D | null>(null);
  
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  
  const [tool, setTool] = useState<'eraser' | 'restore' | 'lasso'>('lasso');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);

  // 1. Инициализация
  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;

    const context = canvasRef.current.getContext('2d', { willReadFrequently: true });
    const ovCtx = overlayRef.current.getContext('2d');
    
    setCtx(context);
    setOverlayCtx(ovCtx);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = originalUrl;
    img.onload = () => {
      setOriginalImg(img);
      
      const maxW = 800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = img.width * scale;
      const h = img.height * scale;

      [canvasRef.current, overlayRef.current].forEach(c => {
          if (c) { c.width = w; c.height = h; }
      });

      if (initialMaskedUrl && context) {
          const imgMasked = new Image();
          imgMasked.crossOrigin = "anonymous";
          imgMasked.src = initialMaskedUrl;
          imgMasked.onload = () => {
              context.clearRect(0, 0, w, h);
              context.drawImage(imgMasked, 0, 0, w, h);
          }
      } else if (context) {
          context.drawImage(img, 0, 0, w, h);
      }
    };
  }, [originalUrl, initialMaskedUrl]);

  // 2. Отрисовка Лассо (UI слой)
  useEffect(() => {
      if (!overlayCtx || !overlayRef.current) return;
      const w = overlayRef.current.width;
      const h = overlayRef.current.height;
      
      // Очищаем оверлей
      overlayCtx.clearRect(0, 0, w, h);

      if (tool === 'lasso' && lassoPoints.length > 0) {
          overlayCtx.beginPath();
          overlayCtx.lineWidth = 2;
          overlayCtx.strokeStyle = '#3b82f6'; // Blue
          overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Blue transparent

          // Рисуем линии между точками
          overlayCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
          for (let i = 1; i < lassoPoints.length; i++) {
              overlayCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
          }

          // Рисуем линию к курсору (предпросмотр)
          if (mousePos) {
              overlayCtx.lineTo(mousePos.x, mousePos.y);
          }
          
          overlayCtx.stroke();
          
          // Рисуем точки
          lassoPoints.forEach(p => {
              overlayCtx.beginPath();
              overlayCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
              overlayCtx.fillStyle = 'white';
              overlayCtx.fill();
              overlayCtx.stroke();
          });
      }
      
      // Рисуем курсор кисти
      if (tool !== 'lasso' && mousePos) {
          overlayCtx.beginPath();
          overlayCtx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, Math.PI * 2);
          overlayCtx.strokeStyle = tool === 'eraser' ? 'red' : 'green';
          overlayCtx.lineWidth = 2;
          overlayCtx.stroke();
      }

  }, [lassoPoints, mousePos, tool, brushSize]);

  // 3. Обработка мыши
  const handleInteract = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx || !canvasRef.current || !originalImg) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setMousePos({x, y});

    if (tool === 'lasso') {
        if (e.type === 'mousedown' || e.type === 'touchstart') {
            // Если кликнули близко к первой точке - замыкаем
            if (lassoPoints.length > 2) {
                const start = lassoPoints[0];
                const dist = Math.sqrt(Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2));
                if (dist < 15) {
                    applyLasso();
                    return;
                }
            }
            setLassoPoints([...lassoPoints, {x, y}]);
        }
        return;
    }

    // Кисть
    if (e.type === 'mousedown' || e.type === 'touchstart') setIsDrawing(true);
    if (e.type === 'mouseup' || e.type === 'touchend' || e.type === 'mouseleave') setIsDrawing(false);

    if (isDrawing || (e.type === 'mousedown' || e.type === 'touchstart')) {
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (tool === 'restore') {
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
      if (!ctx || !canvasRef.current || !originalImg || lassoPoints.length < 3) return;
      
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;

      // Создаем маску пути
      ctx.globalCompositeOperation = 'destination-in'; // Оставляем только то, что внутри
      
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fill();

      // Восстанавливаем режим рисования
      ctx.globalCompositeOperation = 'source-over';
      
      setLassoPoints([]);
      setTool('eraser'); // Переключаем на ластик для мелких правок
  };

  const handleSave = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  return (
    <div className="flex flex-col h-full w-full gap-4 relative">
      <div className="flex flex-wrap items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 gap-4">
        
        <div className="flex gap-1 bg-black/50 p-1 rounded-lg">
            <Button size="sm" variant={tool === 'lasso' ? "default" : "ghost"} onClick={() => setTool('lasso')}>
                <Scissors size={18} className="mr-2"/> Лассо
            </Button>
            <Button size="sm" variant={tool === 'eraser' ? "default" : "ghost"} onClick={() => setTool('eraser')}>
                <Eraser size={18} />
            </Button>
            <Button size="sm" variant={tool === 'restore' ? "default" : "ghost"} onClick={() => setTool('restore')}>
                <RotateCcw size={18} />
            </Button>
        </div>

        {tool !== 'lasso' && (
             <div className="flex items-center gap-2 w-32">
                <Slider min={5} max={100} step={1} value={[brushSize]} onValueChange={(v) => setBrushSize(v[0])} />
            </div>
        )}

        <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onCancel}>Назад</Button>
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Check size={18} className="mr-2"/> Готово
            </Button>
        </div>
      </div>
      
      {tool === 'lasso' && (
          <div className="bg-blue-900/30 border border-blue-500/30 text-blue-200 text-xs px-4 py-2 rounded-lg flex items-center">
              <AlertCircle size={14} className="mr-2"/>
              Кликайте по контуру объекта. Чтобы завершить, кликните в начальную точку.
          </div>
      )}

      <div className="flex-1 bg-zinc-800/50 rounded-xl border border-zinc-800 overflow-hidden relative flex items-center justify-center cursor-crosshair touch-none select-none">
        <div className="absolute inset-0 opacity-30 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
        />
        
        <div className="relative">
            {/* Основной канвас с картинкой */}
            <canvas ref={canvasRef} className="max-w-full max-h-full shadow-2xl" />
            
            {/* Слой интерфейса (линии, курсор) - он должен быть точно поверх */}
            <canvas 
                ref={overlayRef}
                onMouseDown={handleInteract}
                onMouseMove={handleInteract}
                onMouseUp={handleInteract}
                onMouseLeave={(e) => { setIsDrawing(false); setMousePos(null); handleInteract(e); }}
                onTouchStart={handleInteract}
                onTouchMove={handleInteract}
                onTouchEnd={handleInteract}
                className="absolute inset-0 w-full h-full"
            />
        </div>
      </div>
    </div>
  );
}