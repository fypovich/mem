"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eraser, Pencil, Undo, Check } from "lucide-react";

interface MaskEditorProps {
  originalUrl: string; // Исходное фото (для восстановления)
  maskedUrl: string;   // Результат AI (для стирания)
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function MaskEditor({ originalUrl, maskedUrl, onSave, onCancel }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  
  // Исходное изображение (Image Object)
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  
  // Состояние инструментов
  const [mode, setMode] = useState<'erase' | 'restore'>('erase');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);

  // Инициализация
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    setCtx(context);

    // 1. Загружаем исходник (нужен для восстановления)
    const imgOrig = new Image();
    imgOrig.crossOrigin = "anonymous";
    imgOrig.src = originalUrl;
    imgOrig.onload = () => setOriginalImg(imgOrig);

    // 2. Загружаем маскированное изображение и рисуем его на канвас
    const imgMasked = new Image();
    imgMasked.crossOrigin = "anonymous";
    imgMasked.src = maskedUrl;
    imgMasked.onload = () => {
      // Устанавливаем размер канваса под картинку
      // Ограничиваем максимальный размер для производительности, сохраняя пропорции
      const maxW = 800;
      const scale = imgMasked.width > maxW ? maxW / imgMasked.width : 1;
      
      canvas.width = imgMasked.width * scale;
      canvas.height = imgMasked.height * scale;
      
      // Рисуем текущий результат удаления фона
      context.drawImage(imgMasked, 0, 0, canvas.width, canvas.height);
    };
  }, [maskedUrl, originalUrl]);

  // Рисование
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx || !canvasRef.current || !originalImg) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Координаты курсора
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'erase') {
      // Режим Ластика: просто делаем пиксели прозрачными
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(x, y); // Для одиночных кликов можно улучшить, но для движения stroke работает
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // Режим Восстановления (Magic):
      // Мы рисуем "Маску" (кисть), но внутрь этой маски помещаем пиксели из originalImg
      
      ctx.globalCompositeOperation = 'source-over';
      
      // Это сложная техника:
      // 1. Сохраняем текущее состояние
      ctx.save();
      // 2. Создаем путь кисти (круг)
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      // 3. Делаем этот круг зоной клиппинга (рисовать можно только внутри него)
      ctx.clip();
      // 4. Рисуем ОРИГИНАЛЬНОЕ изображение полностью. 
      // Но так как есть clip(), оно нарисуется только внутри круга кисти.
      // Важно нарисовать его точно в тех же координатах, что и фон.
      ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);
      // 5. Восстанавливаем контекст (убираем клиппинг)
      ctx.restore();
    }
  };

  const handleSave = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };

  return (
    <div className="flex flex-col h-full w-full gap-4">
      {/* Панель инструментов */}
      <div className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg border border-zinc-800">
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant={mode === 'erase' ? "default" : "secondary"}
            onClick={() => setMode('erase')}
            className={mode === 'erase' ? "bg-red-600 hover:bg-red-700" : ""}
          >
            <Eraser size={16} className="mr-2"/> Ластик
          </Button>
          <Button 
            size="sm" 
            variant={mode === 'restore' ? "default" : "secondary"}
            onClick={() => setMode('restore')}
            className={mode === 'restore' ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Pencil size={16} className="mr-2"/> Вернуть
          </Button>
        </div>

        <div className="flex items-center gap-2 w-40">
            <span className="text-xs text-zinc-400">Размер</span>
            <Slider 
                min={5} max={100} step={1} 
                value={[brushSize]} 
                onValueChange={(v) => setBrushSize(v[0])}
            />
        </div>

        <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>Отмена</Button>
            <Button size="sm" onClick={handleSave} className="bg-purple-600">
                <Check size={16} className="mr-2"/> Готово
            </Button>
        </div>
      </div>

      {/* Рабочая область */}
      <div className="flex-1 bg-zinc-800/50 rounded-xl border border-zinc-800 overflow-hidden relative flex items-center justify-center cursor-crosshair touch-none">
        {/* Шахматный фон */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
        />
        
        <canvas
            ref={canvasRef}
            onMouseDown={() => setIsDrawing(true)}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
            onMouseMove={draw}
            onTouchStart={() => setIsDrawing(true)}
            onTouchEnd={() => setIsDrawing(false)}
            onTouchMove={draw}
            className="max-w-full max-h-full shadow-2xl border border-white/10"
        />
      </div>
    </div>
  );
}