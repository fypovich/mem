import io
import numpy as np
import cv2
from rembg import remove, new_session
from PIL import Image

# УДАЛЕНО: Глобальная инициализация сессии
# rembg_session = new_session("isnet-general-use")

class AIService:
    @staticmethod
    def remove_background(input_bytes: bytes) -> bytes:
        try:
            # Инициализация сессии ВНУТРИ метода
            session = new_session("isnet-general-use")
            
            return remove(
                input_bytes, 
                session=session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=0
            )
        except Exception as e:
            print(f"AI Error: {e}")
            try:
                session = new_session("isnet-general-use")
                return remove(input_bytes, session=session)
            except:
                raise RuntimeError(f"Background removal failed: {e}")

    @staticmethod
    def add_outline(input_bytes: bytes, color: tuple = (255, 255, 255), thickness: int = 15) -> bytes:
        try:
            image = Image.open(io.BytesIO(input_bytes)).convert("RGBA")
            img_np = np.array(image)
            # ... (остальной код метода без изменений)
            alpha = img_np[:, :, 3]
            if np.max(alpha) == 0: return input_bytes

            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (thickness, thickness))
            dilated_alpha = cv2.dilate(alpha, kernel, iterations=1)
            
            outline_layer = np.zeros_like(img_np)
            outline_layer[:] = color + (255,)
            outline_layer[:, :, 3] = dilated_alpha

            outline_pil = Image.fromarray(outline_layer)
            original_pil = Image.fromarray(img_np)
            
            final_img = Image.alpha_composite(outline_pil, original_pil)

            output = io.BytesIO()
            final_img.save(output, format="PNG")
            return output.getvalue()
        except Exception as e:
            print(f"Outline Error: {e}")
            raise e