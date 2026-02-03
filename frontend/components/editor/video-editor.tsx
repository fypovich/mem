"use client";

import React, { useRef, useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Play, Pause, Volume2, VolumeX, Scissors, Crop, Type, 
  Wand2, Music, Download, Loader2, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoEditorProps {
  videoUrl: string;
  isProcessing: boolean;
  onProcess: (options: any, audioFile?: File) => void;
}

export function VideoEditor({ videoUrl, isProcessing, onProcess }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Tools State
  const [activeTool, setActiveTool] = useState<"trim" | "crop" | "text" | "audio" | "filter">("trim");
  
  // 1. Trim
  const [trimRange, setTrimRange] = useState([0, 100]); // % от длительности
  
  // 2. Crop (упрощенно - квадрат по центру для примера, можно развить)
  const [isCropping, setIsCropping] = useState(false);
  
  // 3. Audio
  const [removeAudio, setRemoveAudio] = useState(false);
  const [newAudio, setNewAudio] = useState<File | null>(null);
  
  // 4. Text
  const [text, setText] = useState("");
  const [textSize, setTextSize] = useState(40);
  const [textColor, setTextColor] = useState("#ffffff");
  
  // 5. Filters
  const [filter, setFilter] = useState("No Filter");

  // Управление видео
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const updateTime = () => setCurrentTime(vid.currentTime);
    const updateDuration = () => setDuration(vid.duration);
    
    vid.addEventListener("timeupdate", updateTime);
    vid.addEventListener("loadedmetadata", updateDuration);
    
    return () => {
      vid.removeEventListener("timeupdate", updateTime);
      vid.removeEventListener("loadedmetadata", updateDuration);
    };
  }, []);

  // Loop preview в пределах trim
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !duration) return;

    const start = (trimRange[0] / 100) * duration;
    const end = (trimRange[1] / 100) * duration;

    if (vid.currentTime > end) {
      vid.currentTime = start;
    }
    if (vid.currentTime < start) {
       vid.currentTime = start;
    }
  }, [currentTime, trimRange, duration]);

  const togglePlay = () => {
    if (videoRef.current?.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const handleProcess = () => {
    const options = {
        trim_start: (trimRange[0] / 100) * duration,
        trim_end: (trimRange[1] / 100) * duration,
        crop: isCropping ? { x: 0, y: 0, width: 720, height: 720 } : null, // Пример кропа
        remove_audio: removeAudio,
        text_config: text ? { text, size: textSize, color: textColor, x: 0.5, y: 0.8 } : null,
        filter_name: filter
    };
    onProcess(options, newAudio || undefined);
  };

  // CSS фильтры для превью
  const getFilterStyle = () => {
    switch (filter) {
        case "Black & White": return { filter: "grayscale(100%)" };
        case "Rainbow": return { filter: "saturate(200%)" };
        case "Rumble": return { filter: "hue-rotate(90deg)" }; // Симуляция
        case "VHS": return { filter: "contrast(1.4) sepia(0.3)" };
        case "Groovy": return { filter: "invert(100%)" };
        default: return {};
    }
  };

  return (
    <div className="flex h-full w-full gap-6 p-6 box-border overflow-hidden bg-zinc-950">
        {/* LEFT: Video Preview */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 h-full relative">
            <div className="flex-1 relative overflow-hidden rounded-xl border border-zinc-800 bg-[#121212] flex items-center justify-center shadow-2xl">
                <div className="relative max-h-full max-w-full aspect-video">
                    <video 
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-contain"
                        loop
                        muted={removeAudio}
                        style={getFilterStyle()}
                        onClick={togglePlay}
                    />
                    
                    {/* Text Overlay Preview */}
                    {text && (
                        <div 
                            className="absolute left-1/2 -translate-x-1/2 text-center font-bold pointer-events-none drop-shadow-md whitespace-nowrap"
                            style={{ 
                                bottom: "20%", 
                                fontSize: `${textSize}px`, 
                                color: textColor,
                                textShadow: "2px 2px 0 #000"
                            }}
                        >
                            {text}
                        </div>
                    )}

                    {/* Controls Overlay */}
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                            <Play className="w-16 h-16 text-white/80" fill="currentColor" />
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline (Trim) */}
            <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex items-center gap-4 shrink-0">
                <Button variant="ghost" size="icon" onClick={togglePlay}>
                    {isPlaying ? <Pause /> : <Play />}
                </Button>
                <div className="flex-1 relative">
                    <Slider 
                        value={trimRange} 
                        onValueChange={setTrimRange} 
                        min={0} max={100} step={1} 
                        className="cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1 uppercase font-mono">
                        <span>Start</span>
                        <span>End</span>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT: Tools Panel */}
        <div className="w-80 flex flex-col bg-[#18181b] rounded-xl border border-zinc-800 shadow-xl h-full flex-shrink-0 overflow-hidden">
             <div className="p-6 border-b border-zinc-800 shrink-0">
                <h3 className="text-xl font-bold text-white mb-1">Video Editor</h3>
                <p className="text-sm text-zinc-400">Edit, trim & style</p>
             </div>

             <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                
                {/* 1. Dimensions (Crop) */}
                <div className="space-y-3">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Crop size={14}/> 1. Dimensions
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                        <Button 
                            variant={!isCropping ? "secondary" : "outline"} 
                            className="text-xs"
                            onClick={() => setIsCropping(false)}
                        >
                            Original
                        </Button>
                        <Button 
                            variant={isCropping ? "secondary" : "outline"} 
                            className="text-xs"
                            onClick={() => setIsCropping(true)}
                        >
                            Square (1:1)
                        </Button>
                    </div>
                </div>

                <div className="h-px bg-zinc-800/50 w-full" />

                {/* 2. Audio */}
                <div className="space-y-3">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Volume2 size={14}/> 2. Audio
                    </Label>
                    <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                        <span className="text-sm text-zinc-300">Mute Original</span>
                        <Switch checked={removeAudio} onCheckedChange={setRemoveAudio} />
                    </div>
                    <div className="relative">
                         <Input 
                            type="file" 
                            accept="audio/*" 
                            className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10"
                            onChange={(e) => setNewAudio(e.target.files?.[0] || null)}
                         />
                         <Button variant="outline" className="w-full justify-start text-zinc-400 border-dashed">
                             <Music size={16} className="mr-2"/> 
                             {newAudio ? newAudio.name : "Replace Audio (Upload MP3)"}
                         </Button>
                    </div>
                </div>

                <div className="h-px bg-zinc-800/50 w-full" />

                {/* 3. Text */}
                <div className="space-y-3">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Type size={14}/> 3. Overlay Text
                    </Label>
                    <Input 
                        placeholder="Type something..." 
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="bg-zinc-900 border-zinc-700"
                    />
                    <div className="flex gap-2">
                        <input 
                            type="color" 
                            value={textColor} 
                            onChange={(e) => setTextColor(e.target.value)}
                            className="h-9 w-9 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden"
                        />
                         <Slider value={[textSize]} onValueChange={v => setTextSize(v[0])} min={20} max={100} step={1} className="flex-1" />
                    </div>
                </div>

                <div className="h-px bg-zinc-800/50 w-full" />

                {/* 4. Filters */}
                <div className="space-y-3">
                    <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Wand2 size={14}/> 4. Filters
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                        {["No Filter", "Black & White", "Rainbow", "Rumble", "VHS", "Groovy"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                    filter === f 
                                    ? "bg-purple-600 border-purple-500 text-white" 
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
             </div>

             {/* Footer */}
             <div className="p-6 border-t border-zinc-800 bg-zinc-900 shrink-0">
                <Button 
                    onClick={handleProcess} 
                    disabled={isProcessing} 
                    className="w-full h-14 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg transition-all"
                >
                    {isProcessing ? <Loader2 className="animate-spin mr-2"/> : <Download className="mr-2" size={20}/>}
                    Process Video
                </Button>
             </div>
        </div>
    </div>
  );
}