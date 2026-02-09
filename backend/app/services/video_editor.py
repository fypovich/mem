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
        """Применение кинематографических эффектов к видео"""
        print(f"🎨 [VideoEditor] Applying filter: '{filter_name}'")

        if not filter_name or filter_name == "No Filter":
            return clip

        # 1. BLACK & WHITE — кинематографический ч/б с плёночным зерном
        if filter_name == "Black & White":
            print("   -> Applying Cinematic BW")
            bw_clip = clip.fx(vfx.blackwhite)
            w_v, h_v = clip.size
            vignette = self._make_vignette(h_v, w_v, 0.30)

            def bw_film(get_frame, t):
                frame = get_frame(t).astype('float64')
                # Мягкое плёночное зерно
                noise = np.random.normal(0, 10, frame.shape)
                frame = frame + noise
                # Мягкий контраст
                frame = (frame - 128) * 1.10 + 128
                # Холодные тени (синеватый оттенок в тёмных зонах)
                luminance = np.mean(frame, axis=2, keepdims=True)
                shadow_mask = np.clip(1.0 - luminance / 80, 0, 1)
                frame[:, :, 2] += shadow_mask[:, :, 0] * 10
                # Lifted blacks (винтажный fade)
                frame = frame + 8
                # Виньетка
                for c in range(3):
                    frame[:, :, c] *= vignette
                return np.clip(frame, 0, 255).astype('uint8')

            return bw_clip.fl(bw_film)

        # 2. SEPIA — винтажная плёнка с тёплым тоном
        elif filter_name == "Sepia":
            print("   -> Applying Vintage Sepia")
            w_v, h_v = clip.size
            vignette = self._make_vignette(h_v, w_v, 0.25)

            def sepia_effect(get_frame, t):
                frame = get_frame(t).astype(np.float64)
                sepia_matrix = np.array([
                    [0.393, 0.769, 0.189],
                    [0.349, 0.686, 0.168],
                    [0.272, 0.534, 0.131]
                ])
                sepia_frame = frame @ sepia_matrix.T
                # Мягкий тёплый оттенок
                sepia_frame[:, :, 0] *= 1.05
                sepia_frame[:, :, 2] *= 0.90
                # Lifted blacks (винтажный fade)
                sepia_frame = sepia_frame + 8
                # Виньетка
                for c in range(3):
                    sepia_frame[:, :, c] *= vignette
                return np.clip(sepia_frame, 0, 255).astype('uint8')

            return clip.fl(sepia_effect)

        # 3. RAINBOW — тонкие цветовые переливы
        elif filter_name == "Rainbow":
            print("   -> Applying Rainbow")
            def color_cycle(get_frame, t):
                frame = get_frame(t).astype(float)
                # Плавная смена оттенков с сохранением 85% оригинала
                r_shift = (np.sin(t * 1.8) + 1) / 2
                g_shift = (np.sin(t * 1.8 + 2.09) + 1) / 2
                b_shift = (np.sin(t * 1.8 + 4.19) + 1) / 2

                frame[:, :, 0] = frame[:, :, 0] * 0.85 + (r_shift * 160 * 0.15)
                frame[:, :, 1] = frame[:, :, 1] * 0.85 + (g_shift * 160 * 0.15)
                frame[:, :, 2] = frame[:, :, 2] * 0.85 + (b_shift * 160 * 0.15)

                return np.clip(frame, 0, 255).astype('uint8')

            return clip.fl(color_cycle)

        # 4. RUMBLE — управляемая тряска с motion blur
        elif filter_name == "Rumble":
            print("   -> Applying Rumble")
            w, h = clip.size
            clip_zoomed = clip.resize(1.08)

            def rumble_effect(get_frame, t):
                dt = int(t * 20)
                random.seed(dt)
                dx = random.randint(-12, 12)
                dy = random.randint(-12, 12)

                cx = (clip_zoomed.w - w) / 2
                cy = (clip_zoomed.h - h) / 2

                frame = clip_zoomed.get_frame(t)[
                    int(cy + dy) : int(cy + dy + h),
                    int(cx + dx) : int(cx + dx + w)
                ]

                # Motion blur при сильном смещении
                if abs(dx) > 6 or abs(dy) > 6:
                    blurred = cv2.GaussianBlur(frame, (5, 5), 0)
                    frame = cv2.addWeighted(frame, 0.75, blurred, 0.25, 0)

                return frame

            return clip.fl(rumble_effect)

        # 5. VHS — аутентичные ретро-помехи
        elif filter_name == "VHS":
            print("   -> Applying VHS")
            def vhs_effect(get_frame, t):
                frame = get_frame(t)
                h_img, w_img = frame.shape[:2]
                frame_float = frame.astype(float)

                # RGB Split (хроматическая аберрация) — мягкий сдвиг
                shift = 3 + int(1 * np.sin(t * 4))
                r_channel = np.roll(frame_float[:, :, 0], shift=shift, axis=1)
                g_channel = frame_float[:, :, 1]
                b_channel = np.roll(frame_float[:, :, 2], shift=-shift, axis=1)
                merged = np.stack([r_channel, g_channel, b_channel], axis=2)

                # Scanlines — мягкие
                merged[::2, :] *= 0.92

                # Горизонтальный jitter — редкий
                jitter_count = 2 + int(2 * abs(np.sin(t * 7)))
                jitter_rows = np.random.choice(h_img, size=jitter_count, replace=False)
                for row in jitter_rows:
                    merged[row] = np.roll(merged[row], np.random.randint(-6, 6), axis=0)

                # Tracking error (тонкая бегущая полоса шума)
                noise_y = int((t * 80) % h_img)
                noise_h = 8 + int(8 * abs(np.sin(t * 3)))
                end_y = min(noise_y + noise_h, h_img)
                if end_y > noise_y:
                    noise = np.random.randint(-40, 40, (end_y - noise_y, w_img, 3))
                    merged[noise_y:end_y, :] += noise

                # Color bleed (размытие R и B каналов)
                merged[:, :, 0] = cv2.GaussianBlur(merged[:, :, 0].astype('float32'), (5, 1), 0)
                merged[:, :, 2] = cv2.GaussianBlur(merged[:, :, 2].astype('float32'), (5, 1), 0)

                return np.clip(merged, 0, 255).astype('uint8')

            return clip.fx(vfx.lum_contrast, contrast=1.15).fl(vhs_effect)

        # 6. GROOVY — мягкий ретро-шлейф с покачиванием
        elif filter_name == "Groovy":
            print("   -> Applying Groovy")
            clip_delayed = clip.fl_time(lambda t: max(0, t - 0.12), keep_duration=True)
            clip_blend = CompositeVideoClip([clip, clip_delayed.set_opacity(0.4)])

            w, h = clip.size
            clip_zoomed = clip_blend.resize(1.08)

            def groovy_pos(get_frame, t):
                dx = int(np.sin(t * 2.0) * 18)
                dy = int(np.cos(t * 1.5) * 10)

                cx = (clip_zoomed.w - w) / 2
                cy = (clip_zoomed.h - h) / 2

                frame = clip_zoomed.get_frame(t)[
                    int(cy + dy) : int(cy + dy + h),
                    int(cx + dx) : int(cx + dx + w)
                ].astype(float)

                # Мягкий тёплый цветовой сдвиг
                frame[:, :, 0] *= 1.05
                frame[:, :, 1] *= 1.01
                frame[:, :, 2] *= 0.92

                # Лёгкое повышение насыщенности
                gray = np.mean(frame, axis=2, keepdims=True)
                frame = gray + (frame - gray) * 1.15

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