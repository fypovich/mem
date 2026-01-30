from moviepy.editor import ImageClip, CompositeVideoClip
import numpy as np
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def create_animated_sticker(self, image_path: str, animation_type: str = "none", duration: float = 3.0):
        try:
            # Загружаем картинку
            clip = ImageClip(image_path, duration=duration)
            
            # Применяем эффекты
            if animation_type == "zoom_in":
                # Плавное приближение
                clip = clip.resize(lambda t: 1 + 0.1 * t)
                clip = clip.set_position("center")

            elif animation_type == "pulse":
                # Пульсация
                clip = clip.resize(lambda t: 1 + 0.05 * np.sin(2 * np.pi * t))
                clip = clip.set_position("center")

            elif animation_type == "shake":
                # Легкое вращение
                clip = clip.rotate(lambda t: 5 * np.sin(2 * np.pi * t * 2))
                clip = clip.set_position("center")

            # Композитинг для сохранения размера
            final_clip = CompositeVideoClip([clip], size=clip.size)
            final_clip.duration = duration

            # Экспорт в GIF
            final_clip.write_gif(
                self.output_path, 
                fps=15, 
                program='ffmpeg',
                opt='Wu',
                fuzz=10,
                logger=None
            )
            
            return self.output_path
        except Exception as e:
            print(f"Sticker Render Error: {e}")
            raise e
        finally:
            try:
                if 'clip' in locals(): clip.close()
                if 'final_clip' in locals(): final_clip.close()
            except: pass