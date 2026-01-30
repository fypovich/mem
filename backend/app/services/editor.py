import os
from moviepy.editor import (
    VideoFileClip, TextClip, ImageClip, CompositeVideoClip, vfx
)
from typing import List, Dict, Any

class VideoEditorService:
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.clips = []
        self.final_clip = None

    def _calculate_pos(self, pos_data, video_w, video_h, item_w, item_h):
        """
        Конвертирует проценты в координаты для MoviePy.
        MoviePy ожидает top-left координаты (x, y) в пикселях.
        Фронтенд присылает проценты (0-100).
        """
        if not isinstance(pos_data, dict):
            return "center"
        
        # Получаем координаты X, Y в пикселях
        x_px = (pos_data.get('x', 0) / 100.0) * video_w
        y_px = (pos_data.get('y', 0) / 100.0) * video_h
        
        return (x_px, y_px)

    def process_project(self, project_data: Dict[str, Any]):
        try:
            base_path = project_data.get("base_video")
            if not os.path.exists(base_path): raise FileNotFoundError("Base video missing")
            
            # 1. Base Video
            video = VideoFileClip(base_path)
            
            # Формат (TikTok Crop)
            target_w, target_h = video.w, video.h
            if project_data.get("format") == "9:16":
                # Логика кропа 9:16
                current_ratio = video.w / video.h
                target_ratio = 9 / 16
                if current_ratio > target_ratio:
                    new_w = int(video.h * target_ratio)
                    video = video.crop(x1=video.w/2 - new_w/2, width=new_w, height=video.h)
                target_w, target_h = video.w, video.h

            # Обрезка времени
            trim = project_data.get("trim", {})
            start_t = trim.get("start", 0)
            end_t = trim.get("end", video.duration)
            video = video.subclip(start_t, end_t)
            
            self.clips.append(video)

            # 2. Layers
            layers = project_data.get("layers", [])
            for layer in layers:
                clip = None
                
                # --- TEXT ---
                if layer["type"] == "text":
                    # Эвристика размера шрифта:
                    # Фронтенд передает width слоя в процентах.
                    # Мы примерно мапим это на fontsize.
                    # Это сложное место, так как размер текста зависит от длины строки.
                    # Попробуем использовать fontsize из данных, но масштабировать его.
                    
                    base_fontsize = layer.get("fontsize", 50)
                    # Скейлим шрифт относительно разрешения видео (база 1080p)
                    scaled_fontsize = int(base_fontsize * (target_h / 1000.0))

                    clip = TextClip(
                        layer["content"], 
                        fontsize=scaled_fontsize, 
                        color=layer.get("color", "white"),
                        font="Arial",
                        method='caption', # Позволяет авто-перенос строки
                        size=(int(target_w * (layer.get('width', 80) / 100)), None) # Ограничиваем ширину
                    )
                
                # --- IMAGE ---
                elif layer["type"] == "image":
                    path = layer.get("path")
                    if path and os.path.exists(path):
                        clip = ImageClip(path)
                        # Ресайз
                        width_percent = layer.get("width", 30)
                        target_layer_w = target_w * (width_percent / 100.0)
                        clip = clip.resize(width=target_layer_w)

                if clip:
                    # Тайминг
                    clip = clip.set_start(layer["start"]).set_duration(layer["duration"])
                    
                    # Позиция
                    # Для MoviePy позиция - это левый верхний угол.
                    # Rnd тоже дает левый верхний угол.
                    pos = {
                        'x': layer.get('x', 0), 
                        'y': layer.get('y', 0)
                    }
                    final_pos = self._calculate_pos(pos, target_w, target_h, clip.w, clip.h)
                    clip = clip.set_position(final_pos)
                    
                    # Эффекты
                    filters = layer.get("filters", {})
                    if filters.get("opacity"):
                        clip = clip.set_opacity(filters["opacity"])
                    
                    self.clips.append(clip)

            # 3. Composite
            self.final_clip = CompositeVideoClip(self.clips, size=(target_w, target_h))
            self.final_clip.duration = video.duration

            # 4. Write
            self.final_clip.write_videofile(
                self.output_path, 
                codec="libx264", 
                audio_codec="aac", 
                fps=24,
                threads=4,
                logger=None
            )
            return True

        except Exception as e:
            print(f"Render Error: {e}")
            raise e
        finally:
            self.close()

    def close(self):
        if self.final_clip: self.final_clip.close()
        for c in self.clips: 
            try: c.close()
            except: pass