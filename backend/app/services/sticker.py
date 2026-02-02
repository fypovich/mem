from moviepy.editor import ImageClip, CompositeVideoClip, vfx
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def _apply_hard_stroke(self, pil_img, color=(255, 255, 255), thickness=5):
        """
        Создает жесткую (Pixel-perfect) обводку.
        Использует бинаризацию альфа-канала для удаления полупрозрачности.
        """
        if thickness <= 0: return pil_img
        
        # Конвертация в numpy
        img_np = np.array(pil_img)
        alpha = img_np[:, :, 3]
        if np.max(alpha) == 0: return pil_img

        # 1. Бинаризация (Threshold): все что не 0 становится 255
        # Это убирает размытые края (anti-aliasing), делая их жесткими
        _, binary_alpha = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)

        # 2. Создаем ядро для расширения
        # MORPH_ELLIPSE делает углы скругленными, но край остается жестким
        kernel_size = int(thickness * 2) 
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        
        # 3. Дилатация (Расширение маски)
        dilated = cv2.dilate(binary_alpha, kernel, iterations=1)
        
        # 4. Создаем слой обводки (заливка цветом)
        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
        
        # Преобразуем цвет в кортеж (R, G, B)
        if isinstance(color, str) and color.startswith('#'):
            color = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
            
        outline_layer[:] = color + (255,) # Цвет + 100% альфа
        outline_layer[:, :, 3] = dilated # Применяем расширенную маску

        # 5. Композитинг: Обводка снизу, Оригинал сверху
        outline_pil = Image.fromarray(outline_layer)
        combined = Image.alpha_composite(outline_pil, pil_img)
        
        return combined

    def _add_text(self, pil_img, text, color="white", size_pct=15, x_pct=0.5, y_pct=0.85):
        """
        Рисует текст поверх изображения.
        Текст 'впекается' в картинку, чтобы анимироваться вместе с ней.
        """
        if not text: return pil_img
        
        draw = ImageDraw.Draw(pil_img)
        W, H = pil_img.size
        
        # Размер шрифта (минимум 20px)
        font_size = int(H * (size_pct / 100))
        font_size = max(20, font_size)

        try:
            # Используем жирный шрифт для стикеров
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

        # Вычисляем размеры блока текста
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        # Координаты центра текста
        x = int(W * x_pct) - (text_w // 2)
        y = int(H * y_pct) - (text_h // 2)

        # Жесткая обводка текста (Stroke) черным цветом
        stroke_width = max(3, font_size // 8)
        
        draw.text((x, y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        draw.text((x, y), text, font=font, fill=color)
        
        return pil_img

    def create_animated_sticker(self, image_path: str, animation: str = "none", 
                                outline_color=None, outline_width=0,
                                text=None, text_color="white", 
                                text_size=15, text_x=0.5, text_y=0.8):
        final_clip = None
        base_clip = None
        
        try:
            # 1. Загрузка
            img = Image.open(image_path).convert("RGBA")
            
            # 2. Добавляем паддинг (расширяем холст), чтобы анимации не обрезались
            w, h = img.size
            padding = int(max(w, h) * 0.6) # 60% запаса
            new_size = (w + padding*2, h + padding*2)
            
            canvas = Image.new("RGBA", new_size, (0,0,0,0))
            # Вставляем по центру
            canvas.paste(img, (padding, padding))
            img = canvas

            # 3. Применяем Обводку (Stroke)
            if outline_color and outline_width > 0:
                img = self._apply_hard_stroke(img, color=outline_color, thickness=int(outline_width))

            # 4. Применяем Текст (Запекаем)
            if text:
                img = self._add_text(img, text, color=text_color, size_pct=text_size, x_pct=text_x, y_pct=text_y)

            # Сохраняем подготовленный статический кадр
            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            # 5. Создаем анимацию
            duration = 2.0
            fps = 15
            clip = ImageClip(temp_frame, duration=duration)
            W_c, H_c = clip.size

            if animation == "flippy":
                # Резкий флип (Scale X: 1 -> -1 -> 1)
                # MoviePy не поддерживает scaleX(-1) напрямую, эмулируем через resize ширины
                # cos(pi*t) дает плавный переход, abs делает его 'схлопыванием'
                clip = clip.resize(lambda t: (max(0.01, np.abs(np.cos(np.pi * t))), 1)) \
                           .set_position("center")

            elif animation == "spinny":
                # Вращение 360
                clip = clip.rotate(lambda t: -360 * (t / duration), expand=False).set_position("center")

            elif animation == "zoomie":
                # Пульсация масштаба: 1.0 -> 1.3 -> 1.0
                clip = clip.resize(lambda t: 1 + 0.3 * (0.5 - 0.5 * np.cos(2 * np.pi * t / duration))).set_position("center")

            elif animation == "tilty":
                # Маятник (Pivot bottom)
                # Упрощаем: вращение вокруг центра, но сдвиг вниз компенсирует
                clip = clip.rotate(lambda t: 15 * np.sin(2 * np.pi * t), expand=False).set_position("center")

            elif animation == "peeker":
                # Выглядывание снизу
                def peek_pos(t):
                    # cycle: 0 -> 1 -> 0
                    cycle = 0.5 - 0.5 * np.cos(2 * np.pi * t / duration)
                    # Y смещается от (скрыт) до (центр)
                    y_off = (H_c * 0.6) * (1 - cycle)
                    return ('center', int(y_off))
                clip = clip.set_position(peek_pos)

            elif animation == "jelly":
                # Желе: сохранение объема (ширина растет -> высота падает)
                def jelly_resize(t):
                    # Частота 2 Гц
                    w_factor = 1 + 0.15 * np.sin(2 * np.pi * t * 2)
                    h_factor = 1 - 0.15 * np.sin(2 * np.pi * t * 2)
                    return (w_factor, h_factor)
                clip = clip.resize(jelly_resize).set_position("center")

            elif animation == "bouncy":
                # Прыжок + Squash&Stretch
                def bounce_resize(t):
                    # Сплющивание в момент удара
                    val = np.sin(np.pi * t * 2)
                    if abs(val) < 0.2: # Вблизи земли
                         # Чем ближе к 0, тем сильнее сжатие
                         squeeze = 1.0 + (0.3 * (1 - abs(val)/0.2))
                         return (squeeze, 1.0 / squeeze)
                    return 1
                
                def bounce_pos(t):
                    # Y позиция (абсолютный синус = прыжки)
                    y = abs(np.sin(np.pi * t * 2)) * -60
                    return ('center', 'center' + int(y))

                clip = clip.resize(bounce_resize).set_position(bounce_pos)

            elif animation == "floaties":
                # Шлейф (Ghosting)
                def float_motion(t):
                    return ('center', int(20 * np.sin(2 * np.pi * t)))

                main = clip.set_position(float_motion)
                # Создаем копии с задержкой фазы и прозрачностью
                ghost1 = clip.set_position(lambda t: ('center', int(20 * np.sin(2 * np.pi * (t - 0.1))))).set_opacity(0.3)
                ghost2 = clip.set_position(lambda t: ('center', int(20 * np.sin(2 * np.pi * (t - 0.2))))).set_opacity(0.1)
                
                # Композитинг
                clip = CompositeVideoClip([ghost2, ghost1, main], size=new_size)

            else:
                clip = clip.set_position("center")

            # 6. Финальная сборка
            if animation != "floaties": 
                final_clip = CompositeVideoClip([clip], size=new_size)
            else:
                final_clip = clip # Floaties уже composite

            final_clip.duration = duration

            # 7. Экспорт GIF
            final_clip.write_gif(
                self.output_path, 
                fps=fps, 
                program='ffmpeg', 
                opt='Wu', 
                fuzz=3, 
                logger=None
            )
            
            if os.path.exists(temp_frame): os.remove(temp_frame)
            return self.output_path

        except Exception as e:
            print(f"Sticker Error: {e}")
            raise e
        finally:
            if final_clip: try: final_clip.close() 
            except: pass