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
        if img_np.shape[2] == 4:
            alpha = img_np[:, :, 3]
        else:
            return pil_img

        if np.max(alpha) == 0: return pil_img

        _, binary_alpha = cv2.threshold(alpha, 127, 255, cv2.THRESH_BINARY)
        kernel_size = int(thickness * 2) + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        dilated = cv2.dilate(binary_alpha, kernel, iterations=1)

        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)

        if isinstance(color, str) and color.startswith('#'):
            color = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))

        outline_layer[:] = color + (255,)
        outline_layer[:, :, 3] = dilated

        outline_pil = Image.fromarray(outline_layer)
        return Image.alpha_composite(outline_pil, pil_img)

    def _add_text(self, pil_img, text, color="white", size_pct=15, x_pct=0.5, y_pct=0.85):
        """Добавление текста с жесткой обводкой"""
        if not text: return pil_img

        draw = ImageDraw.Draw(pil_img)
        W, H = pil_img.size

        font_size = int(H * (size_pct / 100))
        font_size = max(20, font_size)

        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("arialbd.ttf", font_size)
            except:
                font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        x = int(W * x_pct) - (text_w // 2)
        y = int(H * y_pct) - (text_h // 2)

        stroke_width = max(2, font_size // 10)
        draw.text((x, y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        draw.text((x, y), text, font=font, fill=color)

        return pil_img

    @staticmethod
    def _make_rgba_clip(make_frame_fn, duration):
        """Создает VideoClip с маской из RGBA make_frame"""
        def rgb_fn(t):
            frame = make_frame_fn(t)
            return frame[:, :, :3] if frame.shape[2] >= 4 else frame

        def mask_fn(t):
            frame = make_frame_fn(t)
            if frame.shape[2] >= 4:
                return frame[:, :, 3].astype(np.float64) / 255.0
            return np.ones(frame.shape[:2])

        clip = VideoClip(rgb_fn, duration=duration)
        clip.mask = VideoClip(mask_fn, duration=duration, ismask=True)
        return clip

    @staticmethod
    def _get_content_bbox(clip, num_samples=10):
        """Находит bounding box контента по всем кадрам (для auto-crop)"""
        min_x, min_y = clip.w, clip.h
        max_x, max_y = 0, 0

        for t in np.linspace(0, clip.duration * 0.95, num_samples):
            if clip.mask:
                mask_frame = clip.mask.get_frame(t)
                rows = np.any(mask_frame > 0.01, axis=1)
                cols = np.any(mask_frame > 0.01, axis=0)
            else:
                frame = clip.get_frame(t)
                rows = np.any(np.sum(frame, axis=2) > 15, axis=1)
                cols = np.any(np.sum(frame, axis=2) > 15, axis=0)

            if rows.any() and cols.any():
                y_idx = np.where(rows)[0]
                x_idx = np.where(cols)[0]
                min_x = min(min_x, x_idx[0])
                min_y = min(min_y, y_idx[0])
                max_x = max(max_x, x_idx[-1])
                max_y = max(max_y, y_idx[-1])

        margin = 4
        return (max(0, min_x - margin), max(0, min_y - margin),
                min(clip.w, max_x + margin + 1), min(clip.h, max_y + margin + 1))

    def create_animated_sticker(self, image_path: str, animation: str = "none",
                                outline_color=None, outline_width=0,
                                text=None, text_color="white",
                                text_size=15, text_x=0.5, text_y=0.8):
        final_clip = None
        clip = None

        try:
            # === 1. Подготовка изображения ===
            img = Image.open(image_path).convert("RGBA")

            MAX_GIF_DIM = 512
            if max(img.size) > MAX_GIF_DIM:
                img.thumbnail((MAX_GIF_DIM, MAX_GIF_DIM), Image.Resampling.LANCZOS)

            # === 2. Статические эффекты — на оригинальное изображение (до padding) ===
            if outline_color and outline_width > 0:
                img = self._apply_hard_stroke(img, color=outline_color, thickness=int(outline_width))

            if text:
                img = self._add_text(img, text, color=text_color, size_pct=text_size, x_pct=text_x, y_pct=text_y)

            # === 3. Без анимации — сохраняем как PNG напрямую ===
            if not animation or animation == "none":
                output_path = os.path.splitext(self.output_path)[0] + '.png'
                img.save(output_path, 'PNG', optimize=True)
                return output_path

            # === 4. Padding для анимаций (auto-crop уберёт лишнее) ===
            w, h = img.size
            padding = int(max(w, h) * 0.20)
            new_size = (w + padding * 2, h + padding * 2)

            canvas = Image.new("RGBA", new_size, (0, 0, 0, 0))
            canvas.paste(img, (padding, padding))
            img = canvas

            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            # === 5. Параметры ===
            fps = 15
            base_img = np.array(Image.open(temp_frame))

            # === 6. Анимации (замедленные, более естественные) ===

            if animation == "jelly":
                duration = 3.0
                def make_jelly_frame(t):
                    frame = base_img.copy()
                    height, width = frame.shape[:2]
                    speed = 3.5
                    y_norm = np.arange(height) / height
                    wave1 = np.sin(t * speed + y_norm * 5) * width * 0.025
                    wave2 = np.sin(t * speed * 1.7 + y_norm * 9) * width * 0.010
                    dampen = np.power(y_norm, 0.6)
                    offsets = ((wave1 + wave2) * dampen).astype(int)
                    for y in range(height):
                        shift = offsets[y]
                        if shift != 0:
                            frame[y] = np.roll(frame[y], shift, axis=0)
                    return frame

                clip = self._make_rgba_clip(make_jelly_frame, duration)

            elif animation == "bouncy":
                duration = 2.5
                h_orig, w_orig = base_img.shape[:2]

                def bounce_ease(t_norm):
                    """Bounce easing — имитация мяча с отскоками"""
                    if t_norm < 0.3636:
                        return 7.5625 * t_norm * t_norm
                    elif t_norm < 0.7272:
                        t_norm -= 0.5454
                        return 7.5625 * t_norm * t_norm + 0.75
                    elif t_norm < 0.9090:
                        t_norm -= 0.8181
                        return 7.5625 * t_norm * t_norm + 0.9375
                    else:
                        t_norm -= 0.9545
                        return 7.5625 * t_norm * t_norm + 0.984375

                def make_bouncy_frame(t):
                    t_norm = (t / duration) % 1.0
                    h_factor = bounce_ease(t_norm)

                    # Squash при приземлении (более выраженный)
                    ground_impact = max(0, 1 - h_factor)
                    d = ground_impact * 0.10 if ground_impact > 0.7 else 0.0

                    sx = 1 + d
                    sy = 1 - d

                    new_w = max(1, int(w_orig * sx))
                    new_h = max(1, int(h_orig * sy))
                    resized = cv2.resize(base_img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

                    canvas_arr = np.zeros((h_orig, w_orig, base_img.shape[2]), dtype=np.uint8)
                    x_off = (w_orig - new_w) // 2
                    y_jump = int(-h_orig * 0.18 * (1 - h_factor))
                    y_off = (h_orig - new_h) + y_jump

                    src_x1 = max(0, -x_off)
                    src_y1 = max(0, -y_off)
                    dst_x1 = max(0, x_off)
                    dst_y1 = max(0, y_off)
                    copy_w = min(new_w - src_x1, w_orig - dst_x1)
                    copy_h = min(new_h - src_y1, h_orig - dst_y1)

                    if copy_w > 0 and copy_h > 0:
                        canvas_arr[dst_y1:dst_y1+copy_h, dst_x1:dst_x1+copy_w] = \
                            resized[src_y1:src_y1+copy_h, src_x1:src_x1+copy_w]

                    return canvas_arr

                clip = self._make_rgba_clip(make_bouncy_frame, duration)

            elif animation == "floaties":
                duration = 3.0
                clip_base = ImageClip(temp_frame, duration=duration)

                def lissajous_pos(t, lag=0):
                    time = t * 1.2
                    amp_x = 15
                    amp_y = 8
                    x = np.sin(time + lag) * amp_x
                    y = np.sin((time + lag) * 2) * amp_y
                    center_x = new_size[0] / 2
                    center_y = new_size[1] / 2
                    return (int(center_x + x - clip_base.w / 2), int(center_y + y - clip_base.h / 2))

                layers = []
                for i in range(8, 0, -1):
                    lag = -0.12 * i
                    opacity = 0.50 - (i * 0.05)
                    ghost = clip_base.copy() \
                        .set_opacity(opacity) \
                        .rotate(lambda t, l=lag: 4 * np.sin((t * 1.2 + l) * 2), expand=False) \
                        .set_position(lambda t, l=lag: lissajous_pos(t, l))
                    layers.append(ghost)

                main = clip_base.set_position(lambda t: lissajous_pos(t, 0))
                layers.append(main)
                clip = CompositeVideoClip(layers, size=new_size)

            elif animation == "peeker":
                duration = 2.5
                clip_base = ImageClip(temp_frame, duration=duration)

                def peek_pos(t):
                    norm = (np.sin(2 * np.pi * t / duration - np.pi / 2) + 1) / 2
                    y_offset = (new_size[1]) * (1 - norm)
                    return ('center', int(y_offset))

                clip = clip_base.set_position(peek_pos)
                clip = CompositeVideoClip([clip], size=new_size)

            elif animation == "flippy":
                duration = 2.5
                h_orig, w_orig = base_img.shape[:2]

                def make_flippy_frame(t):
                    val = np.cos(2 * np.pi * t / duration)
                    sx = max(0.02, abs(val))
                    sy = 1.0 - (1.0 - sx) * 0.08

                    new_w = max(1, int(w_orig * sx))
                    new_h = max(1, int(h_orig * sy))
                    resized = cv2.resize(base_img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

                    canvas_arr = np.zeros_like(base_img)
                    x_off = (w_orig - new_w) // 2
                    y_off = (h_orig - new_h) // 2

                    src_x1 = max(0, -x_off)
                    src_y1 = max(0, -y_off)
                    dst_x1 = max(0, x_off)
                    dst_y1 = max(0, y_off)
                    cw = min(new_w - src_x1, w_orig - dst_x1)
                    ch = min(new_h - src_y1, h_orig - dst_y1)
                    if cw > 0 and ch > 0:
                        canvas_arr[dst_y1:dst_y1+ch, dst_x1:dst_x1+cw] = resized[src_y1:src_y1+ch, src_x1:src_x1+cw]

                    return canvas_arr

                clip = self._make_rgba_clip(make_flippy_frame, duration)

            elif animation == "zoomie":
                duration = 2.5
                h_orig, w_orig = base_img.shape[:2]

                def make_zoomie_frame(t):
                    t_norm = (t / duration) % 1.0
                    # Heartbeat: lub-dub + rest
                    if t_norm < 0.15:
                        scale = 1 + 0.10 * np.sin(t_norm / 0.15 * np.pi)
                    elif t_norm < 0.20:
                        scale = 1.0
                    elif t_norm < 0.35:
                        scale = 1 + 0.05 * np.sin((t_norm - 0.20) / 0.15 * np.pi)
                    else:
                        decay = max(0, 1 - (t_norm - 0.35) * 2.5)
                        scale = 1 + 0.01 * decay

                    new_w = max(1, int(w_orig * scale))
                    new_h = max(1, int(h_orig * scale))
                    resized = cv2.resize(base_img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

                    canvas_arr = np.zeros_like(base_img)
                    x_off = (w_orig - new_w) // 2
                    y_off = (h_orig - new_h) // 2

                    src_x1 = max(0, -x_off)
                    src_y1 = max(0, -y_off)
                    dst_x1 = max(0, x_off)
                    dst_y1 = max(0, y_off)
                    copy_w = min(new_w - src_x1, w_orig - dst_x1)
                    copy_h = min(new_h - src_y1, h_orig - dst_y1)

                    if copy_w > 0 and copy_h > 0:
                        canvas_arr[dst_y1:dst_y1+copy_h, dst_x1:dst_x1+copy_w] = \
                            resized[src_y1:src_y1+copy_h, src_x1:src_x1+copy_w]

                    return canvas_arr

                clip = self._make_rgba_clip(make_zoomie_frame, duration)

            elif animation == "tilty":
                duration = 2.5
                clip = ImageClip(temp_frame, duration=duration) \
                    .rotate(lambda t: 10 * np.sin(2 * np.pi * t / duration), expand=False) \
                    .set_position("center")

            elif animation == "spinny":
                duration = 3.0
                def spin_angle(t):
                    t_norm = (t / duration) % 1.0
                    if t_norm < 0.5:
                        eased = 4 * t_norm * t_norm * t_norm
                    else:
                        eased = 1 - pow(-2 * t_norm + 2, 3) / 2
                    return -360 * eased

                clip = ImageClip(temp_frame, duration=duration) \
                    .rotate(spin_angle, expand=False) \
                    .set_position("center")

            else:
                duration = 2.5
                clip = ImageClip(temp_frame, duration=duration).set_position("center")

            # Сборка финального клипа
            if animation not in ["floaties", "peeker"]:
                final_clip = CompositeVideoClip([clip], size=new_size)
            else:
                final_clip = clip

            final_clip.duration = duration

            # === AUTO-CROP: убираем прозрачные края ===
            try:
                x1, y1, x2, y2 = self._get_content_bbox(final_clip)
                if x2 > x1 + 10 and y2 > y1 + 10:
                    final_clip = final_clip.crop(x1=x1, y1=y1, x2=x2, y2=y2)
            except Exception as e:
                print(f"Auto-crop skipped: {e}")

            # === Экспорт в GIF ===
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
            print(f"Sticker Generation Error: {e}")
            raise e
        finally:
            if final_clip:
                try: final_clip.close()
                except: pass
            if clip:
                try: clip.close()
                except: pass
