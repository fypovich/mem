from moviepy.editor import ImageClip, CompositeVideoClip, VideoClip
import numpy as np
import cv2
import math
from PIL import Image, ImageDraw, ImageFont
import os


# ==============================
# CSS cubic-bezier solver
# ==============================

def _cubic_bezier_y(t, p1x, p1y, p2x, p2y):
    """Solve CSS cubic-bezier(p1x, p1y, p2x, p2y) for progress t.
    Uses Newton's method to find u where Bx(u) = t, returns By(u)."""
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    u = t
    for _ in range(8):
        bx = 3 * (1 - u) ** 2 * u * p1x + 3 * (1 - u) * u ** 2 * p2x + u ** 3
        dbx = 3 * (1 - u) ** 2 * p1x + 6 * (1 - u) * u * (p2x - p1x) + 3 * u ** 2 * (1 - p2x)
        if abs(dbx) < 1e-12:
            break
        u -= (bx - t) / dbx
        u = max(0.0, min(1.0, u))
    return 3 * (1 - u) ** 2 * u * p1y + 3 * (1 - u) * u ** 2 * p2y + u ** 3


_TIMING_CACHE = {
    'linear': (0.0, 0.0, 1.0, 1.0),
    'ease-in-out': (0.42, 0.0, 0.58, 1.0),
    'cubic-bezier(0.33,1,0.68,1)': (0.33, 1.0, 0.68, 1.0),
    'cubic-bezier(0.32,0,0.67,0)': (0.32, 0.0, 0.67, 0.0),
}


def _ease(t, timing='linear'):
    if timing == 'linear':
        return t
    params = _TIMING_CACHE.get(timing)
    if not params:
        return t
    return _cubic_bezier_y(t, *params)


# ==============================
# CSS Keyframe Animation Definitions
# ==============================
# Each keyframe: (progress, {properties}, optional_segment_timing)
# translateY: fraction of content height for bouncy/peeker, pixels for floaties
# translateX: pixels (floaties only)
# scaleX, scaleY: multipliers
# rotate: degrees (CSS convention: positive = clockwise on screen)
# skewX: degrees

