from moviepy.editor import ImageClip, CompositeVideoClip
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def _apply_outline(self, pil_img, color=(255, 255, 255), thickness=10):
        """
        Плотная обводка (Solid Stroke) без размытия.
        """
        if thickness <= 0: return pil_img
        
        img_np = np.array(pil_img)
        alpha = img_np[:, :, 3]
        if np.max(alpha) == 0: return pil_img

        # 1. Создаем ядро для расширения
        # Используем MORPH_ELLIPSE для скругленных углов, но твердых краев
        kernel_size = int(thickness * 2)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
        
        # 2. Расширяем маску (Dilate) - это создает "твердую" подложку
        dilated = cv2.dilate(alpha, kernel, iterations=1)
        
        # ВАЖНО: Мы убрали GaussianBlur, чтобы край был четким (Solid)
        
        # 3. Создаем слой цвета
        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
        outline_layer[:] = color + (255,) # Заливаем цветом с полной непрозрачностью
        outline_layer[:, :, 3] = dilated # Применяем расширенную маску

        # 4. Композитинг: Обводка снизу, Оригинал сверху
        outline_pil = Image.fromarray(outline_layer)
        return Image.alpha_composite(outline_pil, pil_img)

    def _add_text(self, pil_img, text, color="white", size_pct=15, x_pct=0.5, y_pct=0.85):
        """
        Рисует текст с жесткой обводкой.
        """
        if not text: return pil_img
        
        draw = ImageDraw.Draw(pil_img)
        W, H = pil_img.size
        
        # Размер шрифта относительно высоты
        font_size = int(H * (size_pct / 100))
        font_size = max(20, font_size)

        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

        # Размеры текста
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        # Координаты
        x = int(W * x_pct) - (text_w // 2)
        y = int(H * y_pct) - (text_h // 2)

        # Рисуем толстую черную обводку для текста (Stroke)
        stroke_width = max(3, font_size // 10)
        
        # Рисуем обводку текста
        draw.text((x, y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        # Рисуем сам текст
        draw.text((x, y), text, font=font, fill=color)
        
        return pil_img

    def create_animated_sticker(self, image_path: str, animation: str = "none", 
                                outline_color=None, outline_width=0,
                                text=None, text_color="white", 
                                text_size=15, text_x=0.5, text_y=0.8):
        final_clip = None
        try:
            # 1. Загрузка
            img = Image.open(image_path).convert("RGBA")
            
            # 2. Добавляем паддинг (отступы), чтобы анимации (вращение/желе) не обрезались
            w, h = img.size
            padding = int(max(w, h) * 0.4) # 40% запаса
            new_size = (w + padding*2, h + padding*2)
            
            canvas = Image.new("RGBA", new_size, (0,0,0,0))
            canvas.paste(img, (padding, padding))
            img = canvas # Работаем с расширенным холстом

            # 3. Накладываем Обводку (Stroke)
            if outline_color and outline_width > 0:
                if isinstance(outline_color, str) and outline_color.startswith('#'):
                    outline_color = tuple(int(outline_color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
                
                img = self._apply_outline(img, color=outline_color, thickness=int(outline_width))

            # 4. Накладываем Текст (Он становится частью картинки и будет анимироваться)
            if text:
                img = self._add_text(img, text, color=text_color, size_pct=text_size, x_pct=text_x, y_pct=text_y)

            # Сохраняем базовый кадр
            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            # 5. Анимации (Giphy style)
            duration = 2.0
            fps = 15 # Оптимально для стикеров
            clip = ImageClip(temp_frame, duration=duration)
            W_clip, H_clip = clip.size

            if animation == "flippy":
                # Вращение вокруг оси Y (симуляция через resize width)
                # t: 0 -> 1 -> 0 (scale X)
                clip = clip.resize(lambda t: (max(0.1, np.abs(np.cos(np.pi * t))), 1)) \
                           .set_position("center")

            elif animation == "jelly":
                # Эффект желе: расплющивание и вытягивание
                def jelly_effect(t):
                    factor = 1 + 0.1 * np.sin(2 * np.pi * t * 2) # Частота 2x
                    return (1 / factor, factor) # Сохраняем площадь: если шире, то ниже
                clip = clip.resize(jelly_effect).set_position("center")

            elif animation == "spinny":
                # Вращение на 360
                clip = clip.rotate(lambda t: -360 * (t / duration), expand=False).set_position("center")

            elif animation == "zoomie":
                # Быстрый зум (наезд камеры)
                # 0.5 -> 1.2
                clip = clip.resize(lambda t: 0.5 + 0.7 * (t % 1) if t < 1 else 0.5 + 0.7 * ((t-1) % 1)) \
                           .set_position("center")

            elif animation == "tilty":
                # Покачивание (бывший swing)
                clip = clip.rotate(lambda t: 15 * np.sin(2 * np.pi * t), expand=False).set_position("center")

            elif animation == "peeker":
                # Выглядывает снизу
                def peek_pos(t):
                    # Двигаем Y от H (скрыт) до Center
                    cycle = np.sin(np.pi * t) # 0 -> 1 -> 0
                    y_offset = H_clip/2 * (1 - cycle) 
                    return ('center', int(y_offset))
                clip = clip.set_position(peek_pos)

            elif animation == "floaties":
                # Медленное парение
                clip = clip.set_position(lambda t: ('center', 'center' + 20 * np.sin(2 * np.pi * t)))

            elif animation == "bouncy":
                # Прыжки (abs sin)
                def bounce_pos(t):
                    y_ground = 0
                    height = 50 * np.abs(np.sin(2 * np.pi * t * 2))
                    return ('center', -height) # В MoviePy координаты относительны
                # Используем margin чтобы прыгать внутри кадра
                clip = clip.set_position(lambda t: ('center', int(30 * np.abs(np.sin(np.pi * t * 2)) - 15)))

            else:
                # Статика (none)
                clip = clip.set_position("center")

            # Финальный композитинг на прозрачном фоне
            final_clip = CompositeVideoClip([clip], size=new_size)
            final_clip.duration = duration

            # Экспорт
            final_clip.write_gif(
                self.output_path, 
                fps=fps, 
                program='ffmpeg', 
                opt='Wu', # Оптимизация палитры
                fuzz=10, 
                logger=None
            )
            
            if os.path.exists(temp_frame): os.remove(temp_frame)
            return self.output_path

        except Exception as e:
            print(f"Render Error: {e}")
            raise e
        finally:
            if final_clip: final_clip.close()
            if 'clip' in locals(): clip.close()