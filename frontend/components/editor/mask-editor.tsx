"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, RotateCcw, Check, Scissors, MousePointer2, Wand2 } from "lucide-react";

interface MaskEditorProps {
  originalUrl: string; // Исходник (всегда нужен для восстановления)
  initialMaskedUrl?: string; // Если мы пришли после "Авто-удаления"
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function MaskEditor({ originalUrl, initialMaskedUrl, onSave, onCancel }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  
  // Режимы: 
  // 'manual' - ластик/восстановление
  // 'lasso' - выделение полигоном
  const [tool, setTool] = useState<'eraser' | 'restore' | 'lasso'>('lasso');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Для Лассо
  const [lassoPoints, setLassoPoints] = useState<{x: number, y: number}[]>([]);

  // 1. Инициализация и загрузка
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    setCtx(context);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = originalUrl;
    img.onload = () => {
      setOriginalImg(img);
      
      // Настраиваем размер канваса
      const maxW = 800;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      // Если есть результат AI - рисуем его. Если нет - рисуем оригинал (пользователь сам вырежет)
      if (initialMaskedUrl) {
          const imgMasked = new Image();
          imgMasked.crossOrigin = "anonymous";
          imgMasked.src = initialMaskedUrl;
          imgMasked.onload = () => {
              context.clearRect(0, 0, canvas.width, canvas.height);
              context.drawImage(imgMasked, 0, 0, canvas.width, canvas.height);
          }
      } else {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
  }, [originalUrl, initialMaskedUrl]);

  // 2. Отрисовка интерфейса Лассо (линии)
  useEffect(() => {
    if (!ctx || !canvasRef.current || tool !== 'lasso') return;
    
    // Перерисовка происходит при изменении точек, но мы не хотим стирать основной контент.
    // В идеале нужен второй слой canvas для UI, но для простоты будем рисовать поверх
    // и надеяться на лучшее (или перерисовывать imageData).
    // Упрощение: мы рисуем точки просто как HTML элементы поверх канваса в render()
  }, [lassoPoints, tool, ctx]);

  // 3. Обработка действий мыши
  const handleInteract = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx || !canvasRef.current || !originalImg) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (tool === 'lasso') {
        if (e.type === 'mousedown' || e.type === 'touchstart') {
            setLassoPoints([...lassoPoints, {x, y}]);
        }
        return;
    }

    // Логика Кисти (Eraser / Restore)
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
            // Рисуем оригинал только в зоне кисти
            ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }
    }
  };

  // Применение Лассо (Вырезать)
  const applyLasso = () => {
      if (!ctx || !canvasRef.current || !originalImg || lassoPoints.length < 3) return;
      const canvas = canvasRef.current;

      // 1. Очищаем всё
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 2. Создаем путь из точек
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      
      // 3. Клипаем и рисуем оригинал ВНУТРИ пути
      ctx.save();
      ctx.clip();
      ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 4. Сбрасываем точки
      setLassoPoints([]);
      // Переключаемся на ластик для доработки
      setTool('eraser');
  };

  const handleSave = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  return (
    <div className="flex flex-col h-full w-full gap-4 relative">
      {/* Тулбар */}
      <div className="flex flex-wrap items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 gap-4">
        
        <div className="flex gap-2 bg-black/50 p-1 rounded-lg">
            <Button 
                size="sm" variant={tool === 'lasso' ? "default" : "ghost"}
                onClick={() => setTool('lasso')}
                title="Выделение"
            >
                <Scissors size={18} className="mr-2"/> Вырезать
            </Button>
            <Button 
                size="sm" variant={tool === 'eraser' ? "default" : "ghost"}
                onClick={() => setTool('eraser')}
                title="Стереть"
            >
                <Eraser size={18} />
            </Button>
            <Button 
                size="sm" variant={tool === 'restore' ? "default" : "ghost"}
                onClick={() => setTool('restore')}
                title="Восстановить"
            >
                <RotateCcw size={18} />
            </Button>
        </div>

        {tool !== 'lasso' && (
             <div className="flex items-center gap-3 w-40">
                <span className="text-[10px] uppercase text-zinc-500 font-bold">Brush</span>
                <Slider 
                    min={5} max={100} step={1} 
                    value={[brushSize]} 
                    onValueChange={(v) => setBrushSize(v[0])}
                    className="flex-1"
                />
            </div>
        )}

        {tool === 'lasso' && lassoPoints.length > 2 && (
             <Button size="sm" onClick={applyLasso} className="bg-blue-600 hover:bg-blue-700 animate-pulse">
                Применить обрезку
             </Button>
        )}

        <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
            <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <Check size={18} className="mr-2"/> Готово
            </Button>
        </div>
      </div>

      {/* Канвас */}
      <div className="flex-1 bg-zinc-800/50 rounded-xl border border-zinc-800 overflow-hidden relative flex items-center justify-center cursor-crosshair touch-none select-none">
        <div className="absolute inset-0 opacity-30 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
        />
        
        <div className="relative">
            <canvas
                ref={canvasRef}
                onMouseDown={handleInteract}
                onMouseMove={handleInteract}
                onMouseUp={handleInteract}
                onMouseLeave={() => setIsDrawing(false)}
                onTouchStart={handleInteract}
                onTouchMove={handleInteract}
                onTouchEnd={handleInteract}
                className="max-w-full max-h-full shadow-2xl border border-white/5"
            />
            
            {/* Оверлей точек лассо */}
            {tool === 'lasso' && lassoPoints.map((p, i) => (
                <div 
                    key={i}
                    className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white -ml-1.5 -mt-1.5 pointer-events-none"
                    style={{ 
                        left: (p.x / (canvasRef.current?.width || 1)) * 100 + '%', 
                        top: (p.y / (canvasRef.current?.height || 1)) * 100 + '%' 
                        // Примечание: это упрощенное позиционирование для CSS, 
                        // точнее было бы рисовать линии на отдельном canvas слое
                    }}
                />
            ))}
        </div>
      </div>
      
      {tool === 'lasso' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md border border-white/10 pointer-events-none">
              Кликайте вокруг объекта. Нажмите "Применить обрезку", когда замкнете контур.
          </div>
      )}
    </div>
  );
}