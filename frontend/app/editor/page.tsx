"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Layers, Scissors, Play } from "lucide-react";
import { startRender, checkTaskStatus, uploadTempFile } from "@/lib/api/editor";
import { Layer } from "@/types/editor";
// ИСПОЛЬЗУЕМ SONNER
import { toast } from "sonner";

export default function EditorPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [serverBaseVideoPath, setServerBaseVideoPath] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [layers, setLayers] = useState<Layer[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(file));
      
      setIsUploading(true);
      try {
        const data = await uploadTempFile(file);
        setServerBaseVideoPath(data.server_path);
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
    const newLayer: Layer = {
      id: Date.now().toString(),
      type: "text",
      content: "Текст",
      start: 0,
      duration: 3,
      pos: { x: "center", y: "center" },
      fontsize: 50,
      color: "white"
    };
    setLayers([...layers, newLayer]);
  };

  const handleRender = async () => {
    if (!serverBaseVideoPath) {
        toast.error("Ошибка", { description: "Видео еще не загрузилось на сервер" });
        return;
    }
    
    setIsProcessing(true);
    setFinalVideoUrl(null);

    try {
        const projectData = {
            base_video: serverBaseVideoPath,
            layers: layers
        };

        const data = await startRender(projectData);
        toast.info("Рендеринг начат", { description: "Подождите..." });
        
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

  return (
    <div className="container mx-auto p-4 flex flex-col lg:flex-row gap-6 h-[calc(100vh-80px)]">
      {/* ИНСТРУМЕНТЫ */}
      <Card className="w-full lg:w-1/4 p-4 space-y-6 overflow-y-auto">
        <h2 className="text-xl font-bold">Редактор</h2>
        
        <div className="space-y-4">
          <div>
            <Label>Исходник</Label>
            <Input 
              ref={fileInputRef} 
              type="file" 
              accept="video/*,image/*" 
              onChange={handleFileChange} 
              className="mt-2"
              disabled={isUploading || isProcessing}
            />
            {isUploading && <p className="text-xs text-muted-foreground mt-1 animate-pulse">Загрузка на сервер...</p>}
          </div>

          <div className="space-y-2">
            <Label>Слои</Label>
            <Button onClick={addTextLayer} variant="outline" className="w-full flex gap-2">
              <Layers size={16} /> Добавить Текст
            </Button>
            <Button variant="outline" className="w-full flex gap-2" disabled>
              <Scissors size={16} /> Удалить фон (AI) <span className="text-xs text-muted-foreground">(Скоро)</span>
            </Button>
          </div>

          {layers.length > 0 && (
            <div className="border rounded p-2 space-y-2">
              <p className="text-sm font-semibold">Слои:</p>
              {layers.map((l) => (
                <div key={l.id} className="bg-secondary p-2 rounded text-xs flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span>{l.type === 'text' ? 'Текст' : 'Изображение'}</span>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0 text-red-500"
                        onClick={() => setLayers(layers.filter(layer => layer.id !== l.id))}
                    >
                        ✕
                    </Button>
                  </div>
                  <Input 
                      className="h-7 text-xs" 
                      value={l.content} 
                      onChange={(e) => {
                          const val = e.target.value;
                          setLayers(layers.map(layer => layer.id === l.id ? {...layer, content: val} : layer));
                      }}
                  />
                  <div className="flex gap-2 items-center">
                    <Label className="text-[10px]">Start:</Label>
                    <Input 
                        type="number" 
                        className="h-6 w-12 text-xs"
                        value={l.start}
                        onChange={(e) => setLayers(layers.map(layer => layer.id === l.id ? {...layer, start: Number(e.target.value)} : layer))}
                    />
                    <Label className="text-[10px]">Dur:</Label>
                    <Input 
                        type="number" 
                        className="h-6 w-12 text-xs"
                        value={l.duration}
                        onChange={(e) => setLayers(layers.map(layer => layer.id === l.id ? {...layer, duration: Number(e.target.value)} : layer))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button 
            onClick={handleRender} 
            disabled={!serverBaseVideoPath || isUploading || isProcessing} 
            className="w-full"
        >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />} 
            Рендерить
        </Button>
      </Card>

      {/* ПРЕВЬЮ */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black/5 rounded-lg border-2 border-dashed relative overflow-hidden">
        {finalVideoUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <video src={finalVideoUrl} controls className="max-h-[80%] max-w-full shadow-lg rounded-lg" autoPlay loop />
                <Button className="mt-4" variant="secondary" onClick={() => setFinalVideoUrl(null)}>
                    Назад к редактированию
                </Button>
            </div>
        ) : !previewUrl ? (
          <div className="text-center text-muted-foreground">
            <Upload className="mx-auto h-12 w-12 mb-2 opacity-50" />
            <p>Загрузите видео</p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
             <video src={previewUrl} controls className="max-h-full max-w-full" />
             
             {/* Оверлей для предпросмотра слоев (упрощенный) */}
             <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                {layers.map(layer => (
                    layer.type === 'text' && (
                        <div key={layer.id} style={{
                            fontSize: `${layer.fontsize}px`,
                            color: layer.color,
                            fontWeight: 'bold',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            whiteSpace: 'nowrap'
                        }}>
                            {layer.content}
                        </div>
                    )
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}