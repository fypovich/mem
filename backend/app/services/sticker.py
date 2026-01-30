from moviepy.editor import ImageClip, CompositeVideoClip, TextClip, ColorClip
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def _apply_outline(self, pil_img, color=(255, 255, 255), thickness=10):
        """Локальная функция обводки (чтобы не зависеть от AIService)"""
        img_np = np.array(pil_img)
        alpha = img_np[:, :, 3]
        if np.max(alpha) == 0: return pil_img

        # Дилатация маски
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
        dilated = cv2.dilate(alpha, kernel, iterations=1)
        # Сглаживание обводки
        dilated = cv2.GaussianBlur(dilated, (5, 5), 0)

        # Слой цвета
        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
        outline_layer[:] = color + (255,)
        outline_layer[:, :, 3] = dilated

        # Композитинг
        outline_pil = Image.fromarray(outline_layer)
        return Image.alpha_composite(outline_pil, pil_img)

    def _add_text(self, pil_img, text, color="white", size=50):
        """Рисуем текст через Pillow (стабильнее, чем MoviePy TextClip в Docker)"""
        if not text: return pil_img
        
        # Создаем новый холст с запасом места (на случай если текст вылезет)
        w, h = pil_img.size
        new_h = h + int(size * 1.5)
        base = Image.new("RGBA", (w, new_h), (0,0,0,0))
        
        # Центрируем картинку
        base.paste(pil_img, (0, 0))
        
        draw = ImageDraw.Draw(base)
        
        # Пытаемся загрузить шрифт, иначе дефолтный
        try:
            # Путь к шрифтам в Linux
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", size)
        except:
            font = ImageFont.load_default()

        # Рисуем текст с черной обводкой для читаемости
        text_w = list(draw.textbbox((0, 0), text, font=font))[2]
        text_x = (w - text_w) // 2
        text_y = h + 10 # Отступ снизу

        # Обводка текста
        stroke_width = 3
        draw.text((text_x, text_y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        draw.text((text_x, text_y), text, font=font, fill=color)
        
        return base

    def create_animated_sticker(self, image_path: str, animation: str = "none", 
                                outline_color=None, text=None, text_color="white"):
        final_clip = None
        try:
            # 1. Подготовка изображения (Pillow)
            img = Image.open(image_path).convert("RGBA")

            # 2. Наложение Обводки
            if outline_color:
                # Преобразуем hex (#ffffff) в rgb (255,255,255)
                if isinstance(outline_color, str) and outline_color.startswith('#'):
                    outline_color = tuple(int(outline_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
                
                img = self._apply_outline(img, color=outline_color)

            # 3. Наложение Текста
            if text:
                img = self._add_text(img, text, color=text_color, size=60)

            # Сохраняем временный кадр для MoviePy
            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            # 4. Анимация (MoviePy)
            duration = 2.0
            clip = ImageClip(temp_frame, duration=duration)

            if animation == "zoom_in":
                clip = clip.resize(lambda t: 1 + 0.1 * t).set_position("center")
            
            elif animation == "pulse":
                clip = clip.resize(lambda t: 1 + 0.05 * np.sin(2 * np.pi * t)).set_position("center")
            
            elif animation == "shake":
                clip = clip.rotate(lambda t: 5 * np.sin(2 * np.pi * t * 3)).set_position("center")
            
            elif animation == "spin":
                # Вращение 360
                clip = clip.rotate(lambda t: -360 * (t/duration)).set_position("center")
            
            elif animation == "swing":
                # Маятник
                clip = clip.rotate(lambda t: 15 * np.sin(2 * np.pi * t)).set_position("center")

            # Композитинг
            # Создаем прозрачный фон чуть больше стикера, чтобы эффекты не обрезались
            w, h = clip.size
            final_clip = CompositeVideoClip([clip], size=(int(w*1.2), int(h*1.2)))
            final_clip.duration = duration

            # Экспорт
            final_clip.write_gif(
                self.output_path, fps=20, program='ffmpeg', opt='Wu', fuzz=10, logger=None
            )
            
            # Чистка
            if os.path.exists(temp_frame): os.remove(temp_frame)
            
            return self.output_path

        except Exception as e:
            print(f"Sticker Render Error: {e}")
            raise e
        finally:
            if final_clip: final_clip.close()