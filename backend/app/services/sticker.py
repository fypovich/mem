import os
from moviepy.editor import ImageClip, vfx, CompositeVideoClip
import numpy as np

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def create_animated_sticker(self, image_path: str, animation_type: str = "none", duration: float = 3.0):
        """
        Создает анимированный стикер из статической картинки.
        """
        try:
            # Загружаем изображение
            # ВАЖНО: Указываем duration сразу
            clip = ImageClip(image_path, duration=duration)
            
            # Применяем эффекты
            if animation_type == "zoom_in":
                # Ken Burns: Zoom In (1.0 -> 1.3)
                # lambda t: scale
                clip = clip.resize(lambda t: 1 + 0.1 * t)
                # Центрируем при зуме, чтобы не уезжало (обычно resize сам справляется, но composite надежнее)
                clip = clip.set_position("center")

            elif animation_type == "pulse":
                # Пульсация (Scale Up/Down)
                clip = clip.resize(lambda t: 1 + 0.05 * np.sin(2 * np.pi * t / 1.0)) # 1 пульс в сек
                clip = clip.set_position("center")

            elif animation_type == "shake":
                # Тряска (Random Position)
                def shake_pos(t):
                    # Смещаем на +/- 5 пикселей каждые 0.1 сек
                    import random
                    if int(t * 10) % 2 == 0:
                        return ('center', 'center')
                    return (random.randint(-5, 5), random.randint(-5, 5))
                # Для position center сложнее сдвигать относительно, используем margin
                # Упростим: просто вращение
                clip = clip.rotate(lambda t: 2 * np.sin(2 * np.pi * t * 2)) # +/- 2 градуса

            # Собираем на прозрачном фоне (если формат поддерживает)
            # WebP и GIF поддерживают прозрачность, но MoviePy иногда капризничает с Alpha в GIF
            # Используем CompositeVideoClip чтобы зафиксировать размер
            final_clip = CompositeVideoClip([clip], size=clip.size)
            final_clip.duration = duration

            # Экспорт
            ext = self.output_path.split('.')[-1].lower()
            
            if ext == 'gif':
                final_clip.write_gif(
                    self.output_path, 
                    fps=15, # Для стикеров 15-20 fps достаточно
                    program='ffmpeg',
                    opt='Wu', # Оптимизация
                    fuzz=10   # Сжатие цветов
                )
            elif ext == 'webp':
                # MoviePy не пишет webp напрямую через write_videofile хорошо, лучше через ffmpeg image sequence
                # Но write_gif умеет писать webp если указать program='ffmpeg' и имя файла
                # Или используем write_videofile с кодеком libwebp (если ffmpeg собран с ним)
                # Проще всего сохранить как GIF, а потом конвертировать, или попробовать напрямую:
                try:
                    final_clip.write_gif(self.output_path, fps=15, program='ffmpeg')
                except:
                    # Фоллбек: пишем mp4
                    self.output_path = self.output_path.replace('.webp', '.mp4')
                    final_clip.write_videofile(self.output_path, fps=24, codec='libx264')

            final_clip.close()
            return self.output_path

        except Exception as e:
            print(f"Sticker Render Error: {e}")
            raise e