ANIM_DEFS = {
    'spinny': {
        'duration': 3.0, 'timing': 'linear', 'origin': (0.5, 0.5),
        'keyframes': [
            (0.00, {'rotate': 0}),
            (1.00, {'rotate': -360}),
        ]
    },
    'zoomie': {
        'duration': 2.0, 'timing': 'ease-in-out', 'origin': (0.5, 0.5),
        'keyframes': [
            (0.00, {'scaleX': 1.0, 'scaleY': 1.0}),
            (0.50, {'scaleX': 1.15, 'scaleY': 1.15}),
            (1.00, {'scaleX': 1.0, 'scaleY': 1.0}),
        ]
    },
    'flippy': {
        'duration': 3.0, 'timing': 'linear', 'origin': (0.5, 0.5),
        'keyframes': [
            (0.00, {'scaleX': 1.0, 'scaleY': 1.0}),
            (0.25, {'scaleX': 0.02, 'scaleY': 0.92}),
            (0.50, {'scaleX': -1.0, 'scaleY': 1.0}),
            (0.75, {'scaleX': 0.02, 'scaleY': 0.92}),
            (1.00, {'scaleX': 1.0, 'scaleY': 1.0}),
        ]
    },
    'tilty': {
        'duration': 2.0, 'timing': 'ease-in-out', 'origin': (0.5, 1.0),
        'keyframes': [
            (0.00, {'rotate': -15}),
            (0.50, {'rotate': 15}),
            (1.00, {'rotate': -15}),
        ]
    },
    'jelly': {
        'duration': 2.0, 'timing': 'ease-in-out', 'origin': (0.5, 0.5),
        'keyframes': [
            (0.00, {'scaleX': 1.0, 'scaleY': 1.0, 'skewX': 0}),
            (0.25, {'scaleX': 1.20, 'scaleY': 0.80, 'skewX': 8}),
            (0.50, {'scaleX': 0.80, 'scaleY': 1.20, 'skewX': -8}),
            (0.75, {'scaleX': 1.10, 'scaleY': 0.90, 'skewX': -4}),
            (1.00, {'scaleX': 1.0, 'scaleY': 1.0, 'skewX': 0}),
        ]
    },
    'bouncy': {
        'duration': 2.0, 'timing': 'ease-in-out', 'origin': (0.5, 1.0),
        'keyframes': [
            (0.00, {'translateY': 0, 'scaleX': 1.25, 'scaleY': 0.75}, 'cubic-bezier(0.33,1,0.68,1)'),
            (0.22, {'translateY': -0.30, 'scaleX': 0.92, 'scaleY': 1.08}, 'cubic-bezier(0.32,0,0.67,0)'),
            (0.35, {'translateY': 0, 'scaleX': 1.20, 'scaleY': 0.80}, 'cubic-bezier(0.33,1,0.68,1)'),
            (0.50, {'translateY': -0.18, 'scaleX': 0.95, 'scaleY': 1.05}, 'cubic-bezier(0.32,0,0.67,0)'),
            (0.62, {'translateY': 0, 'scaleX': 1.12, 'scaleY': 0.88}, 'cubic-bezier(0.33,1,0.68,1)'),
            (0.75, {'translateY': -0.08, 'scaleX': 0.98, 'scaleY': 1.02}, 'cubic-bezier(0.32,0,0.67,0)'),
            (0.87, {'translateY': 0, 'scaleX': 1.05, 'scaleY': 0.95}),
            (1.00, {'translateY': 0, 'scaleX': 1.25, 'scaleY': 0.75}),
        ]
    },
    'peeker': {
        'duration': 2.0, 'timing': 'linear', 'origin': (0.5, 0.5),
        'keyframes': [
            (0.00, {'translateY': 1.0}),
            (0.20, {'translateY': 1.0}),
            (0.45, {'translateY': 0.0}),
            (0.75, {'translateY': 0.0}),
            (1.00, {'translateY': 1.0}),
        ]
    },
    'floaties': {
        'duration': 3.0, 'timing': 'ease-in-out', 'origin': (0.5, 0.5),
        'ghost_layers': 7, 'ghost_delay': 0.15,
        'keyframes': [
            (0.000, {'translateX': 0, 'translateY': 0, 'rotate': 0}),
            (0.125, {'translateX': 18, 'translateY': 15, 'rotate': 2}),
            (0.250, {'translateX': 25, 'translateY': 0, 'rotate': 3}),
            (0.375, {'translateX': 18, 'translateY': -15, 'rotate': 2}),
            (0.500, {'translateX': 0, 'translateY': 0, 'rotate': 0}),
            (0.625, {'translateX': -18, 'translateY': 15, 'rotate': -2}),
            (0.750, {'translateX': -25, 'translateY': 0, 'rotate': -3}),
            (0.875, {'translateX': -18, 'translateY': -15, 'rotate': -2}),
            (1.000, {'translateX': 0, 'translateY': 0, 'rotate': 0}),
        ]
    },
}

_PROP_DEFAULTS = {
    'translateX': 0, 'translateY': 0,
    'scaleX': 1.0, 'scaleY': 1.0,
    'rotate': 0, 'skewX': 0,
}


def _interpolate_keyframes(t_seconds, anim_def):
    """Interpolate animation properties at given time, matching CSS behavior."""
    duration = anim_def['duration']
    t_norm = (t_seconds % duration) / duration
    keyframes = anim_def['keyframes']
    global_timing = anim_def.get('timing', 'linear')

    prev_kf = keyframes[0]
    next_kf = keyframes[-1]
    for i in range(len(keyframes) - 1):
        if keyframes[i][0] <= t_norm <= keyframes[i + 1][0]:
            prev_kf = keyframes[i]
            next_kf = keyframes[i + 1]
            break

    p0, props0 = prev_kf[0], prev_kf[1]
    p1, props1 = next_kf[0], next_kf[1]
    segment_timing = prev_kf[2] if len(prev_kf) > 2 else global_timing

    local_t = (t_norm - p0) / (p1 - p0) if (p1 - p0) > 0 else 0
    eased_t = _ease(local_t, segment_timing)

    all_props = set(list(props0.keys()) + list(props1.keys()))
    result = {}
    for prop in all_props:
        v0 = props0.get(prop, _PROP_DEFAULTS.get(prop, 0))
        v1 = props1.get(prop, _PROP_DEFAULTS.get(prop, 0))
        result[prop] = v0 + (v1 - v0) * eased_t
    return result


