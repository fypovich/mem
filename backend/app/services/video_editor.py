import os
import random
import cv2
import numpy as np
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip, vfx
from moviepy.audio.io.AudioFileClip import AudioFileClip

class VideoEditorService:
    def __init__(self, output_dir="uploads"):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    @staticmethod
    def _make_vignette(h, w, strength=0.35):
        """Создает маску виньетки (тёмные углы)"""
        Y, X = np.ogrid[:h, :w]
        dist = np.sqrt(((X - w/2) / (w/2))**2 + ((Y - h/2) / (h/2))**2)
        return np.clip(1 - dist * strength, 0.45, 1.0)

    def _apply_filter(self, clip, filter_name):
        """Применение продвинутых эффектов к видео"""
        print(f"🎨 [VideoEditor] Applying filter: '{filter_name}'")

        if not filter_name or filter_name == "No Filter":
            return clip

        # 1. BLACK & WHITE — зернистость + виньетка + контраст
        if filter_name == "Black & White":
            print("   -> Applying BW + Film Grain")
            bw_clip = clip.fx(vfx.blackwhite)
            w_v, h_v = clip.size
            vignette = self._make_vignette(h_v, w_v, 0.4)

            def bw_film(get_frame, t):
                frame = get_frame(t).astype('float64')
                # Зернистость
                noise = np.random.normal(0, 18, frame.shape)
                frame = frame + noise
                # Контраст
                frame = (frame - 128) * 1.15 + 128
                # Виньетка
                for c in range(3):
                    frame[:, :, c] *= vignette
                return np.clip(frame, 0, 255).astype('uint8')

            return bw_clip.fl(bw_film)

        # 2. SEPIA — тёплый тон + виньетка
        elif filter_name == "Sepia":
            print("   -> Applying Sepia")
            w_v, h_v = clip.size
            vignette = self._make_vignette(h_v, w_v, 0.3)

            def sepia_effect(get_frame, t):
                frame = get_frame(t).astype(np.float64)
                sepia_matrix = np.array([
                    [0.393, 0.769, 0.189],
                    [0.349, 0.686, 0.168],
                    [0.272, 0.534, 0.131]
                ])
                sepia_frame = frame @ sepia_matrix.T
                # Тёплый оттенок
                sepia_frame[:, :, 0] *= 1.06  # Красный +
                sepia_frame[:, :, 2] *= 0.88  # Синий -
                # Виньетка
                for c in range(3):
                    sepia_frame[:, :, c] *= vignette
                return np.clip(sepia_frame, 0, 255).astype('uint8')

            return clip.fl(sepia_effect)

        # 3. RAINBOW — более плавные переливы, сохраняя исходные цвета
        elif filter_name == "Rainbow":
            print("   -> Applying Rainbow")
            def color_cycle(get_frame, t):
                frame = get_frame(t).astype(float)
                # Плавная смена оттенков с сохранением 70% оригинала
                r_shift = (np.sin(t * 2.5) + 1) / 2
                g_shift = (np.sin(t * 2.5 + 2.09) + 1) / 2
                b_shift = (np.sin(t * 2.5 + 4.19) + 1) / 2

                frame[:, :, 0] = frame[:, :, 0] * 0.7 + (r_shift * 200 * 0.3)
                frame[:, :, 1] = frame[:, :, 1] * 0.7 + (g_shift * 200 * 0.3)
                frame[:, :, 2] = frame[:, :, 2] * 0.7 + (b_shift * 200 * 0.3)

                return np.clip(frame, 0, 255).astype('uint8')

            return clip.fl(color_cycle)

        # 4. RUMBLE — тряска + лёгкий motion blur
        elif filter_name == "Rumble":
            print("   -> Applying Rumble")
            w, h = clip.size
            clip_zoomed = clip.resize(1.12)

            def rumble_effect(get_frame, t):
                dt = int(t * 20)
                random.seed(dt)
                dx = random.randint(-18, 18)
                dy = random.randint(-18, 18)

                cx = (clip_zoomed.w - w) / 2
                cy = (clip_zoomed.h - h) / 2

                frame = clip_zoomed.get_frame(t)[
                    int(cy + dy) : int(cy + dy + h),
                    int(cx + dx) : int(cx + dx + w)
                ]

                # Motion blur — смешиваем с чуть сдвинутым кадром
                if abs(dx) > 8 or abs(dy) > 8:
                    blurred = cv2.GaussianBlur(frame, (5, 5), 0)
                    frame = cv2.addWeighted(frame, 0.7, blurred, 0.3, 0)

                return frame

            return clip.fl(rumble_effect)

        # 5. VHS — улучшенные помехи + jitter + color bleed
        elif filter_name == "VHS":
            print("   -> Applying VHS")
            def vhs_effect(get_frame, t):
                frame = get_frame(t)
                h_img, w_img = frame.shape[:2]
                frame_float = frame.astype(float)

                # RGB Split (хроматическая аберрация) — подвижный сдвиг
                shift = 5 + int(2 * np.sin(t * 4))
                r_channel = np.roll(frame_float[:, :, 0], shift=shift, axis=1)
                g_channel = frame_float[:, :, 1]
                b_channel = np.roll(frame_float[:, :, 2], shift=-shift, axis=1)
                merged = np.stack([r_channel, g_channel, b_channel], axis=2)

                # Scanlines — каждая 2-я строка
                merged[::2, :] *= 0.88

                # Горизонтальный jitter — случайные строки подёргиваются
                jitter_count = 4 + int(3 * abs(np.sin(t * 7)))
                jitter_rows = np.random.choice(h_img, size=jitter_count, replace=False)
                for row in jitter_rows:
                    merged[row] = np.roll(merged[row], np.random.randint(-10, 10), axis=0)

                # Tracking error (бегущая полоса шума)
                noise_y = int((t * 100) % h_img)
                noise_h = 15 + int(15 * abs(np.sin(t * 3)))
                end_y = min(noise_y + noise_h, h_img)
                if end_y > noise_y:
                    noise = np.random.randint(-70, 70, (end_y - noise_y, w_img, 3))
                    merged[noise_y:end_y, :] += noise

                # Color bleed (размытие цветовых каналов)
                merged[:, :, 0] = cv2.GaussianBlur(merged[:, :, 0].astype('float32'), (5, 1), 0)
                merged[:, :, 2] = cv2.GaussianBlur(merged[:, :, 2].astype('float32'), (5, 1), 0)

                return np.clip(merged, 0, 255).astype('uint8')

            return clip.fx(vfx.lum_contrast, contrast=1.3).fl(vhs_effect)

        # 6. GROOVY — тёплые тона + шлейф + покачивание
        elif filter_name == "Groovy":
            print("   -> Applying Groovy")
            clip_delayed = clip.fl_time(lambda t: max(0, t - 0.15), keep_duration=True)
            clip_blend = CompositeVideoClip([clip, clip_delayed.set_opacity(0.5)])

            w, h = clip.size
            clip_zoomed = clip_blend.resize(1.12)

            def groovy_pos(get_frame, t):
                # Плавное покачивание с тёплым тоном
                dx = int(np.sin(t * 2.5) * 25)
                dy = int(np.cos(t * 1.8) * 15)

                cx = (clip_zoomed.w - w) / 2
                cy = (clip_zoomed.h - h) / 2

                frame = clip_zoomed.get_frame(t)[
                    int(cy + dy) : int(cy + dy + h),
                    int(cx + dx) : int(cx + dx + w)
                ].astype(float)

                # Тёплый цветовой сдвиг
                frame[:, :, 0] *= 1.08  # Красный +
                frame[:, :, 1] *= 1.02  # Зелёный +
                frame[:, :, 2] *= 0.88  # Синий -

                return np.clip(frame, 0, 255).astype('uint8')

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
                # Size already scaled to actual video pixels by frontend
                fontsize = max(12, float(text_config.get('size', 50)))

                txt_clip = TextClip(
                    text_config['text'],
                    fontsize=fontsize,
                    color=text_config.get('color', 'white'),
                    font='DejaVu-Sans-Bold',
                    stroke_color='black',
                    stroke_width=max(1, int(fontsize / 25))
                )
                # Center text at the specified position (frontend uses translate(-50%,-50%))
                tx = float(text_config.get('x', 0.5)) * clip.w - txt_clip.w / 2
                ty = float(text_config.get('y', 0.8)) * clip.h - txt_clip.h / 2
                txt_clip = txt_clip.set_position((tx, ty)).set_duration(clip.duration)
                
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