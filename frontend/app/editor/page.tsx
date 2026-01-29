"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Loader2, Upload, Play, Pause, Download, 
  Type, Image as ImageIcon, Settings2, Trash2, Scissors 
} from "lucide-react";
import { startRender, checkTaskStatus, uploadTempFile, uploadForBgRemoval } from "@/lib/api/editor";
import { Layer, ProjectData } from "@/types/editor";
import { toast } from "sonner";
import { Canvas } from "@/components/editor/canvas"; // Создайте этот файл (код выше)
import { Timeline } from "@/components/editor/timeline"; // Создайте этот файл (код выше)

export default function EditorPage() {
  // --- STATE ---
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [serverBaseVideoPath, setServerBaseVideoPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10); // Default duration
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- PLAYBACK LOGIC ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
        interval = setInterval(() => {
            if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
                if (videoRef.current.ended) setIsPlaying(false);
            }
        }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    if (videoRef.current) {
        if (isPlaying) videoRef.current.pause();
        else videoRef.current.play();
        setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
    }
  };

  // --- HANDLERS (File, Layers) ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(file));
      setIsUploading(true);
      try {
        const data = await uploadTempFile(file);
        setServerBaseVideoPath(data.server_path);
        // Загружаем метаданные видео, чтобы узнать длительность
        const vid = document.createElement('video');
        vid.src = URL.createObjectURL(file);
        vid.onloadedmetadata = () => setDuration(vid.duration);
        toast.success("Видео загружено");
      } catch (error) {
        toast.error("Ошибка загрузки");
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
      duration: 5,
      pos: { x: "center", y: "center" },
      fontsize: 60,
      color: "#ffffff",
      filters: { brightness: 1.0 }
    };
    setLayers([...layers, newLayer]);
    setSelectedLayerId(newId);
  };

  const addStickerLayer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const toastId = toast.loading("Удаляем фон...");
      
      try {
        // ВАЖНО: Тут мы ожидаем, что backend вернет URL сразу или мы используем локальный
        // Для MVP используем uploadForBgRemoval, который возвращает ID задачи.
        // Чтобы не усложнять, пока просто грузим файл.
        // В будущем: поллинг статуса удаления фона.
        const data = await uploadTempFile(file); 
        
        const newId = Date.now().toString();
        const newLayer: Layer = {
          id: newId,
          type: "image",
          path: data.server_path, 
          content: "Sticker",
          start: 0,
          duration: 5,
          pos: { x: "center", y: "center" },
          width: 200,
          filters: { brightness: 1.0 }
        };
        setLayers([...layers, newLayer]);
        setSelectedLayerId(newId);
        toast.dismiss(toastId);
        toast.success("Стикер добавлен");
      } catch (error) {
        toast.error("Ошибка");
      }
    }
  };

  // Обновление свойств слоя
  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  // --- RENDER ---
  const handleRender = async () => {
    if (!serverBaseVideoPath) return;
    setIsProcessing(true);
    try {
        const projectData: ProjectData = {
            base_video: serverBaseVideoPath,
            trim: { start: 0 }, // Пока без тримминга
            layers: layers,
            format: '9:16' // По умолчанию
        };
        const data = await startRender(projectData);
        toast.info("Рендеринг запущен...");
        
        // Polling (упрощенный)
        const interval = setInterval(async () => {
            const status = await checkTaskStatus(data.task_id);
            if (status.status === "SUCCESS") {
                clearInterval(interval);
                setIsProcessing(false);
                toast.success("Готово!", { 
                    action: { label: "Скачать", onClick: () => window.open(status.result, '_blank') } 
                });
            }
        }, 3000);
    } catch (e) {
        setIsProcessing(false);
    }
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-black text-white overflow-hidden">
      
      {/* HEADER TOOLS */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
        <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Studio</h1>
            <div className="h-6 w-px bg-zinc-800 mx-2"/>
            <Input 
                type="file" accept="video/*" 
                onChange={handleFileChange} 
                className="w-full max-w-[200px] h-8 text-xs bg-zinc-900 border-zinc-700"
            />
        </div>
        <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={addTextLayer}><Type size={16} className="mr-2"/> Текст</Button>
            <div className="relative">
                <Button size="sm" variant="ghost"><ImageIcon size={16} className="mr-2"/> Стикер</Button>
                <Input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={addStickerLayer}/>
            </div>
            <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700 text-white ml-4"
                onClick={handleRender}
                disabled={isProcessing || !serverBaseVideoPath}
            >
                {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Download className="mr-2" size={16}/>}
                Экспорт
            </Button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* CENTER: CANVAS */}
        <div className="flex-1 bg-zinc-900/50 flex flex-col relative">
            <Canvas 
                videoUrl={previewUrl}
                layers={layers}
                currentTime={currentTime}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onUpdatePosition={() => {}} // TODO
                videoRef={videoRef}
            />
            
            {/* Playback Controls Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/80 px-4 py-2 rounded-full border border-zinc-700 backdrop-blur-md">
                <button onClick={togglePlay} className="text-white hover:text-purple-400 transition">
                    {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                </button>
                <span className="text-xs font-mono text-zinc-400">
                    {currentTime.toFixed(1)} / {duration.toFixed(1)}s
                </span>
            </div>
        </div>

        {/* RIGHT: INSPECTOR */}
        {selectedLayer && (
            <div className="w-80 bg-zinc-950 border-l border-zinc-800 p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold flex items-center gap-2"><Settings2 size={16}/> Свойства</h3>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10" onClick={() => {
                        setLayers(layers.filter(l => l.id !== selectedLayer.id));
                        setSelectedLayerId(null);
                    }}>
                        <Trash2 size={16}/>
                    </Button>
                </div>

                <div className="space-y-6">
                    {selectedLayer.type === 'text' && (
                        <div className="space-y-3">
                            <Label>Текст</Label>
                            <Input 
                                value={selectedLayer.content} 
                                onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })}
                                className="bg-zinc-900 border-zinc-700"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs text-zinc-400">Размер</Label>
                                    <Input 
                                        type="number" className="bg-zinc-900 border-zinc-700"
                                        value={selectedLayer.fontsize}
                                        onChange={(e) => updateLayer(selectedLayer.id, { fontsize: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs text-zinc-400">Цвет</Label>
                                    <div className="flex gap-2 items-center h-10">
                                        <input 
                                            type="color" 
                                            value={selectedLayer.color}
                                            onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                                            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                                        />
                                        <span className="text-xs text-zinc-500 uppercase">{selectedLayer.color}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedLayer.type === 'image' && (
                        <div className="space-y-3">
                            <Label>Изображение</Label>
                            <div className="flex items-center justify-between bg-zinc-900 p-2 rounded border border-zinc-800">
                                <span className="text-sm">Удалить фон (AI)</span>
                                <Button size="sm" variant="ghost" onClick={() => toast.info("Функция в разработке")}><Scissors size={14}/></Button>
                            </div>
                            <div>
                                <Label className="text-xs text-zinc-400 mb-2 block">Размер</Label>
                                <Slider 
                                    defaultValue={[selectedLayer.width || 200]} max={800} step={10}
                                    onValueChange={(v) => updateLayer(selectedLayer.id, { width: v[0] })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-zinc-800 space-y-3">
                        <Label>Эффекты</Label>
                        <div>
                            <Label className="text-xs text-zinc-400 mb-2 block">Яркость</Label>
                            <Slider 
                                defaultValue={[selectedLayer.filters?.brightness || 1]} min={0} max={2} step={0.1}
                                onValueChange={(v) => updateLayer(selectedLayer.id, { filters: { ...selectedLayer.filters, brightness: v[0] } })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* BOTTOM: TIMELINE */}
      <Timeline 
        layers={layers}
        duration={duration}
        currentTime={currentTime}
        onSeek={handleSeek}
        onLayerUpdate={() => {}} // Реализовать драг дорожек
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
      />
    </div>
  );
}