def _build_affine(transforms, anim_name, canvas_w, canvas_h, content_rect):
    """Build 2x3 affine matrix replicating CSS transform + transform-origin.
    content_rect: (cx, cy, cw, ch) — position and size of content in canvas.
    Returns forward transform matrix for cv2.warpAffine."""
    c_x, c_y, cw, ch = content_rect
    anim_def = ANIM_DEFS[anim_name]
    origin_frac = anim_def.get('origin', (0.5, 0.5))
    ox = c_x + origin_frac[0] * cw
    oy = c_y + origin_frac[1] * ch

    tx = transforms.get('translateX', 0)
    ty_raw = transforms.get('translateY', 0)
    if anim_name in ('bouncy', 'peeker'):
        ty = ty_raw * ch
    else:
        ty = ty_raw

    sx = transforms.get('scaleX', 1.0)
    sy = transforms.get('scaleY', 1.0)
    angle = math.radians(transforms.get('rotate', 0))
    skew = math.radians(transforms.get('skewX', 0))

    O = np.array([[1, 0, -ox], [0, 1, -oy], [0, 0, 1]], dtype=np.float64)
    O_inv = np.array([[1, 0, ox], [0, 1, oy], [0, 0, 1]], dtype=np.float64)
    T = np.array([[1, 0, tx], [0, 1, ty], [0, 0, 1]], dtype=np.float64)
    R = np.array([
        [math.cos(angle), -math.sin(angle), 0],
        [math.sin(angle), math.cos(angle), 0],
        [0, 0, 1]
    ], dtype=np.float64)
    K = np.array([[1, math.tan(skew), 0], [0, 1, 0], [0, 0, 1]], dtype=np.float64)
    S = np.array([[sx, 0, 0], [0, sy, 0], [0, 0, 1]], dtype=np.float64)

    if anim_name in ('bouncy', 'peeker'):
        M_t = T @ S
    elif anim_name == 'jelly':
        M_t = S @ K
    elif anim_name == 'floaties':
        M_t = T @ R
    elif anim_name in ('flippy', 'zoomie'):
        M_t = S
    elif anim_name in ('spinny', 'tilty'):
        M_t = R
    else:
        M_t = np.eye(3)

    M_final = O_inv @ M_t @ O
    return M_final[:2, :].astype(np.float32)


