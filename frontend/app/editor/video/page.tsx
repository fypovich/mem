"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ChevronLeft, Download, Check, Film, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { uploadVideo, processVideo } from "@/lib/api/editor";
import { checkStatus, getFullUrl } from "@/lib/api/editor";
import type { VideoProcessOptions } from "@/types/editor";
import VideoEditor from "@/components/editor/video-editor";
import { useRouter, useSearchParams } from "next/navigation";
import { getEditorSource, setEditorResult } from "@/lib/editor-bridge";

const MAX_POLL_ATTEMPTS = 300; // 5 минут при 2с интервале = 10 минут

function VideoEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUpload = searchParams.get('from') === 'upload';

  const [step, setStep] = useState<"upload" | "editor" | "result">("upload");

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [serverPath, setServerPath] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Polling ref для cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Загрузить файл из upload page
  useEffect(() => {
    if (fromUpload) {
      const source = getEditorSource();
      if (source) {
        setServerPath(source.serverPath);
        setVideoUrl(source.url);
        setStep("editor");
      }
    }
  }, [fromUpload]);

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
        toast.error("Ошибка загрузки видео");
    } finally {
        setIsProcessing(false);
    }
  };

  // 2. PROCESS
  const handleProcessVideo = async (options: VideoProcessOptions) => {
    if (!serverPath) return;

    setIsProcessing(true);
    const toastId = toast.loading("Обработка видео... Это может занять некоторое время.");

    try {
        const { task_id } = await processVideo(serverPath, options);

        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        let attempts = 0;

        pollIntervalRef.current = setInterval(async () => {
            attempts++;
            if (attempts > MAX_POLL_ATTEMPTS) {
                clearInterval(pollIntervalRef.current!);
                pollIntervalRef.current = null;
                setIsProcessing(false);
                toast.dismiss(toastId);
                toast.error("Таймаут: обработка заняла слишком много времени");
                return;
            }
            try {
                const status = await checkStatus(task_id);
                if (status.status === "SUCCESS") {
                    clearInterval(pollIntervalRef.current!);
                    pollIntervalRef.current = null;
                    setFinalResult(getFullUrl(status.result.url));
                    setStep("result");
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.success("Видео обработано!");
                } else if (status.status === "FAILURE") {
                    clearInterval(pollIntervalRef.current!);
                    pollIntervalRef.current = null;
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    toast.error("Ошибка обработки на сервере");
                }
            } catch (e) {
                // ignore polling errors
            }
        }, 2000);

    } catch (e) {
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.error("Не удалось начать обработку");
    }
  };

  // Использовать в мем
  const handleUseInUpload = () => {
    if (!finalResult) return;
    setEditorResult({
      url: finalResult,
      mediaType: 'video',
      fileName: 'edited_video.mp4',
    });
    router.push('/upload');
  };

  // --- RENDER ---

  if (step === "upload") {
    return (
        <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col items-center justify-center bg-background p-4">
             <div className="text-center animate-in zoom-in-95">
                <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-card border border-border shadow-xl">
                    {isProcessing ? <Loader2 className="animate-spin h-12 w-12 text-muted-foreground" /> : <Film className="h-12 w-12 text-muted-foreground" />}
                </div>
                <h1 className="mb-2 text-3xl font-bold text-foreground">Редактор видео</h1>
                <p className="mb-8 text-muted-foreground">Загрузите видео для редактирования</p>
                <Button size="lg" disabled={isProcessing} className="relative cursor-pointer bg-primary hover:bg-primary/90 text-foreground rounded-full px-10 py-6 text-lg transition-all hover:scale-105">
                    <input type="file" accept="video/*" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="mr-2 h-5 w-5" /> {isProcessing ? "Загрузка..." : "Выбрать видео"}
                </Button>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex flex-col bg-background overflow-hidden text-foreground animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border bg-background shrink-0 z-30">
            <Button variant="ghost" size="icon" onClick={() => fromUpload ? router.push('/upload') : setStep("upload")} className="text-muted-foreground hover:text-foreground h-8 w-8">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-base tracking-tight text-foreground">Редактор видео</span>
            <div className="w-8"></div>
        </div>

        {/* Editor — always mounted to preserve state */}
        <div className="flex-1 min-h-0 relative bg-background">
            {videoUrl && (
                <VideoEditor
                    videoUrl={videoUrl}
                    isProcessing={isProcessing}
                    onProcess={handleProcessVideo}
                />
            )}
            {isProcessing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin h-10 w-10 text-primary" />
                    <p className="text-lg font-semibold text-foreground">Обработка видео...</p>
                    <p className="text-sm text-muted-foreground">Это может занять некоторое время</p>
                </div>
            )}
        </div>

        {/* Result overlay — shown on top, editor stays mounted underneath */}
        {step === "result" && finalResult && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md p-4">
                <div className="bg-card border border-border p-8 rounded-3xl shadow-2xl text-center max-w-2xl w-full animate-in zoom-in-95">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                        <Check className="text-green-500" size={32}/>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-6">Готово!</h2>

                    <div className="rounded-xl overflow-hidden mb-8 border border-border bg-black aspect-video relative">
                        <video src={finalResult} controls className="w-full h-full" />
                    </div>

                    <div className="flex gap-3">
                        {fromUpload && (
                            <Button className="flex-1 h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-foreground rounded-xl" onClick={handleUseInUpload}>
                                <ArrowUpFromLine className="mr-2 h-4 w-4"/> Использовать
                            </Button>
                        )}
                        <Button className={`${fromUpload ? '' : 'flex-1'} h-12 text-base font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl`} onClick={() => window.open(finalResult, "_blank")}>
                            <Download className="mr-2 h-4 w-4"/> Скачать
                        </Button>
                        <Button variant="outline" className="h-12 border-input hover:bg-accent text-foreground rounded-xl" onClick={() => { setFinalResult(null); setStep("editor"); }}>
                            Заново
                        </Button>
                    </div>
                    <button
                        className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setStep("upload"); setVideoUrl(null); setServerPath(null); setFinalResult(null); }}
                    >
                        Загрузить другое видео
                    </button>
                </div>
            </div>
        )}
    </div>
  );
}

export default function VideoEditorPage() {
  return (
    <Suspense fallback={<div className="fixed top-14 bottom-0 left-0 md:left-64 right-0 z-10 flex items-center justify-center bg-background"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>}>
      <VideoEditorInner />
    </Suspense>
  );
}
