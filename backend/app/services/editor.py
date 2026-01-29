import os
from moviepy.editor import VideoFileClip, TextClip, ImageClip, CompositeVideoClip, ColorClip, vfx
from typing import List, Dict, Any
import uuid

# Путь для сохранения временных файлов
TEMP_DIR = "uploads/temp_render"
os.makedirs(TEMP_DIR, exist_ok=True)

class VideoEditorService:
    def __init__(self, output_path: str):
        self.output_path = output_path
        self.clips = []
        self.final_clip = None

    def process_project(self, project_data: Dict[str, Any]):
        """
        Главная функция сборки.
        project_data = {
            "base_video": "path/to/video.mp4",
            "trim": {"start": 0, "end": 10},
            "resize": {"width": 1080, "height": 1920}, # Optional
            "layers": [
                {"type": "text", "content": "LOL", "start": 1, "duration": 3, "pos": {"x": "center", "y": 100}, "fontsize": 70, "color": "white"},
                {"type": "image", "path": "path/to/sticker.png", "start": 0, "duration": 5, "pos": {"x": 50, "y": 50}, "resize": 0.5}
            ]
        }
        """
        try:
            # 1. Загружаем основное видео
            base_path = project_data.get("base_video")
            if not os.path.exists(base_path):
                raise FileNotFoundError(f"Base video not found: {base_path}")
            
            video = VideoFileClip(base_path)

            # 2. Обрезка (Trimming)
            trim = project_data.get("trim")
            if trim:
                video = video.subclip(trim["start"], trim["end"])

            # 3. Ресайз (если нужно, например под TikTok)
            resize_opts = project_data.get("resize")
            if resize_opts:
                # Используем resize с сохранением пропорций или кроп (сложнее, пока просто ресайз)
                # width может быть None, тогда он авто-рассчитывается
                w = resize_opts.get("width")
                h = resize_opts.get("height")
                if w and h:
                    video = video.resize(newsize=(w, h))
                elif w:
                    video = video.resize(width=w)
                elif h:
                    video = video.resize(height=h)

            self.clips.append(video) # Базовый слой - первый

            # 4. Обработка слоев (Текст, Стикеры)
            layers = project_data.get("layers", [])
            for layer in layers:
                clip = None
                
                if layer["type"] == "text":
                    # ВАЖНО: Для TextClip нужен ImageMagick. В Docker он обычно есть, 
                    # но если будут ошибки, заменим на PIL генерацию текста.
                    clip = TextClip(
                        layer["content"], 
                        fontsize=layer.get("fontsize", 50), 
                        color=layer.get("color", "white"),
                        font="Arial-Bold" # Убедись, что шрифт есть в системе
                    )
                
                elif layer["type"] == "image":
                    img_path = layer["path"]
                    if os.path.exists(img_path):
                        clip = ImageClip(img_path)
                        # Ресайз стикера (коэффициент или пиксели)
                        if "scale" in layer:
                            clip = clip.resize(layer["scale"])
                        elif "width" in layer:
                            clip = clip.resize(width=layer["width"])

                if clip:
                    # Тайминг
                    clip = clip.set_start(layer["start"]).set_duration(layer["duration"])
                    
                    # Позиция (MoviePy понимает "center", ("left", "top"), (x, y))
                    pos = layer.get("pos")
                    if isinstance(pos, dict):
                        clip = clip.set_position((pos.get("x", "center"), pos.get("y", "center")))
                    else:
                        clip = clip.set_position("center")
                    
                    # Эффекты (появления) - опционально
                    if layer.get("fadein"):
                        clip = clip.crossfadein(layer["fadein"])

                    self.clips.append(clip)

            # 5. Сборка композиции
            self.final_clip = CompositeVideoClip(self.clips, size=video.size)
            
            # Сохранение длительности как у основного видео
            self.final_clip.duration = video.duration

            # 6. Рендеринг
            # codec='libx264' - стандарт для web
            # audio_codec='aac'
            # preset='ultrafast' или 'medium' - баланс скорости/размера
            # threads=4 - используем ядра
            self.final_clip.write_videofile(
                self.output_path, 
                codec="libx264", 
                audio_codec="aac", 
                fps=24,
                preset="medium",
                threads=4,
                logger=None # Отключаем шум в логах
            )
            
            return True

        except Exception as e:
            print(f"Rendering error: {e}")
            raise e
        finally:
            # Очистка ресурсов
            if self.final_clip:
                self.final_clip.close()
            for clip in self.clips:
                try: clip.close()
                except: pass