class StickerService:
    def __init__(self, output_path: str):
        self.output_path = output_path

    def _apply_hard_stroke(self, pil_img, color=(255, 255, 255), thickness=5):
        if thickness <= 0:
            return pil_img
        img_np = np.array(pil_img)
        if img_np.shape[2] == 4:
            alpha = img_np[:, :, 3]
        else:
            return pil_img
        if np.max(alpha) == 0:
            return pil_img

        _, binary_alpha = cv2.threshold(alpha, 127, 255, cv2.THRESH_BINARY)
        kernel_size = int(thickness * 2) + 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        dilated = cv2.dilate(binary_alpha, kernel, iterations=1)

        h, w = alpha.shape
        outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
        if isinstance(color, str) and color.startswith('#'):
            color = tuple(int(color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
        outline_layer[:] = color + (255,)
        outline_layer[:, :, 3] = dilated

        outline_pil = Image.fromarray(outline_layer)
        return Image.alpha_composite(outline_pil, pil_img)

    def _add_text(self, pil_img, text, color="white", size_pct=15, x_pct=0.5, y_pct=0.85):
        if not text:
            return pil_img
        draw = ImageDraw.Draw(pil_img)
        W, H = pil_img.size
        font_size = int(H * (size_pct / 100))
        font_size = max(20, min(font_size, int(H * 0.5)))
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
        x = max(0, min(x, W - text_w))
        y = max(0, min(y, H - text_h))

        stroke_width = max(2, font_size // 10)
        draw.text((x, y), text, font=font, fill="black", stroke_width=stroke_width, stroke_fill="black")
        draw.text((x, y), text, font=font, fill=color)
        return pil_img

    @staticmethod
    def _make_rgba_clip(make_frame_fn, duration):
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
                                text_size=15, text_x=0.5, text_y=0.8,
                                crop=None):
        final_clip = None
        clip = None

        try:
            img = Image.open(image_path).convert("RGBA")

            if crop:
                cx, cy = crop['x'], crop['y']
                cw, ch = crop['width'], crop['height']
                img = img.crop((cx, cy, cx + cw, cy + ch))

            MAX_GIF_DIM = 512
            if max(img.size) > MAX_GIF_DIM:
                img.thumbnail((MAX_GIF_DIM, MAX_GIF_DIM), Image.Resampling.LANCZOS)

            if outline_color and outline_width > 0:
                img = self._apply_hard_stroke(img, color=outline_color, thickness=int(outline_width))

            if text:
                img = self._add_text(img, text, color=text_color, size_pct=text_size, x_pct=text_x, y_pct=text_y)

            if not animation or animation == "none":
                output_path = os.path.splitext(self.output_path)[0] + '.png'
                img.save(output_path, 'PNG', optimize=True)
                return output_path

            # Padding for animations (auto-crop removes excess later)
            w, h = img.size
            padding = int(max(w, h) * 0.20)
            new_size = (w + padding * 2, h + padding * 2)

            canvas = Image.new("RGBA", new_size, (0, 0, 0, 0))
            canvas.paste(img, (padding, padding))
            img = canvas

            temp_frame = self.output_path + "_temp.png"
            img.save(temp_frame)

            fps = 15
            base_img = np.array(Image.open(temp_frame))
            content_rect = (padding, padding, w, h)

            anim_def = ANIM_DEFS.get(animation)
            if not anim_def:
                duration = 2.5
                clip = ImageClip(temp_frame, duration=duration).set_position("center")
            elif animation == "floaties":
                # Special case: CompositeVideoClip with ghost layers
                duration = anim_def['duration']
                ghost_delay = anim_def.get('ghost_delay', 0.15)
                num_ghosts = anim_def.get('ghost_layers', 7)

                clip_base = ImageClip(temp_frame, duration=duration)

                def get_floaty_pos(t, time_offset=0):
                    tr = _interpolate_keyframes(t + time_offset, anim_def)
                    return (tr.get('translateX', 0), tr.get('translateY', 0))

                def get_floaty_rot(t, time_offset=0):
                    tr = _interpolate_keyframes(t + time_offset, anim_def)
                    return -tr.get('rotate', 0)  # Negate for MoviePy (CCW convention)

                layers = []
                for i in range(num_ghosts, 0, -1):
                    offset = ghost_delay * i
                    ghost = clip_base.copy() \
                        .set_opacity(1.0) \
                        .rotate(lambda t, o=offset: get_floaty_rot(t, o), expand=False) \
                        .set_position(lambda t, o=offset: get_floaty_pos(t, o))
                    layers.append(ghost)

                main = clip_base.copy() \
                    .rotate(lambda t: get_floaty_rot(t, 0), expand=False) \
                    .set_position(lambda t: get_floaty_pos(t, 0))
                layers.append(main)
                clip = CompositeVideoClip(layers, size=new_size)
            else:
                # Unified keyframe engine for all other animations
                duration = anim_def['duration']
                h_canvas, w_canvas = base_img.shape[:2]

                def make_frame(t):
                    transforms = _interpolate_keyframes(t, anim_def)
                    M = _build_affine(transforms, animation, w_canvas, h_canvas, content_rect)
                    return cv2.warpAffine(
                        base_img, M, (w_canvas, h_canvas),
                        flags=cv2.INTER_LINEAR,
                        borderMode=cv2.BORDER_CONSTANT,
                        borderValue=(0, 0, 0, 0)
                    )

                clip = self._make_rgba_clip(make_frame, duration)

            # Assemble final clip
            if animation != "floaties":
                final_clip = CompositeVideoClip([clip], size=new_size)
            else:
                final_clip = clip

            final_clip.duration = duration

            # Auto-crop transparent edges
            try:
                x1, y1, x2, y2 = self._get_content_bbox(final_clip)
                if x2 > x1 + 10 and y2 > y1 + 10:
                    final_clip = final_clip.crop(x1=x1, y1=y1, x2=x2, y2=y2)
            except Exception as e:
                print(f"Auto-crop skipped: {e}")

            # Export GIF
            final_clip.write_gif(
                self.output_path,
                fps=fps,
                program='ffmpeg',
                opt='Wu',
                fuzz=3,
                logger=None
            )

            if os.path.exists(temp_frame):
                os.remove(temp_frame)

            return self.output_path

        except Exception as e:
            print(f"Sticker Generation Error: {e}")
            raise e
        finally:
            if final_clip:
                try:
                    final_clip.close()
                except:
                    pass
            if clip:
                try:
                    clip.close()
                except:
                    pass
