from moviepy.editor import ImageClip, CompositeVideoClip
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def _apply_outline(self, pil_img, color=(255, 255, 255), thickness=10):
        """Плотная обводка (Solid Stroke)"""
        if thickness <= 0: return pil_img
        
        img_np = np.array(pil_img)
        alpha = img_np[:, :, 3]
        if np.max(alpha) == 0: return pil_img

        # 1. Создаем ядро. MORPH_ELLIPSE делает края округлыми
        kernel_size = int(thickness * 2) # Множитель для надежности
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
        
        # 2. Расширяем маску (Dilate). Это и есть "твердая" обводка.
        dilated = cv2.dilate(alpha, kernel, iterations=1)
        
        # 3. НЕ используем GaussianBlur для "плотности". 
        # Если нужны супер-гладкие края, можно сделать min(blur, 255), но лучше оставить жестким.
        
        # 4. Создаем цветной слой
        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
        outline_layer[:] = color + (255,) # Цвет + полная альфа
        outline_layer[:, :, 3] = dilated # Применяем расширенную маску

        # 5. Композитинг: Обводка снизу, Оригинал сверху
        outline_pil = Image.fromarray(outline_layer)
        return Image.alpha_composite(outline_pil, pil_img)

    def _add_text(self, pil_img, text, color="white", size_pct=10, x_pct=0.5, y_pct=0.8):
        """
        Рисуем текст.
        size_pct: размер шрифта в % от высоты картинки.
        x_pct, y_pct: центр текста в % (0.0 - 1.0).
        """
        if not text: return pil_img
        
        draw = ImageDraw.Draw(pil_img)
        W, H = pil_img.size
        
        # Вычисляем размер шрифта относительно высоты картинки
        font_size = int(H * (size_pct / 100))
        font_size = max(10, font_size) # Минимум 10px

        try:
            # Шрифт Liberation (есть в Docker image)
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

        # Вычисляем размеры текста
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        # Вычисляем позицию (центр текста в точке x_pct, y_pct)
        x = int(W * x_pct) - (text_w // 2)
        y = int(H * y_pct) - (text_h // 2)

        # Рисуем обводку текста (черную) для читаемости
        stroke_width = max(2, font_size // 15)
        draw.text((x, y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        draw.text((x, y), text, font=font, fill=color)
        
        return pil_img

    def create_animated_sticker(self, image_path: str, animation: str = "none", 
                                outline_color=None, outline_width=0,
                                text=None, text_color="white", 
                                text_size=15, text_x=0.5, text_y=0.8):
        final_clip = None
        try:
            # 1. Загрузка + Расширение холста (padding)
            # Чтобы обводка и анимации (вращение) не обрезались, добавим отступы
            img = Image.open(image_path).convert("RGBA")
            
            # Добавляем паддинг 20% со всех сторон
            original_w, original_h = img.size
            padding = max(original_w, original_h) // 3
            new_size = (original_w + padding*2, original_h + padding*2)
            
            canvas = Image.new("RGBA", new_size, (0,0,0,0))
            # Вставляем по центру
            paste_x = padding
            paste_y = padding
            canvas.paste(img, (paste_x, paste_y))
            img = canvas # Теперь работаем с расширенной картинкой

            # 2. Наложение Обводки
            if outline_color and outline_width > 0:
                if isinstance(outline_color, str) and outline_color.startswith('#'):
                    outline_color = tuple(int(outline_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
                
                img = self._apply_outline(img, color=outline_color, thickness=int(outline_width))

            # 3. Наложение Текста
            if text:
                img = self._add_text(img, text, color=text_color, size_pct=text_size, x_pct=text_x, y_pct=text_y)

            # Сохраняем подготовленный кадр
            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            # 4. Анимация
            duration = 2.0
            fps = 15
            
            # Создаем клип из картинки
            clip = ImageClip(temp_frame, duration=duration)

            if animation == "zoom_in":
                # Zoom 0.8 -> 1.1
                # Важно: composite устанавливает размер финального окна
                clip = clip.resize(lambda t: 0.8 + 0.15 * t).set_position("center")
            
            elif animation == "pulse":
                # Scale 1.0 -> 1.1 -> 1.0
                clip = clip.resize(lambda t: 1 + 0.05 * np.sin(2 * np.pi * t)).set_position("center")
            
            elif animation == "shake":
                # Вращение +/- 5 градусов
                clip = clip.rotate(lambda t: 5 * np.sin(2 * np.pi * t * 3), expand=False).set_position("center")
            
            elif animation == "spin":
                # Вращение 360
                clip = clip.rotate(lambda t: -360 * (t/duration), expand=False).set_position("center")
            
            elif animation == "swing":
                # Маятник +/- 15 град
                clip = clip.rotate(lambda t: 15 * np.sin(2 * np.pi * t), expand=False).set_position("center")

            # Композитинг
            # Финальный размер равен размеру картинки с паддингами
            final_clip = CompositeVideoClip([clip], size=new_size)
            final_clip.duration = duration

            # Экспорт
            final_clip.write_gif(
                self.output_path, fps=fps, program='ffmpeg', opt='Wu', fuzz=10, logger=None
            )
            
            if os.path.exists(temp_frame): os.remove(temp_frame)
            return self.output_path

        except Exception as e:
            print(f"Render Error: {e}")
            raise e
        finally:
            if final_clip: final_clip.close()