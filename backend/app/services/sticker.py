from moviepy.editor import ImageClip, CompositeVideoClip, VideoClip
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
import os

class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def _apply_hard_stroke(self, pil_img, color=(255, 255, 255), thickness=5):
        """Hard-edge Stroke (без размытия) через морфологию"""
        if thickness <= 0: return pil_img
        
        img_np = np.array(pil_img)
        # Проверка наличия альфа-канала
        if img_np.shape[2] == 4:
            alpha = img_np[:, :, 3]
        else:
            return pil_img

        if np.max(alpha) == 0: return pil_img

        # 1. Бинаризация альфы для жесткого края (убираем полупрозрачность)
        _, binary_alpha = cv2.threshold(alpha, 127, 255, cv2.THRESH_BINARY)

        # 2. Создание ядра для расширения (Stroke)
        kernel_size = int(thickness * 2) + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        
        # 3. Дилатация (расширение) маски
        dilated = cv2.dilate(binary_alpha, kernel, iterations=1)
        
        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
        
        # Обработка цвета (hex или tuple)
        if isinstance(color, str) and color.startswith('#'):
            color = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
            
        outline_layer[:] = color + (255,) # Заливаем цветом
        outline_layer[:, :, 3] = dilated  # Применяем расширенную маску

        outline_pil = Image.fromarray(outline_layer)
        
        # 4. Накладываем оригинальное изображение поверх обводки
        return Image.alpha_composite(outline_pil, pil_img)

    def _add_text(self, pil_img, text, color="white", size_pct=15, x_pct=0.5, y_pct=0.85):
        """Добавление текста с жесткой обводкой"""
        if not text: return pil_img
        
        draw = ImageDraw.Draw(pil_img)
        W, H = pil_img.size
        
        font_size = int(H * (size_pct / 100))
        font_size = max(20, font_size)

        # Попытка загрузить жирный шрифт, иначе дефолтный
        try:
            # Путь может отличаться в зависимости от ОС (это для Linux/Docker)
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
        except:
            try:
                # Fallback для Windows
                font = ImageFont.truetype("arialbd.ttf", font_size)
            except:
                font = ImageFont.load_default()

        # Расчет размеров текста
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        x = int(W * x_pct) - (text_w // 2)
        y = int(H * y_pct) - (text_h // 2)

        # Рисуем обводку текста (эмуляция stroke)
        stroke_width = max(2, font_size // 10)
        draw.text((x, y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        # Рисуем основной текст
        draw.text((x, y), text, font=font, fill=color)
        
        return pil_img

    def create_animated_sticker(self, image_path: str, animation: str = "none", 
                                outline_color=None, outline_width=0,
                                text=None, text_color="white", 
                                text_size=15, text_x=0.5, text_y=0.8):
        final_clip = None
        clip = None
        
        try:
            # === 1. Подготовка изображения ===
            img = Image.open(image_path).convert("RGBA")
            
            # Увеличиваем холст, чтобы эффекты (Bouncy, Zoomie) не обрезались
            w, h = img.size
            padding = int(max(w, h) * 0.6) 
            new_size = (w + padding*2, h + padding*2)
            
            canvas = Image.new("RGBA", new_size, (0,0,0,0))
            # Центрируем исходник на новом холсте
            canvas.paste(img, (padding, padding))
            img = canvas

            # === 2. Применение статических эффектов (Обводка + Текст) ===
            if outline_color and outline_width > 0:
                img = self._apply_hard_stroke(img, color=outline_color, thickness=int(outline_width))

            if text:
                img = self._add_text(img, text, color=text_color, size_pct=text_size, x_pct=text_x, y_pct=text_y)

            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            # === 3. Настройка видео параметров ===
            duration = 2.0
            fps = 20
            
            # Загружаем подготовленный кадр как массив для обработки
            base_img = np.array(Image.open(temp_frame)) 
            
            # === 4. Реализация анимаций ===

            if animation == "jelly":
                # Эффект желе (построчный сдвиг синусоидой)
                def make_jelly_frame(t):
                    frame = base_img.copy()
                    height, width = frame.shape[:2]
                    
                    # Параметры волны
                    amp = width * 0.04 # Амплитуда
                    freq_y = 4.0       # Частота по вертикали
                    speed = 10.0       # Скорость анимации
                    
                    y_indices = np.arange(height)
                    # Сдвиг зависит от времени (t) и номера строки (y)
                    offsets = (np.sin((t * speed) + (y_indices / height * freq_y)) * amp).astype(int)
                    
                    for y in range(height):
                        shift = offsets[y]
                        if shift != 0:
                            # Цикличный сдвиг строки
                            frame[y] = np.roll(frame[y], shift, axis=0)
                            
                    return frame
                
                clip = VideoClip(make_jelly_frame, duration=duration)

            elif animation == "bouncy":
                # Прыжок со сплющиванием (Squash & Stretch)
                clip_base = ImageClip(temp_frame, duration=duration)
                
                def bounce_transform(t):
                    # Цикл прыжка: 2 прыжка за 2 секунды
                    step = 2 * np.pi * 2 
                    # Смещаем фазу (-pi/2), чтобы начинать с "земли"
                    sine_val = np.sin(t * step - np.pi/2) 
                    norm_sine = (sine_val + 1) / 2 # 0..1
                    
                    # Высота прыжка (h) с кубической плавностью
                    h_factor = norm_sine ** 0.7 
                    
                    # Деформация (d): сплющивание только внизу (когда h близко к 0)
                    d = 0
                    if h_factor < 0.2:
                        d = (0.2 - h_factor) * 0.4 # Сила сплющивания
                    
                    sx = 1 + d # Расширение по X
                    sy = 1 - d # Сжатие по Y
                    return sx, sy
                
                def bounce_pos(t):
                    # Синхронное движение по Y
                    step = 2 * np.pi * 2
                    norm_sine = (np.sin(t * step - np.pi/2) + 1) / 2
                    
                    # Амплитуда прыжка вверх (отрицательное значение Y)
                    y_jump = -80 * (norm_sine ** 0.7)
                    
                    # Компенсация позиции из-за сжатия (чтобы "ноги" оставались на земле)
                    # (повторяем логику d для точности)
                    h_factor = norm_sine ** 0.7
                    d = 0
                    if h_factor < 0.2: d = (0.2 - h_factor) * 0.4
                    sy = 1 - d
                    
                    # Центр смещается при ресайзе, компенсируем
                    _, H_c = clip_base.size
                    scale_y_offset = (H_c * (1 - sy)) / 2
                    
                    # 'center' по X, вычисленный Y
                    return ('center', int(new_size[1]/2 + y_jump + scale_y_offset))

                clip = clip_base.resize(bounce_transform).set_position(bounce_pos)

            elif animation == "floaties":
                # Эффект левитации с "призрачным" шлейфом
                clip_base = ImageClip(temp_frame, duration=duration)
                
                def lissajous_pos(t, lag=0):
                    # Фигура Лиссажу (восьмерка)
                    time = t * 2 # Скорость движения
                    amp_x = 20
                    amp_y = 10
                    
                    x = np.sin(time + lag) * amp_x
                    y = np.sin((time + lag) * 2) * amp_y
                    
                    # Возвращаем абсолютные координаты центра
                    center_x = new_size[0] / 2
                    center_y = new_size[1] / 2
                    
                    # Учитываем, что set_position ставит верхний левый угол
                    # Но clip_base имеет размер (w,h).
                    # Проще вернуть смещение относительно центра
                    return (int(center_x + x - clip_base.w/2), int(center_y + y - clip_base.h/2))

                layers = []
                # 8 слоев шлейфа позади
                for i in range(8, 0, -1):
                    lag = -0.1 * i # Чуть уменьшил лаг, чтобы шлейф был плотнее
                    
                    # НОВАЯ ФОРМУЛА ПРОЗРАЧНОСТИ
                    # i=8 -> 0.15 (15%)
                    # i=1 -> 0.50 (50%)
                    opacity = 0.55 - (i * 0.05) 
                    
                    ghost = clip_base.copy() \
                        .set_opacity(opacity) \
                        .rotate(lambda t, l=lag: 5 * np.sin((t*2 + l) * 2), expand=False) \
                        .set_position(lambda t, l=lag: lissajous_pos(t, l))
                    
                    layers.append(ghost)
                
                # Основной слой сверху
                main = clip_base.set_position(lambda t: lissajous_pos(t, 0))
                layers.append(main)
                
                # Композиция слоев
                clip = CompositeVideoClip(layers, size=new_size)

            elif animation == "peeker":
                # Появление снизу (как из кармана)
                clip_base = ImageClip(temp_frame, duration=duration)
                
                def peek_pos(t):
                    # Синусоида 0 -> 1 -> 0
                    # t идет 0..2. sin(pi*t) дает один полный цикл 0..1..0..-1..0 ??
                    # Нам нужно просто вверх-вниз один раз за цикл или два?
                    # Giphy Peeker: вылез, постоял, ушел.
                    
                    # Используем (sin(t * pi - pi/2) + 1) / 2 -> 0..1..0 за 2 секунды
                    norm = (np.sin(t * np.pi * 2 - np.pi/2) + 1) / 2
                    
                    # Смещение: когда 0 -> объект внизу (спрятан), когда 1 -> в центре
                    # Высота прыжка = высота объекта
                    y_offset = (new_size[1]) * (1 - norm) 
                    
                    # Используем 'center' для X, и смещение для Y
                    # Но Y должен быть относительно низа видимой области? 
                    # Проще сдвигать весь клип вниз.
                    return ('center', int(y_offset))
                
                clip = clip_base.set_position(peek_pos)
                
                # Обрезаем клип снизу, помещая его в CompositeVideoClip меньшей высоты (или такой же)
                # Но сдвигая его вниз за пределы
                clip = CompositeVideoClip([clip], size=new_size)

            elif animation == "flippy":
                # Зеркальное отражение по таймеру
                clip_base = ImageClip(temp_frame, duration=duration)
                
                # MoviePy не умеет делать scaleX=-1 штатно через resize. 
                # Эмулируем переворот через сжатие в 0 и разжатие
                def flip_resize(t):
                    # cos(pi * t) меняется 1 -> 0 -> -1 -> 0 -> 1
                    val = np.cos(np.pi * t * 2) # Ускорим
                    return (max(0.01, abs(val)), 1) # Ширина, Высота
                
                clip = clip_base.resize(flip_resize).set_position("center")

            elif animation == "zoomie":
                # Пульсация
                clip = ImageClip(temp_frame, duration=duration) \
                    .resize(lambda t: 1 + 0.15 * np.sin(t * np.pi * 2)) \
                    .set_position("center")

            elif animation == "tilty":
                # Покачивание маятником (pivot bottom эмулируется expand=False + смещением центра если нужно, 
                # но для простоты центр)
                clip = ImageClip(temp_frame, duration=duration) \
                    .rotate(lambda t: 15 * np.sin(t * np.pi * 2), expand=False) \
                    .set_position("center")
                    
            elif animation == "spinny":
                # Вращение 360
                clip = ImageClip(temp_frame, duration=duration) \
                    .rotate(lambda t: -360 * (t / duration), expand=False) \
                    .set_position("center")

            else:
                # Статика
                clip = ImageClip(temp_frame, duration=duration).set_position("center")

            # Сборка финального клипа
            if animation not in ["floaties", "peeker"]: 
                # Для floaties и peeker мы уже создали CompositeVideoClip
                final_clip = CompositeVideoClip([clip], size=new_size)
            else:
                final_clip = clip

            final_clip.duration = duration
            
            # === Экспорт в GIF ===
            final_clip.write_gif(
                self.output_path, 
                fps=fps, 
                program='ffmpeg', 
                opt='Wu', # Оптимизация палитры
                fuzz=3,   # Сжатие
                logger=None
            )
            
            # Удаляем временный файл
            if os.path.exists(temp_frame): os.remove(temp_frame)
            
            return self.output_path

        except Exception as e:
            print(f"Sticker Generation Error: {e}")
            raise e
        finally:
            # Безопасное закрытие ресурсов
            if final_clip:
                try: final_clip.close()
                except: pass
            if clip:
                try: clip.close()
                except: pass