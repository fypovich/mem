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
        print(f"🎨 [VideoEditor] Applying filter: '{filter_name}'")

        if not filter_name or filter_name == "No Filter":
            return clip
        
        # 1. BLACK & WHITE + NOISE (Зернистость)
        if filter_name == "Black & White":
            print("   -> Applying BW + Noise")
            bw_clip = clip.fx(vfx.blackwhite)
            
            def add_noise(get_frame, t):
                frame = get_frame(t)
                # Шум: матрица случайных чисел от -50 до 50 (усилено для видимости)
                noise = np.random.randint(-50, 50, frame.shape, dtype='int16')
                return np.clip(frame.astype('int16') + noise, 0, 255).astype('uint8')
            
            return bw_clip.fl(add_noise)

        # 2. RAINBOW (Переливание цветов)
        elif filter_name == "Rainbow":
            print("   -> Applying Rainbow")
            def color_cycle(get_frame, t):
                frame = get_frame(t)
                # Смена каналов по синусоиде
                r_factor = (np.sin(t * 3) + 1) / 2  # 0.0 - 1.0
                g_factor = (np.sin(t * 3 + 2) + 1) / 2
                b_factor = (np.sin(t * 3 + 4) + 1) / 2
                
                frame_colored = frame.astype(float)
                # Усиленное наложение цвета
                frame_colored[:, :, 0] = frame_colored[:, :, 0] * 0.5 + (r_factor * 255 * 0.5)
                frame_colored[:, :, 1] = frame_colored[:, :, 1] * 0.5 + (g_factor * 255 * 0.5)
                frame_colored[:, :, 2] = frame_colored[:, :, 2] * 0.5 + (b_factor * 255 * 0.5)
                
                return np.clip(frame_colored, 0, 255).astype('uint8')
            
            return clip.fl(color_cycle)

        # 3. RUMBLE (Тряска)
        elif filter_name == "Rumble":
            print("   -> Applying Rumble")
            w, h = clip.size
            # Зум, чтобы не было черных полос при тряске
            clip_zoomed = clip.resize(1.1) 
            
            def rumble_effect(get_frame, t):
                # Случайное смещение каждые 0.05 сек (чтобы тряска была резкой)
                dt = int(t * 20) 
                random.seed(dt) # Фиксируем сид для кадра, чтобы не мерцало внутри кадра
                dx = random.randint(-15, 15)
                dy = random.randint(-15, 15)
                
                # Получаем кадр из зумированного видео со смещением
                # Центр зумированного видео
                cx = (clip_zoomed.w - w) / 2
                cy = (clip_zoomed.h - h) / 2
                
                # Вырезаем область размером w, h
                return clip_zoomed.get_frame(t)[
                    int(cy + dy) : int(cy + dy + h),
                    int(cx + dx) : int(cx + dx + w)
                ]

            # Используем make_frame вместо fl для полного контроля
            return clip.fl(rumble_effect)

        # 4. VHS (Помехи + сдвиг каналов)
        elif filter_name == "VHS":
            print("   -> Applying VHS")
            def vhs_effect(get_frame, t):
                frame = get_frame(t)
                frame_float = frame.astype(float)
                
                # Сдвиг цветовых каналов (RGB Split)
                r_channel = np.roll(frame_float[:, :, 0], shift=5, axis=1)
                g_channel = frame_float[:, :, 1]
                b_channel = np.roll(frame_float[:, :, 2], shift=-5, axis=1)
                
                merged = np.stack([r_channel, g_channel, b_channel], axis=2)
                
                # Полосы (Scanlines) - затемняем каждую 3 строку
                merged[::3, :] *= 0.85
                
                # Бегущая полоса шума (Tracking error)
                h_img, w_img, _ = frame.shape
                # Полоса едет вниз
                noise_y = int((t * 150) % h_img) 
                noise_h = 30
                if noise_y < h_img - noise_h:
                    noise = np.random.randint(-100, 100, (noise_h, w_img, 3))
                    merged[noise_y:noise_y+noise_h, :] += noise

                return np.clip(merged, 0, 255).astype('uint8')

            # Добавляем контраст для стиля
            return clip.fx(vfx.lum_contrast, contrast=1.4).fl(vhs_effect)

        # 5. GROOVY (Волны и шлейф)
        elif filter_name == "Groovy":
            print("   -> Applying Groovy")
            # Шлейф
            clip_delayed = clip.fl_time(lambda t: max(0, t - 0.2), keep_duration=True)
            clip_blend = CompositeVideoClip([clip, clip_delayed.set_opacity(0.6)]) # 0.6 opacity
            
            w, h = clip.size
            clip_zoomed = clip_blend.resize(1.1)
            
            def groovy_pos(get_frame, t):
                # Плавное покачивание камеры
                dx = int(np.sin(t * 3) * 20)
                dy = int(np.cos(t * 2) * 20)
                
                cx = (clip_zoomed.w - w) / 2
                cy = (clip_zoomed.h - h) / 2
                
                return clip_zoomed.get_frame(t)[
                    int(cy + dy) : int(cy + dy + h),
                    int(cx + dx) : int(cx + dx + w)
                ]

            return clip_zoomed.fl(groovy_pos)
            
        print(f"   -> No matching filter found for '{filter_name}'")
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
            print(f"🎬 START PROCESSING video: {input_path}")
            clip = VideoFileClip(input_path)
            
            # 1. Trimming
            if trim_start is not None and trim_end is not None:
                start = max(0, trim_start)
                end = min(clip.duration, trim_end)
                if start < end:
                    clip = clip.subclip(start, end)

            # 2. Cropping
            if crop:
                clip = clip.crop(
                    x1=crop.get('x', 0),
                    y1=crop.get('y', 0),
                    width=crop.get('width'),
                    height=crop.get('height')
                )

            # 3. Audio
            if remove_audio:
                clip = clip.without_audio()
            elif new_audio_path and os.path.exists(new_audio_path):
                new_audio = AudioFileClip(new_audio_path)
                if new_audio.duration > clip.duration:
                    new_audio = new_audio.subclip(0, clip.duration)
                clip = clip.set_audio(new_audio)

            # 4. Filters
            clip = self._apply_filter(clip, filter_name)

            # 5. Text
            if text_config and text_config.get('text'):
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

            # Save
            output_path = os.path.join(self.output_dir, output_filename)
            clip.write_videofile(
                output_path,
                codec='libx264',
                audio_codec='aac',
                preset='ultrafast',
                fps=24,
                threads=4,
                logger='bar' # Включаем логгер moviepy
            )
            
            print(f"✅ DONE: {output_path}")
            return output_path

        except Exception as e:
            print(f"❌ VideoEditorService Error: {e}")
            raise e
        finally:
            if clip:
                try: 
                    clip.close()
                except: 
                    pass