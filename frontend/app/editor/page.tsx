"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Upload, Layers, Scissors, Play, 
  Trash2, Wand2, Settings2, Image as ImageIcon, Type 
} from "lucide-react";
import { startRender, checkTaskStatus, uploadTempFile, uploadForBgRemoval } from "@/lib/api/editor";
import { Layer, ProjectData } from "@/types/editor";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EditorPage() {
  // --- STATE ---
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [serverBaseVideoPath, setServerBaseVideoPath] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  
  // Глобальные настройки проекта
  const [projectSettings, setProjectSettings] = useState<{
    format: 'original' | '9:16';
    trimStart: number;
    trimEnd: number;
  }>({
    format: 'original',
    trimStart: 0,
    trimEnd: 0
  });

  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(file));
      
      // Сброс состояния
      setLayers([]);
      setSelectedLayerId(null);
      
      setIsUploading(true);
      try {
        const data = await uploadTempFile(file);
        setServerBaseVideoPath(data.server_path);
        // Пытаемся угадать длительность (в реальном проекте лучше метаданные с сервера)
        setProjectSettings(p => ({ ...p, trimEnd: 10 })); 
        toast.success("Файл загружен", { description: "Готов к обработке" });
      } catch (error) {
        console.error(error);
        toast.error("Ошибка загрузки", { description: "Не удалось загрузить файл на сервер" });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const addTextLayer = () => {
    const newId = Date.now().toString();
    const newLayer: Layer = {
      id: newId,
      type: "text",
      content: "Текст",
      start: 0,
      duration: 3,
      pos: { x: "center", y: "center" },
      fontsize: 50,
      color: "white",
      filters: { brightness: 1.0 }
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newId);
  };

  const addStickerLayer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading("Обработка AI...");
      
      try {
        // Загружаем и удаляем фон сразу
        const data = await uploadForBgRemoval(file, true);
        
        // Нам нужно подождать результат (в реальном проекте нужен поллинг, 
        // но для MVP предположим, что result_url валиден или мы ждем)
        // Примечание: API remove-bg возвращает task_id. 
        // В рамках MVP упростим: используем просто uploadTempFile для картинки,
        // а удаление фона добавим позже как опцию.
        
        const tempData = await uploadTempFile(file); // Пока просто грузим картинку

        const newId = Date.now().toString();
        const newLayer: Layer = {
          id: newId,
          type: "image",
          path: tempData.server_path, // Путь на сервере
          content: "Sticker", // Для отображения в списке
          start: 0,
          duration: 3,
          pos: { x: "center", y: "center" },
          width: 300,
          filters: { brightness: 1.0 },
          animation: 'none'
        };
        setLayers([...layers, newLayer]);
        setSelectedLayerId(newId);
        toast.dismiss(toastId);
        toast.success("Стикер добавлен");

      } catch (error) {
        toast.error("Ошибка добавления стикера");
      }
    }
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const removeLayer = (id: string) => {
    setLayers(layers.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const handleRender = async () => {
    if (!serverBaseVideoPath) {
        toast.error("Ошибка", { description: "Видео еще не загрузилось на сервер" });
        return;
    }
    
    setIsProcessing(true);
    setFinalVideoUrl(null);

    try {
        const projectData: ProjectData = {
            base_video: serverBaseVideoPath,
            format: projectSettings.format,
            trim: {
                start: projectSettings.trimStart,
                end: projectSettings.trimEnd || undefined
            },
            layers: layers
        };

        const data = await startRender(projectData);
        toast.info("Рендеринг начат", { description: "Это может занять время..." });
        
        pollStatus(data.task_id);
    } catch (e) {
        console.error(e);
        setIsProcessing(false);
        toast.error("Ошибка", { description: "Не удалось запустить рендер" });
    }
  };

  const pollStatus = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await checkTaskStatus(taskId);
        
        if (status.status === "SUCCESS") {
          clearInterval(interval);
          setIsProcessing(false);
          setFinalVideoUrl(status.result);
          toast.success("Готово!", { description: "Видео обработано успешно" });
        } else if (status.status === "FAILURE") {
          clearInterval(interval);
          setIsProcessing(false);
          toast.error("Ошибка", { description: "Ошибка при обработке видео" });
        }
      } catch (e) {
          clearInterval(interval);
          setIsProcessing(false);
      }
    }, 2000);
  };

  // --- RENDER HELPERS ---
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  return (
    <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-4 h-[calc(100vh-80px)]">
      
      {/* 1. ЛЕВАЯ КОЛОНКА: СЛОИ */}
      <Card className="w-full lg:w-1/5 p-4 flex flex-col gap-4">
        <h2 className="font-bold flex items-center gap-2"><Layers size={18}/> Слои</h2>
        
        <div className="flex gap-2">
            <Button size="sm" onClick={addTextLayer} variant="outline" className="flex-1">
                <Type size={16} className="mr-1"/> Текст
            </Button>
            <div className="relative flex-1">
                <Button size="sm" variant="outline" className="w-full">
                    <ImageIcon size={16} className="mr-1"/> Фото
                </Button>
                <Input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={addStickerLayer}
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 border rounded-md p-2 bg-secondary/10">
            {layers.length === 0 && <p className="text-xs text-muted-foreground text-center mt-4">Нет слоев</p>}
            {layers.map((l, index) => (
                <div 
                    key={l.id} 
                    onClick={() => setSelectedLayerId(l.id)}
                    className={`
                        p-2 rounded text-sm flex justify-between items-center cursor-pointer border
                        ${selectedLayerId === l.id ? 'bg-primary/10 border-primary' : 'bg-card border-transparent hover:bg-accent'}
                    `}
                >
                    <span className="truncate max-w-[120px] font-medium">
                        {l.type === 'text' ? l.content : `Img ${index + 1}`}
                    </span>
                    <Button 
                        variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }}
                    >
                        <Trash2 size={14} />
                    </Button>
                </div>
            ))}
        </div>

        <div className="pt-2 border-t">
            <Label className="text-xs text-muted-foreground mb-1 block">Исходник:</Label>
            <div className="flex items-center gap-2">
                <Input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileChange} 
                    className="text-xs h-8"
                    disabled={isUploading || isProcessing}
                />
            </div>
        </div>
      </Card>

      {/* 2. ЦЕНТР: ПРЕВЬЮ */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg border relative overflow-hidden">
        {finalVideoUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-background">
                <video src={finalVideoUrl} controls className="max-h-[80%] max-w-full shadow-lg rounded-lg" autoPlay loop />
                <Button className="mt-4" onClick={() => setFinalVideoUrl(null)}>Назад к редактированию</Button>
            </div>
        ) : !previewUrl ? (
          <div className="text-center text-muted-foreground">
            <Upload className="mx-auto h-16 w-16 mb-4 opacity-20" />
            <p>Загрузите видео (mp4)</p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center bg-zinc-900">
             {/* Видео плеер */}
             <video src={previewUrl} className="max-h-full max-w-full" controls={false} />
             
             {/* Визуализация слоев (упрощенная) */}
             <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {layers.map(layer => (
                    <div 
                        key={layer.id} 
                        style={{
                            position: 'absolute',
                            left: layer.pos.x === 'center' ? '50%' : `${layer.pos.x}px`,
                            top: layer.pos.y === 'center' ? '50%' : `${layer.pos.y}px`,
                            transform: 'translate(-50%, -50%)',
                            border: selectedLayerId === layer.id ? '2px dashed #3b82f6' : 'none',
                            padding: '4px'
                        }}
                    >
                        {layer.type === 'text' ? (
                            <span style={{ 
                                fontSize: `${layer.fontsize}px`, 
                                color: layer.color,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                                fontWeight: 'bold'
                            }}>
                                {layer.content}
                            </span>
                        ) : (
                            <div className="bg-white/20 w-32 h-32 flex items-center justify-center border rounded">
                                <span className="text-xs text-white">Sticker</span>
                            </div>
                        )}
                    </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* 3. ПРАВАЯ КОЛОНКА: СВОЙСТВА */}
      <Card className="w-full lg:w-1/4 p-4 space-y-6 overflow-y-auto">
        <h2 className="font-bold flex items-center gap-2"><Settings2 size={18}/> Настройки</h2>

        {selectedLayer ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="pb-2 border-b">
                    <h3 className="text-sm font-semibold mb-2">Общие</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Начало (сек)</Label>
                            <Input 
                                type="number" className="h-8" 
                                value={selectedLayer.start}
                                onChange={(e) => updateLayer(selectedLayer.id, { start: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Длит. (сек)</Label>
                            <Input 
                                type="number" className="h-8" 
                                value={selectedLayer.duration}
                                onChange={(e) => updateLayer(selectedLayer.id, { duration: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </div>

                {selectedLayer.type === 'text' && (
                    <div className="pb-2 border-b space-y-3">
                        <h3 className="text-sm font-semibold">Текст</h3>
                        <div>
                            <Label className="text-xs">Содержание</Label>
                            <Input 
                                value={selectedLayer.content} 
                                onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">Размер</Label>
                                <Input 
                                    type="number" className="h-8"
                                    value={selectedLayer.fontsize} 
                                    onChange={(e) => updateLayer(selectedLayer.id, { fontsize: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Цвет</Label>
                                <Input 
                                    type="color" className="h-8 p-1"
                                    value={selectedLayer.color} 
                                    onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {selectedLayer.type === 'image' && (
                    <div className="pb-2 border-b space-y-3">
                        <h3 className="text-sm font-semibold">Изображение</h3>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Ken Burns (Zoom)</Label>
                            <Button 
                                size="sm" 
                                variant={selectedLayer.animation === 'zoom_in' ? "default" : "outline"}
                                onClick={() => updateLayer(selectedLayer.id, { animation: selectedLayer.animation === 'zoom_in' ? 'none' : 'zoom_in' })}
                            >
                                {selectedLayer.animation === 'zoom_in' ? 'Вкл' : 'Выкл'}
                            </Button>
                        </div>
                        <div>
                            <Label className="text-xs">Размер (width)</Label>
                            <Slider 
                                defaultValue={[selectedLayer.width || 300]} max={1000} step={10}
                                onValueChange={(v) => updateLayer(selectedLayer.id, { width: v[0] })}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Фильтры</h3>
                    <div>
                        <Label className="text-xs">Яркость: {selectedLayer.filters?.brightness || 1}</Label>
                        <Slider 
                            defaultValue={[selectedLayer.filters?.brightness || 1]} 
                            min={0} max={2} step={0.1}
                            onValueChange={(v) => updateLayer(selectedLayer.id, { filters: { ...selectedLayer.filters, brightness: v[0] } })}
                        />
                    </div>
                </div>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="pb-2 border-b space-y-3">
                    <h3 className="text-sm font-semibold">Проект</h3>
                    <div>
                        <Label className="text-xs">Формат</Label>
                        <Select 
                            value={projectSettings.format} 
                            onValueChange={(v: any) => setProjectSettings({...projectSettings, format: v})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="original">Оригинал</SelectItem>
                                <SelectItem value="9:16">TikTok (9:16)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="pb-2 border-b space-y-3">
                    <h3 className="text-sm font-semibold">Обрезка (сек)</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-xs">Start</Label>
                            <Input 
                                type="number" className="h-8"
                                value={projectSettings.trimStart}
                                onChange={(e) => setProjectSettings({...projectSettings, trimStart: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">End</Label>
                            <Input 
                                type="number" className="h-8"
                                value={projectSettings.trimEnd}
                                onChange={(e) => setProjectSettings({...projectSettings, trimEnd: Number(e.target.value)})}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}

        <Button 
            onClick={handleRender} 
            disabled={!serverBaseVideoPath || isUploading || isProcessing} 
            className="w-full mt-auto"
            size="lg"
        >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />} 
            Создать Видео
        </Button>
      </Card>
    </div>
  );
}