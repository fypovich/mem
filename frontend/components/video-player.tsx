"use client";

import { MediaPlayer, MediaProvider, Gesture, MuteButton, TimeSlider, Time } from "@vidstack/react";
import { Play, Volume2, VolumeX } from "lucide-react";

import "@vidstack/react/player/styles/base.css";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  hasAudio?: boolean;
  loop?: boolean;
}

type VideoMime = "video/mp4" | "video/webm" | "video/ogg";

function getMimeType(url: string): VideoMime {
  const ext = url.split(".").pop()?.toLowerCase();
  const map: Record<string, VideoMime> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/mp4",
    ogg: "video/ogg",
  };
  return map[ext || ""] || "video/mp4";
}

export function VideoPlayer({
  src,
  poster,
  title,
  hasAudio = true,
  loop = true,
}: VideoPlayerProps) {
  return (
    <MediaPlayer
      src={{ src, type: getMimeType(src) }}
      poster={poster || ""}
      playsInline
      autoPlay
      muted={!hasAudio}
      loop={loop}
      title={title || ""}
      className="vds-video-player overflow-hidden w-full max-h-[60vh] group relative"
    >
      <MediaProvider />

      {/* Клик по видео — play/pause */}
      <Gesture className="absolute inset-0 z-10" event="pointerup" action="toggle:paused" />

      {/* Большая кнопка Play по центру (видна на паузе) */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-0 group-data-[paused]:opacity-100 transition-opacity duration-300">
        <div className="bg-black/40 backdrop-blur-sm rounded-full p-5">
          <Play className="w-10 h-10 text-white fill-white ml-1" />
        </div>
      </div>

      {/* Кнопка звука — правый верхний угол */}
      {hasAudio && (
        <MuteButton
          className="group/mute absolute top-3 right-3 z-30 bg-black/50 hover:bg-black/70 rounded-full p-2 text-white transition-colors cursor-pointer"
          title="Звук"
        >
          <Volume2 className="w-5 h-5 group-data-[muted]/mute:hidden" />
          <VolumeX className="w-5 h-5 hidden group-data-[muted]/mute:block" />
        </MuteButton>
      )}

      {/* Timeline — по нижнему краю видео */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <TimeSlider.Root className="group/slider relative w-full cursor-pointer">
          {/* Время: текущее / общее — видно при наведении на таймлайн */}
          <div className="absolute -top-5 right-1 flex items-center gap-1 text-[11px] text-white/80 font-medium opacity-0 group-hover/slider:opacity-100 group-data-[dragging]/slider:opacity-100 transition-opacity select-none pointer-events-none [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
            <Time className="tabular-nums" type="current" />
            <span>/</span>
            <Time className="tabular-nums" type="duration" />
          </div>

          {/* Тултип при наведении на точку таймлайна */}
          <TimeSlider.Preview
            className="absolute -top-9 pointer-events-none -translate-x-1/2 opacity-0 group-hover/slider:opacity-100 group-data-[dragging]/slider:opacity-100 transition-opacity"
            style={{ left: "var(--slider-pointer)" }}
          >
            <TimeSlider.Value
              type="pointer"
              className="bg-black/80 text-white text-xs px-2 py-1 rounded tabular-nums"
            />
          </TimeSlider.Preview>

          {/* Полоса прогресса */}
          <TimeSlider.Track className="relative h-[3px] group-hover/slider:h-[5px] transition-[height] bg-white/25">
            <TimeSlider.Progress
              className="absolute h-full left-0 bg-white/40"
              style={{ width: "var(--slider-progress, 0%)" }}
            />
            <TimeSlider.TrackFill
              className="absolute h-full left-0 bg-white"
              style={{ width: "var(--slider-fill, 0%)" }}
            />
          </TimeSlider.Track>

          {/* Ползунок */}
          <TimeSlider.Thumb
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0 group-hover/slider:w-3 group-hover/slider:h-3 bg-white rounded-full transition-all opacity-0 group-hover/slider:opacity-100"
            style={{ left: "var(--slider-fill)" }}
          />
        </TimeSlider.Root>
      </div>
    </MediaPlayer>
  );
}
