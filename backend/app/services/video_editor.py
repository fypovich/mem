import os
import random
import numpy as np
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip, vfx
from moviepy.audio.io.AudioFileClip import AudioFileClip

class VideoEditorService:
    def __init__(self, output_dir="uploads"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def _apply_filter(self, clip, filter_name):
        """Применение продвинутых эффектов к видео"""
        if not filter_name or filter_name == "No Filter":
            return clip
        
        # 1. BLACK & WHITE + NOISE (Зернистость пленки)
        if filter_name == "Black & White":
            # Сначала делаем ЧБ
            bw_clip = clip.fx(vfx.blackwhite)
            
            def add_noise(get_frame, t):
                frame = get_frame(t)
                # Генерируем шум: случайные числа от -30 до 30
                noise = np.random.randint(-30, 30, frame.shape, dtype='int16')
                # Добавляем шум и обрезаем значения, чтобы остаться в 0-255
                noisy_frame = np.clip(frame.astype('int16') + noise, 0, 255).astype('uint8')
                return noisy_frame
            
            return bw_clip.fl(add_noise)

        # 2. RAINBOW (Циклическая смена цветов)
        elif filter_name == "Rainbow":
            def color_cycle(get_frame, t):
                frame = get_frame(t)
                # Создаем матрицу смещения цветов на основе времени
                # Синусоиды со сдвигом фазы для R, G, B каналов
                r_factor = (np.sin(t * 2) + 1) / 2 * 0.5 + 0.5 # от 0.5 до 1.0
                g_factor = (np.sin(t * 2 + 2) + 1) / 2 * 0.5 + 0.5
                b_factor = (np.sin(t * 2 + 4) + 1) / 2 * 0.5 + 0.5
                
                # Умножаем каналы
                frame_colored = frame.astype(float)
                frame_colored[:, :, 0] *= r_factor
                frame_colored[:, :, 1] *= g_factor
                frame_colored[:, :, 2] *= b_factor
                
                return np.clip(frame_colored, 0, 255).astype('uint8')
            
            return clip.fl(color_cycle)

        # 3. RUMBLE (Землетрясение / Тряска)
        elif filter_name == "Rumble":
            w, h = clip.size
            # Немного увеличиваем видео, чтобы при тряске не было видно черных краев
            zoom_ratio = 1.1
            clip_zoomed = clip.resize(zoom_ratio)
            cw, ch = clip_zoomed.size
            
            def shake(get_frame, t):
                # Случайный сдвиг центра
                max_offset = (cw - w) / 2
                dx = int((random.random() - 0.5) * max_offset * 1.5) # Резкие скачки
                dy = int((random.random() - 0.5) * max_offset * 1.5)
                
                # Возвращаем исходный кадр, но со сдвигом (crop логика)
                # get_frame в fl возвращает полный кадр, здесь мы должны сами "вырезать"
                # Но moviepy fl работает с пикселями.
                # Проще использовать scroll, но он предсказуем.
                # Используем геометрический кроп через transform
                return get_frame(t) # Заглушка, реальный Rumble делается через fx ниже

            # Правильный способ сделать Rumble в MoviePy - это двигать crop window
            def get_rumble_pos(t):
                # t - время. Возвращаем (x, y) верхнего левого угла
                # Центрируем кроп
                center_x = (cw - w) / 2
                center_y = (ch - h) / 2
                # Добавляем "тряску"
                x_shake = random.randint(-10, 10)
                y_shake = random.randint(-10, 10)
                return (center_x + x_shake, center_y + y_shake)

            return clip_zoomed.fl(lambda gf, t: gf(t)[
                int(get_rumble_pos(t)[1]):int(get_rumble_pos(t)[1])+h,
                int(get_rumble_pos(t)[0]):int(get_rumble_pos(t)[0])+w
            ], apply_to=['mask', 'video'])

        # 4. VHS (Старая кассета)
        elif filter_name == "VHS":
            def vhs_effect(get_frame, t):
                frame = get_frame(t)
                frame_float = frame.astype(float)
                
                # A. Channel Split (Сдвиг каналов - хроматическая аберрация)
                # Сдвигаем красный канал влево, синий вправо
                r_channel = np.roll(frame_float[:, :, 0], shift=3, axis=1)
                g_channel = frame_float[:, :, 1]
                b_channel = np.roll(frame_float[:, :, 2], shift=-3, axis=1)
                
                # Собираем обратно
                merged = np.stack([r_channel, g_channel, b_channel], axis=2)
                
                # B. Scanlines (Горизонтальные полосы)
                # Каждая 4-я строка темнее
                merged[::4, :] *= 0.8
                
                # C. Tracking Noise (Полоса помех снизу, которая "едет")
                h, w, _ = frame.shape
                # Полоса шума движется сверху вниз
                noise_y = int((t * 50) % h) 
                noise_height = 10
                if noise_y < h - noise_height:
                    noise = np.random.randint(-50, 50, (noise_height, w, 3))
                    merged[noise_y:noise_y+noise_height, :] += noise

                return np.clip(merged, 0, 255).astype('uint8')

            # Добавляем немного контраста для "VHS look"
            return clip.fx(vfx.lum_contrast, contrast=1.2).fl(vhs_effect)

        # 5. GROOVY (Пьяный эффект / Волны)
        elif filter_name == "Groovy":
            # Эффект: Медленное плавание (sine wave) + шлейф (trails)
            
            # 1. Добавляем шлейф (смешиваем с предыдущим кадром)
            # В MoviePy сложно сделать настоящий trail без буфера, поэтому симулируем
            # через наложение копии со сдвигом по времени
            clip_delayed = clip.fl_time(lambda t: max(0, t - 0.2), keep_duration=True)
            clip_blend = CompositeVideoClip([clip, clip_delayed.set_opacity(0.5)])
            
            w, h = clip.size
            
            # 2. "Плавание" (Wobble)
            # Мы используем scroll, но по синусоиде
            zoom = 1.2
            clip_zoomed = clip_blend.resize(zoom)
            zw, zh = clip_zoomed.size
            
            def groovy_pos(t):
                # Центр
                cx = (zw - w) / 2
                cy = (zh - h) / 2
                # Добавляем плавное покачивание
                dx = np.sin(t * 2) * (cx * 0.8)
                dy = np.cos(t * 3) * (cy * 0.8)
                return (int(cx + dx), int(cy + dy))

            # Вырезаем плавающее окно
            return clip_zoomed.fl(lambda gf, t: gf(t)[
                groovy_pos(t)[1]:groovy_pos(t)[1]+h,
                groovy_pos(t)[0]:groovy_pos(t)[0]+w
            ], apply_to=['mask', 'video'])
            
        return clip

    def process_video(
        self,
        input_path: str,
        output_filename: str,
        trim_start: float = None,
        trim_end: float = None,
        crop: dict = None,
        remove_audio: bool = False,
        new_audio_path: str = None,
        text_config: dict = None,
        filter_name: str = None
    ) -> str:
        clip = None
        try:
            clip = VideoFileClip(input_path)
            
            # 1. Тримминг
            if trim_start is not None and trim_end is not None:
                start = max(0, trim_start)
                end = min(clip.duration, trim_end)
                if start < end:
                    clip = clip.subclip(start, end)

            # 2. Кроп
            if crop:
                clip = clip.crop(
                    x1=crop.get('x', 0),
                    y1=crop.get('y', 0),
                    width=crop.get('width'),
                    height=crop.get('height')
                )

            # 3. Аудио
            if remove_audio:
                clip = clip.without_audio()
            elif new_audio_path and os.path.exists(new_audio_path):
                new_audio = AudioFileClip(new_audio_path)
                if new_audio.duration > clip.duration:
                    new_audio = new_audio.subclip(0, clip.duration)
                clip = clip.set_audio(new_audio)

            # 4. Фильтры (Применяем ДО текста, чтобы текст был четким)
            clip = self._apply_filter(clip, filter_name)

            # 5. Текст (Накладываем ПОВЕРХ эффектов)
            if text_config and text_config.get('text'):
                # Вычисляем размер шрифта относительно высоты видео
                # Базовый размер 50 для высоты 720p, масштабируем
                base_height = 720
                font_scale = clip.h / base_height
                fontsize = float(text_config.get('size', 50)) * font_scale

                txt_clip = (TextClip(
                    text_config['text'],
                    fontsize=fontsize,
                    color=text_config.get('color', 'white'),
                    font='DejaVu-Sans-Bold',
                    stroke_color='black',
                    stroke_width=2 if font_scale > 0.5 else 1
                )
                .set_position((float(text_config.get('x', 0.5)), float(text_config.get('y', 0.8))), relative=True)
                .set_duration(clip.duration))
                
                clip = CompositeVideoClip([clip, txt_clip])

            # 6. Сохранение
            output_path = os.path.join(self.output_dir, output_filename)
            
            # preset='ultrafast' - для быстрого тестирования
            # preset='medium' - лучшее качество/размер, но медленнее
            clip.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                preset='ultrafast',
                fps=24,
                threads=4,
                logger=None
            )
            
            return output_path

        except Exception as e:
            print(f"VideoEditorService Error: {e}")
            raise e
        finally:
            if clip:
                try:
                    clip.close()
                except:
                    pass