"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ChevronLeft, Download, Check, Film } from "lucide-react";
import { toast } from "sonner";
import { uploadVideo, processVideo, VideoProcessOptions } from "@/lib/api/editor";
import { checkStatus, getFullUrl } from "@/lib/api/editor"; 
// --- ИСПРАВЛЕНИЕ: Импорт по умолчанию ---
import VideoEditor from "@/components/editor/video-editor"; 
import { useRouter } from "next/navigation";

export default function VideoEditorPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "editor" | "result">("upload");
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. UPLOAD
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    
    const file = e.target.files[0];
    setIsProcessing(true);
    
    try {
        const data = await uploadVideo(file);
        setServerPath(data.file_path);
        setVideoUrl(getFullUrl(data.url)); 
        setStep("editor");
    } catch (err) {
        toast.error("Failed to upload video");
    } finally {
        setIsProcessing(false);
    }
  };

  // 2. PROCESS
  const handleProcessVideo = async (options: VideoProcessOptions) => {
    if (!serverPath) return;
    
    setIsProcessing(true);
    const toastId = toast.loading("Processing video... This may take a while.");
    
    try {
        const { task_id } = await processVideo(serverPath, options);
        
        // Polling status
        const interval = setInterval(async () => {
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(interval);
                    setFinalResult(getFullUrl(status.result.url));
                    setStep("result");
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.success("Video processed!");
                } else if (status.status === "FAILURE") {
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Processing failed on server");
                }
            } catch (e) {
                // ignore polling errors
            }
        }, 2000); 
        
    } catch (e) {
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Failed to start processing");
    }
  };

  // --- RENDER ---

  if (step === "upload") {
    return (
        <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col items-center justify-center bg-zinc-950 p-4">
             <div className="text-center animate-in zoom-in-95">
                <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 shadow-xl">
                    {isProcessing ? <Loader2 className="animate-spin h-12 w-12 text-zinc-500" /> : <Film className="h-12 w-12 text-zinc-500" />}
                </div>
                <h1 className="mb-2 text-3xl font-bold text-white">Video Editor</h1>
                <p className="mb-8 text-zinc-400">Upload a video to trim, crop & filter</p>
                <Button size="lg" disabled={isProcessing} className="relative cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 py-6 text-lg transition-all hover:scale-105">
                    <input type="file" accept="video/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="mr-2 h-5 w-5" /> {isProcessing ? "Uploading..." : "Select Video"}
                </Button>
            </div>
        </div>
    );
  }

  if (step === "result" && finalResult) {
      return (
          <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col items-center justify-center bg-zinc-950 p-4">
               <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center max-w-2xl w-full animate-in zoom-in-95">
                   <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                       <Check className="text-green-500" size={32}/>
                   </div>
                   <h2 className="text-2xl font-bold text-white mb-6">Video Ready!</h2>
                   
                   <div className="rounded-xl overflow-hidden mb-8 border border-zinc-800 bg-black aspect-video relative">
                        <video src={finalResult} controls className="w-full h-full" />
                   </div>

                   <div className="flex gap-3">
                       <Button className="flex-1 h-12 text-base font-semibold bg-white text-black hover:bg-zinc-200 rounded-xl" onClick={() => window.open(finalResult, "_blank")}>
                           <Download className="mr-2 h-4 w-4"/> Download
                       </Button>
                       <Button variant="outline" className="h-12 border-zinc-700 hover:bg-zinc-800 text-white rounded-xl" onClick={() => { setStep("upload"); setVideoUrl(null); }}>
                           Edit Another
                       </Button>
                   </div>
               </div>
          </div>
      );
  }

  return (
    <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col bg-zinc-950 overflow-hidden text-white">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-zinc-900 bg-zinc-950 shrink-0 z-30">
            <Button variant="ghost" size="icon" onClick={() => setStep("upload")} className="text-zinc-400 hover:text-white">
                <ChevronLeft className="h-6 w-6" />
            </Button>
            <span className="font-bold text-lg tracking-tight text-white">Video Studio</span>
            <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0 relative bg-zinc-950">
            {videoUrl && (
                <VideoEditor 
                    videoUrl={videoUrl}
                    isProcessing={isProcessing}
                    onProcess={handleProcessVideo}
                />
            )}
        </div>
    </div>
  );
}