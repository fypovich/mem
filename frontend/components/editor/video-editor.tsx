"use client"

import React, { useState, useRef, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Crop, Type, Video, Wand2, Download, Upload, Play, Pause, Trash2 } from "lucide-react"
import { processVideoEditor } from "@/lib/api/editor" // Убедитесь, что этот импорт правильный
import { toast } from "sonner"
import type { VideoProcessOptions, CropOptions, TextOptions } from "@/types/editor"

// --- CSS Filters Mapping for Preview ---
const FILTER_STYLES: Record<string, string> = {
  "No Filter": "none",
  "Black & White": "grayscale(100%)",
  "Sepia": "sepia(100%)",
  "Vintage": "sepia(50%) contrast(120%) brightness(90%)",
  "Blur": "blur(2px)",
  "Rainbow": "saturate(250%)", // approximate
  "VHS": "contrast(150%) brightness(110%) hue-rotate(-10deg)",
  "Groovy": "invert(100%)"
}

export default function VideoEditor() {
  // --- State ---
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  
  // Editor State
  const [activeTab, setActiveTab] = useState("edit")
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Options
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]) // Percent
  const [crop, setCrop] = useState<CropOptions | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  
  const [textConfig, setTextConfig] = useState<TextOptions>({
    text: "",
    size: 40,
    color: "#ffffff",
    x: 0.5,
    y: 0.8
  })
  
  const [filter, setFilter] = useState("No Filter")
  const [removeAudio, setRemoveAudio] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Dragging State
  const dragStartRef = useRef<{x: number, y: number} | null>(null)
  const cropStartRef = useRef<{x: number, y: number, w: number, h: number} | null>(null)
  const [interactionMode, setInteractionMode] = useState<'none' | 'text-drag' | 'crop-drag' | 'crop-resize'>('none')

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setVideoFile(file)
      setVideoUrl(URL.createObjectURL(file))
      setResultUrl(null)
      // Reset state
      setCrop(null)
      setTrimRange([0, 100])
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause()
      else videoRef.current.play()
      setIsPlaying(!isPlaying)
    }
  }

  // --- Interaction Logic (Crop & Text) ---

  const getRelativeCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      height: rect.height
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getRelativeCoords(e)
    const relX = coords.x / coords.width
    const relY = coords.y / coords.height

    // 1. Text Dragging Logic
    // Simple hit detection for text center (approximate)
    if (textConfig.text && !isCropping) {
        const dist = Math.sqrt(Math.pow(relX - textConfig.x, 2) + Math.pow(relY - textConfig.y, 2))
        if (dist < 0.1) { // Hit radius
            setInteractionMode('text-drag')
            return
        }
    }

    // 2. Crop Logic
    if (isCropping) {
        // If clicking inside existing crop -> Move
        // For simplicity, let's just implement "Draw new crop" on click-drag if clicking outside,
        // or just start resizing if we had handles. 
        // Let's implement: Click anywhere starts a new selection from that point
        setInteractionMode('crop-drag')
        dragStartRef.current = { x: coords.x, y: coords.y }
        setCrop({ x: coords.x, y: coords.y, width: 0, height: 0 })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (interactionMode === 'none') return
    const coords = getRelativeCoords(e)

    if (interactionMode === 'text-drag') {
        // Clamp to 0-1
        const x = Math.max(0, Math.min(1, coords.x / coords.width))
        const y = Math.max(0, Math.min(1, coords.y / coords.height))
        setTextConfig(prev => ({ ...prev, x, y }))
    }

    if (interactionMode === 'crop-drag' && dragStartRef.current) {
        const currentX = coords.x
        const currentY = coords.y
        const startX = dragStartRef.current.x
        const startY = dragStartRef.current.y

        // Calculate Box
        const minX = Math.min(startX, currentX)
        const minY = Math.min(startY, currentY)
        const width = Math.abs(currentX - startX)
        const height = Math.abs(currentY - startY)

        setCrop({ x: minX, y: minY, width, height })
    }
  }

  const handleMouseUp = () => {
    setInteractionMode('none')
    dragStartRef.current = null
  }

  // --- Processing ---

  const handleProcess = async () => {
    if (!videoFile || !videoRef.current) return
    setIsProcessing(true)
    
    // Calculate actual crop values relative to original video size
    // The visual crop is in CSS pixels of the container. 
    // We need to map it to the video intrinsic resolution.
    let finalCrop = undefined
    if (crop && containerRef.current && videoRef.current) {
        const videoRect = containerRef.current.getBoundingClientRect()
        const scaleX = videoRef.current.videoWidth / videoRect.width
        const scaleY = videoRef.current.videoHeight / videoRect.height
        
        finalCrop = {
            x: Math.round(crop.x * scaleX),
            y: Math.round(crop.y * scaleY),
            width: Math.round(crop.width * scaleX),
            height: Math.round(crop.height * scaleY)
        }
    }

    // Calculate Trim Time
    const start = (trimRange[0] / 100) * duration
    const end = (trimRange[1] / 100) * duration

    const options: VideoProcessOptions = {
      trim_start: start,
      trim_end: end,
      remove_audio: removeAudio,
      filter_name: filter === "No Filter" ? undefined : filter,
      text_config: textConfig.text ? textConfig : undefined,
      crop: finalCrop
    }

    try {
      const formData = new FormData()
      formData.append("video_path", "") // In a real app we might upload first, but here we assume direct upload logic 
      // NOTE: Our API expects direct file upload OR path. 
      // Let's use the endpoint /video/process which accepts 'video_path' (string) if already uploaded, 
      // OR we can change the API to accept file + options.
      // Assuming we use the method that handles file upload + processing:
      
      // Let's use the API helper
      const res = await processVideoEditor(videoFile, null, options)
      
      // Polling or waiting (Simulated here if sync, or task based)
      // If async task:
      if (res.task_id) {
         toast.success("Processing started...")
         // Here you would implement polling checkStatus(res.task_id)
         // For demo, let's pretend it's fast or user has to wait.
         // Wait loop implementation skipped for brevity
      } 
      // If sync result (from previous iteration):
      if (res.url) {
          setResultUrl(res.url)
          toast.success("Video processed!")
      }

    } catch (e) {
      toast.error("Failed to process video")
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  // --- Render ---

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
      
      {/* LEFT: Preview Area */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div 
            ref={containerRef}
            className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center aspect-video group select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain pointer-events-none" // Disable native video pointer events to handle drag
                style={{ filter: FILTER_STYLES[filter] || 'none' }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />
              
              {/* Text Overlay Layer */}
              {textConfig.text && !isCropping && (
                 <div
                    className="absolute cursor-move border-2 border-transparent hover:border-white/50 p-1 rounded"
                    style={{
                        left: `${textConfig.x * 100}%`,
                        top: `${textConfig.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${textConfig.size}px`,
                        color: textConfig.color,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        whiteSpace: 'nowrap'
                    }}
                 >
                    {textConfig.text}
                 </div>
              )}

              {/* Crop Overlay Layer */}
              {isCropping && (
                  <div className="absolute inset-0 bg-black/50 cursor-crosshair">
                      {crop && (
                          <div 
                            className="absolute border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                            style={{
                                left: crop.x,
                                top: crop.y,
                                width: crop.width,
                                height: crop.height
                            }}
                          >
                             {/* Resize handles could go here */}
                             <div className="absolute top-0 left-0 w-2 h-2 bg-white -translate-x-1/2 -translate-y-1/2" />
                             <div className="absolute bottom-0 right-0 w-2 h-2 bg-white translate-x-1/2 translate-y-1/2" />
                          </div>
                      )}
                  </div>
              )}

              {/* Controls Overlay (Play/Pause) */}
              <div className="absolute bottom-4 left-0 right-0 px-4 flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={togglePlay}>
                      {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
                  </Button>
                  <Slider 
                    value={[currentTime]} 
                    max={duration} 
                    step={0.1}
                    onValueChange={(v) => {
                        if(videoRef.current) {
                            videoRef.current.currentTime = v[0]
                            setCurrentTime(v[0])
                        }
                    }}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-white text-xs font-mono">
                      {currentTime.toFixed(1)} / {duration.toFixed(1)}s
                  </span>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center">
                <Video size={48} className="mb-4 opacity-50" />
                <p>Upload a video to start editing</p>
                <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                   <Upload className="mr-2 h-4 w-4" /> Select File
                </Button>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* RIGHT: Tools Panel */}
      <div className="flex flex-col h-full overflow-hidden">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="edit"><Crop size={16}/></TabsTrigger>
                <TabsTrigger value="filter"><Wand2 size={16}/></TabsTrigger>
                <TabsTrigger value="text"><Type size={16}/></TabsTrigger>
                <TabsTrigger value="export"><Download size={16}/></TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto p-4 border rounded-b-md">
                
                {/* 1. EDIT TAB */}
                <TabsContent value="edit" className="space-y-6 mt-0">
                    <div className="space-y-2">
                        <Label>Crop Video</Label>
                        <div className="flex items-center justify-between border p-3 rounded-lg">
                            <span className="text-sm">Enable Crop Tool</span>
                            <Switch checked={isCropping} onCheckedChange={(c) => {
                                setIsCropping(c)
                                if (c && !crop && containerRef.current) {
                                    // Default center crop
                                    const { width, height } = containerRef.current.getBoundingClientRect()
                                    setCrop({ x: width*0.1, y: height*0.1, width: width*0.8, height: height*0.8 })
                                }
                            }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                           {isCropping ? "Draw on the video preview to select area." : "Toggle to enable manual cropping."}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Label>Trim Duration</Label>
                        <Slider
                            value={trimRange}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={setTrimRange}
                            className="py-4"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground font-mono">
                            <span>Start: {((trimRange[0]/100)*duration).toFixed(1)}s</span>
                            <span>End: {((trimRange[1]/100)*duration).toFixed(1)}s</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Audio</Label>
                        <div className="flex items-center space-x-2">
                            <Switch id="mute" checked={removeAudio} onCheckedChange={setRemoveAudio} />
                            <Label htmlFor="mute" className="font-normal">Remove Audio</Label>
                        </div>
                    </div>
                </TabsContent>

                {/* 2. FILTER TAB */}
                <TabsContent value="filter" className="mt-0">
                    <div className="grid grid-cols-2 gap-3">
                        {Object.keys(FILTER_STYLES).map((f) => (
                            <Button
                                key={f}
                                variant={filter === f ? "default" : "outline"}
                                className="h-20 flex flex-col gap-2 relative overflow-hidden"
                                onClick={() => setFilter(f)}
                            >
                                <span className="z-10">{f}</span>
                                {/* Mini Preview Background - optional optimization */}
                                <div 
                                    className="absolute inset-0 opacity-20 bg-gradient-to-br from-gray-500 to-black"
                                    style={{ filter: FILTER_STYLES[f] }}
                                />
                            </Button>
                        ))}
                    </div>
                </TabsContent>

                {/* 3. TEXT TAB */}
                <TabsContent value="text" className="space-y-6 mt-0">
                    <div className="space-y-2">
                        <Label>Overlay Text</Label>
                        <Input 
                            placeholder="Enter text..." 
                            value={textConfig.text}
                            onChange={(e) => setTextConfig({...textConfig, text: e.target.value})}
                        />
                    </div>
                    {textConfig.text && (
                        <>
                            <div className="space-y-2">
                                <Label>Font Size: {textConfig.size}px</Label>
                                <Slider 
                                    value={[textConfig.size]} 
                                    min={10} max={100} step={1}
                                    onValueChange={(v) => setTextConfig({...textConfig, size: v[0]})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00'].map(c => (
                                        <button
                                            key={c}
                                            className={`w-8 h-8 rounded-full border-2 ${textConfig.color === c ? 'border-primary' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setTextConfig({...textConfig, color: c})}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                Tip: Drag the text on the preview video to position it!
                            </div>
                        </>
                    )}
                </TabsContent>

                {/* 4. EXPORT TAB */}
                <TabsContent value="export" className="space-y-6 mt-0">
                    <div className="text-sm text-muted-foreground">
                        Ready to process? This will create a new video file with your edits.
                    </div>
                    <Button 
                        className="w-full" 
                        size="lg" 
                        onClick={handleProcess} 
                        disabled={!videoFile || isProcessing}
                    >
                        {isProcessing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Processing...</>
                        ) : (
                            <><Wand2 className="mr-2 h-4 w-4"/> Process Video</>
                        )}
                    </Button>

                    {resultUrl && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
                            <p className="text-green-600 font-medium flex items-center gap-2">
                                <span className="bg-green-500 rounded-full p-1"><Play size={10} className="text-white"/></span>
                                Success!
                            </p>
                            <video src={resultUrl} controls className="w-full rounded bg-black max-h-40" />
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => window.open(resultUrl, '_blank')}>
                                    <Download className="mr-2 h-4 w-4"/> Download
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </div>
         </Tabs>
      </div>
    </div>
  )
}