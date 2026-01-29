import os
import random
from moviepy.editor import (
    VideoFileClip, TextClip, ImageClip, CompositeVideoClip, 
    ColorClip, vfx, afx
)
from moviepy.video.fx.all import crop, resize
from typing import List, Dict, Any
import numpy as np

# Путь для сохранения временных файлов
TEMP_DIR = "uploads/temp_render"
os.makedirs(TEMP_DIR, exist_ok=True)

class VideoEditorService:
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.clips = []
        self.final_clip = None

    def _apply_ken_burns(self, clip, duration, zoom_factor=1.3):
        """
        Эффект плавного приближения (Zoom In) для статичных изображений.
        """
        # Лямбда функция: в момент t=0 масштаб 1, в конце масштаб zoom_factor
        return clip.resize(lambda t: 1 + (zoom_factor - 1) * t / duration)

    def _apply_filters(self, clip, filters: Dict[str, Any]):
        """
        Применение цветокоррекции и эффектов.
        """
        if not filters:
            return clip

        # Яркость (Brightness): 1.0 = оригинал
        if "brightness" in filters and filters["brightness"] != 1.0:
            clip = clip.fx(vfx.colorx, filters["brightness"])
        
        # Контраст (Contrast): 1.0 = оригинал (в MoviePy vfx.lum_contrast немного сложнее, используем упрощенный вариант через colorx/gamma если нужно, 
        # но лучше lum_contrast если работает стабильно. Для простоты пока оставим только яркость, т.к. lum_contrast требует настройки порогов)
        
        # Черно-белый
        if filters.get("grayscale"):
            clip = clip.fx(vfx.blackwhite)

        # Фейд (появление/затухание)
        if filters.get("fadein"):
            clip = clip.fx(vfx.fadein, filters["fadein"])
        if filters.get("fadeout"):
            clip = clip.fx(vfx.fadeout, filters["fadeout"])

        return clip

    def process_project(self, project_data: Dict[str, Any]):
        try:
            # 1. Загружаем основное видео (Фон)
            base_path = project_data.get("base_video")
            if not os.path.exists(base_path):
                raise FileNotFoundError(f"Base video not found: {base_path}")
            
            # --- БАЗОВЫЙ СЛОЙ ---
            video = VideoFileClip(base_path)

            # Обрезка (Trim)
            trim = project_data.get("trim")
            if trim:
                video = video.subclip(trim.get("start", 0), trim.get("end", video.duration))

            # Кроп и Ресайз (например, под TikTok 9:16)
            output_format = project_data.get("format", "original") # original, 9:16, 1:1
            target_w, target_h = video.w, video.h

            if output_format == "9:16":
                # Логика: кропаем центр, потом ресайзим
                target_ratio = 9 / 16
                current_ratio = video.w / video.h
                
                if current_ratio > target_ratio: # Видео слишком широкое
                    new_w = int(video.h * target_ratio)
                    video = video.crop(x1=video.w/2 - new_w/2, width=new_w, height=video.h)
                else: # Видео слишком высокое
                    new_h = int(video.w / target_ratio)
                    video = video.crop(y1=video.h/2 - new_h/2, width=video.w, height=new_h)
                
                # Финальный размер (например 1080p для TikTok)
                # video = video.resize(height=1920) 
            
            # Применяем фильтры к базе
            video = self._apply_filters(video, project_data.get("filters", {}))
            
            self.clips.append(video) 

            # --- СЛОИ (Текст, Стикеры) ---
            layers = project_data.get("layers", [])
            for layer in layers:
                clip = None
                
                # ТЕКСТ
                if layer["type"] == "text":
                    # Используем дефолтный шрифт, если Arial не найден
                    font = "Arial" if "Arial" in TextClip.list('font') else "DejaVu-Sans-Bold"
                    clip = TextClip(
                        layer["content"], 
                        fontsize=layer.get("fontsize", 50), 
                        color=layer.get("color", "white"),
                        font=font,
                        stroke_color="black", 
                        stroke_width=2
                    )
                
                # ИЗОБРАЖЕНИЕ / СТИКЕР
                elif layer["type"] == "image":
                    img_path = layer["path"]
                    if os.path.exists(img_path):
                        clip = ImageClip(img_path)
                        
                        # Ken Burns (Анимация движения)
                        if layer.get("animation") == "zoom_in":
                            clip = self._apply_ken_burns(clip, duration=layer["duration"])

                if clip:
                    # Длительность и старт
                    layer_dur = layer.get("duration", 3)
                    clip = clip.set_start(layer["start"]).set_duration(layer_dur)
                    
                    # Ресайз слоя
                    if "scale" in layer:
                        clip = clip.resize(layer["scale"])
                    elif "width" in layer:
                        clip = clip.resize(width=layer["width"])

                    # Позиционирование
                    pos = layer.get("pos", "center")
                    if isinstance(pos, dict):
                        # Конвертируем относительные (x,y) в абсолютные или используем как есть
                        clip = clip.set_position((pos.get("x", "center"), pos.get("y", "center")))
                    else:
                        clip = clip.set_position(pos)
                    
                    # Фильтры слоя
                    clip = self._apply_filters(clip, layer.get("filters", {}))

                    self.clips.append(clip)

            # 5. Сборка (Compositing)
            # Используем размер первого клипа (базы) как размер холста
            self.final_clip = CompositeVideoClip(self.clips, size=video.size)
            self.final_clip.duration = video.duration

            # 6. Рендеринг
            # audio_codec='aac' обязателен для совместимости с iOS/Web
            self.final_clip.write_videofile(
                self.output_path, 
                codec="libx264", 
                audio_codec="aac", 
                fps=24,
                preset="medium", # ultrafast для тестов, medium для продакшена
                threads=4
            )
            
            return True

        except Exception as e:
            print(f"Rendering error: {e}")
            raise e
        finally:
            self.close()

    def close(self):
        if self.final_clip:
            self.final_clip.close()
        for clip in self.clips:
            try: clip.close()
            except: pass