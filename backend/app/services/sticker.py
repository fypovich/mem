from moviepy.editor import ImageClip, CompositeVideoClip
import numpy as np
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def create_animated_sticker(self, image_path: str, animation_type: str = "none", duration: float = 3.0):
        try:
            # MoviePy может падать, если файл не найден
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image not found: {image_path}")

            clip = ImageClip(image_path, duration=duration)
            
            # Эффекты
            if animation_type == "zoom_in":
                clip = clip.resize(lambda t: 1 + 0.1 * t).set_position("center")
            elif animation_type == "pulse":
                clip = clip.resize(lambda t: 1 + 0.05 * np.sin(2 * np.pi * t)).set_position("center")
            elif animation_type == "shake":
                clip = clip.rotate(lambda t: 5 * np.sin(2 * np.pi * t * 3)).set_position("center")

            final_clip = CompositeVideoClip([clip], size=clip.size)
            final_clip.duration = duration

            final_clip.write_gif(
                self.output_path, fps=15, program='ffmpeg', opt='Wu', fuzz=10, logger=None
            )
            return self.output_path
        except Exception as e:
            print(f"Sticker Render Error: {e}")
            raise e
        finally:
            try: final_clip.close()
            except: pass